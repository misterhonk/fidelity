import { afterEach, describe, expect, it, vi } from 'vitest'

import { getSyncState } from '~~/db/meta'
import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import type { DiscogsClient } from '~~/worker/discogs/client'
import { syncCollection, syncWantlist, type SyncProgress } from '~~/worker/sync/library'

afterEach(async () => {
  await deleteFidelityDb()
})

interface Row {
  id: number
  date_added: string
  title?: string
  artist?: string
  /** Set in one test, to look like a row from before entry ids were kept. */
  withoutEntry?: boolean
}

function release({
  id,
  date_added,
  title = `Release ${id}`,
  artist = 'Neu!',
  withoutEntry = false,
}: Row) {
  return {
    id,
    date_added,
    // Both are optional in the schema, because an older response had neither.
    ...(withoutEntry ? {} : { instance_id: 500 + id, folder_id: 1 }),
    rating: 0,
    basic_information: {
      id,
      master_id: 2598,
      title,
      year: 1973,
      artists: [{ id: 1, name: artist }],
      labels: [{ id: 5, name: 'Brain', catno: `BRAIN ${id}` }],
      genres: ['Electronic'],
      styles: ['Krautrock'],
      formats: [{ name: 'Vinyl', descriptions: ['LP', 'Album'] }],
    },
  }
}

/**
 * Stands in for the real client. Pages are handed out newest-first, the way
 * `sort=added&sort_order=desc` does.
 */
function fakeClient(pages: Row[][], key: 'releases' | 'wants' = 'releases') {
  const get = vi.fn(
    async (_path: string, schema: { parse: (v: unknown) => unknown }, options) => {
      const page = (options?.query?.page as number) ?? 1
      const rows = pages[page - 1] ?? []
      return schema.parse({
        pagination: {
          page,
          pages: pages.length,
          items: pages.flat().length,
        },
        [key]: rows.map(release),
      })
    },
  )
  return { client: { get } as unknown as DiscogsClient, get }
}

const context = (client: DiscogsClient, report?: (p: SyncProgress) => void) => ({
  client,
  username: 'mrtnmlchr',
  report,
})

describe('collection sync', () => {
  it('walks every page on the first run and stores what it finds', async () => {
    const { client } = fakeClient([
      [
        { id: 3, date_added: '2026-08-03T10:00:00-07:00' },
        { id: 2, date_added: '2026-08-02T10:00:00-07:00' },
      ],
      [{ id: 1, date_added: '2026-08-01T10:00:00-07:00' }],
    ])

    const result = await syncCollection(context(client))

    expect(result.stored).toBe(3)
    expect(result.requests).toBe(2)

    const db = await openFidelityDb()
    expect(await db.count('collection')).toBe(3)
  })

  it('normalises names once, at sync time', async () => {
    const { client } = fakeClient([
      [{ id: 1, date_added: '2026-08-01T10:00:00-07:00', artist: 'The Beatles' }],
    ])

    await syncCollection(context(client))

    const db = await openFidelityDb()
    const stored = await db.get('collection', 501)
    expect(stored?.artistNorms).toEqual(['beatles'])
    expect(stored?.labelNorms).toEqual(['brain'])
    expect(stored?.catnos).toEqual(['BRAIN 1'])
    expect(stored?.formats).toEqual(['Vinyl', 'LP', 'Album'])
  })

  it('remembers the newest date so the next run is a delta', async () => {
    const { client } = fakeClient([[{ id: 2, date_added: '2026-08-02T10:00:00-07:00' }]])
    await syncCollection(context(client))

    expect((await getSyncState()).lastCollectionAdd).toBe('2026-08-02T10:00:00-07:00')
  })

  it('costs a single request when nothing was added', async () => {
    const pages = [[{ id: 2, date_added: '2026-08-02T10:00:00-07:00' }]]
    await syncCollection(context(fakeClient(pages).client))

    const second = fakeClient(pages)
    const result = await syncCollection(context(second.client))

    expect(result.stored).toBe(0)
    expect(result.requests).toBe(1)
    expect(second.get).toHaveBeenCalledTimes(1)
  })

  it('picks up only what is new and stops at the first known record', async () => {
    await syncCollection(
      context(fakeClient([[{ id: 2, date_added: '2026-08-02T10:00:00-07:00' }]]).client),
    )

    const { client } = fakeClient([
      [
        { id: 3, date_added: '2026-08-03T10:00:00-07:00' },
        { id: 2, date_added: '2026-08-02T10:00:00-07:00' },
      ],
      [{ id: 1, date_added: '2026-08-01T10:00:00-07:00' }],
    ])
    const result = await syncCollection(context(client))

    expect(result.stored).toBe(1)
    // Page two is never fetched — that is the entire point of the delta.
    expect(result.requests).toBe(1)

    const db = await openFidelityDb()
    expect((await db.getAllKeys('collection')).sort()).toEqual([502, 503])
  })

  it('reports progress per page rather than only at the end', async () => {
    const seen: SyncProgress[] = []
    const { client } = fakeClient([
      [{ id: 3, date_added: '2026-08-03T10:00:00-07:00' }],
      [{ id: 2, date_added: '2026-08-02T10:00:00-07:00' }],
      [{ id: 1, date_added: '2026-08-01T10:00:00-07:00' }],
    ])

    await syncCollection(context(client, (progress) => seen.push(progress)))

    expect(seen).toHaveLength(3)
    expect(seen.map((p) => p.stored)).toEqual([1, 2, 3])
    expect(seen.at(-1)?.total).toBe(3)
  })

  /*
   * The two numbers a write needs, and what happens without them.
   *
   * Discogs addresses a collection *entry*, not a release — the same record
   * can stand in the shelf twice. Both ids come with every row and were
   * dropped on the floor for as long as the app only read. A record synced
   * before that gets zero, and zero has to stay distinguishable from a real
   * folder: folder 0 is Discogs' virtual "All" and is not a valid target, so
   * writing to it would fail in a way nobody could read.
   */
  it('keeps the entry a write has to address', async () => {
    const { client } = fakeClient([[{ id: 1, date_added: '2026-08-01T10:00:00-07:00' }]])

    await syncCollection(context(client))

    const db = await openFidelityDb()
    const stored = await db.get('collection', 501)
    expect(stored?.instanceId).toBe(501)
    expect(stored?.folderId).toBe(1)
  })

  it('gives a row with no entry a key of its own, which is "cannot be written"', async () => {
    const { client } = fakeClient([
      [{ id: 2, date_added: '2026-08-01T10:00:00-07:00', withoutEntry: true }],
    ])

    await syncCollection(context(client))

    const db = await openFidelityDb()
    // Its own key, derived from the release, so rows without an entry cannot
    // collide with each other — and negative, so no write path takes it for one.
    const stored = await db.get('collection', -2)
    expect(stored?.instanceId).toBe(-2)
    expect(stored?.folderId).toBe(0)
  })

  /*
   * The estimate is worth one request, and not one every half hour.
   *
   * A delta over an unchanged collection has to stay at exactly one request —
   * that is what lets the keeper run all day without anybody noticing. So the
   * value rides along with a walk that stored something, and otherwise waits.
   */
  it('does not spend a request on the estimate when nothing was added', async () => {
    const { client, get } = fakeClient([[{ id: 1, date_added: '2026-08-01T10:00:00-07:00' }]])
    await syncCollection(context(client))
    const afterFirst = get.mock.calls.length

    await syncCollection(context(client))

    expect(get.mock.calls.length - afterFirst).toBe(1)
    expect(get.mock.calls.some(([path]) => String(path).endsWith('/value'))).toBe(true)
  })
})

describe('wantlist sync', () => {
  it('always walks the whole list — it changes in both directions', async () => {
    const pages = [[{ id: 9, date_added: '2026-08-02T10:00:00-07:00' }]]
    await syncWantlist(context(fakeClient(pages, 'wants').client))

    const second = fakeClient(pages, 'wants')
    const result = await syncWantlist(context(second.client))

    expect(result.stored).toBe(1)
    expect(second.get).toHaveBeenCalledTimes(1)
  })

  it('stores wants without a rating', async () => {
    const { client } = fakeClient(
      [[{ id: 9, date_added: '2026-08-02T10:00:00-07:00' }]],
      'wants',
    )
    await syncWantlist(context(client))

    const db = await openFidelityDb()
    const want = await db.get('wantlist', 9)
    expect(want).toBeDefined()
    expect(want && 'rating' in want).toBe(false)
  })
})

/**
 * Was bei Discogs verschwindet, verschwindet auch hier (2026-09-11).
 *
 * **Der Anlass war eine Beobachtung an echten Daten**, nicht eine Idee: 26
 * Wantlist-Einträge lokal, 24 bei Discogs. Die Wantlist wird immer ganz
 * gelesen — die Entfernung war also die ganze Zeit erkennbar und wurde nur
 * nicht vollzogen, weil der Lauf jede gelesene Zeile schrieb und keine je
 * wegnahm.
 *
 * **In der Sammlung ist das mehr als kosmetisch.** „Besitze ich schon" ist ein
 * harter Filter (`docs/04` §2): eine verkaufte Platte, die im Spiegel
 * stehenbleibt, blendet sich in jedem künftigen Dig selbst aus — und niemand
 * bemerkt eine Empfehlung, die nicht kommt.
 */
describe('what disappears at Discogs', () => {
  it('is removed from the wantlist mirror too', async () => {
    const db = await openFidelityDb()
    const { client } = fakeClient([[{ id: 1, date_added: '2026-01-02' }]], 'wants')

    // Ein Wunsch, den Discogs nicht mehr kennt.
    await db.put('wantlist', { releaseId: 99, masterId: 0, title: 'Weg' } as never)

    const summary = await syncWantlist(context(client))

    expect(await db.getAllKeys('wantlist')).toEqual([1])
    expect(summary.removed).toBe(1)
  })

  it('is removed from the collection after a full walk', async () => {
    const db = await openFidelityDb()
    const { client } = fakeClient([[{ id: 1, date_added: '2026-01-02' }]])

    await db.put('collection', { instanceId: 777, releaseId: 99, title: 'Verkauft' } as never)

    const summary = await syncCollection(context(client), { full: true })

    expect((await db.getAllKeys('collection')) as number[]).not.toContain(777)
    expect(summary.removed).toBe(1)
  })

  /**
   * **Ein Delta darf nichts löschen.**
   *
   * Es hält an der ersten bekannten Platte an und kennt den Rest des Regals
   * nicht. Aus „habe ich nicht gesehen" folgt dort „habe ich nicht gesucht" —
   * und wer daraus löscht, räumt die Sammlung leer, sobald sich nichts
   * geändert hat.
   */
  it('never removes anything on a delta walk', async () => {
    const db = await openFidelityDb()
    const { client } = fakeClient([[{ id: 1, date_added: '2026-01-02' }]])

    await syncCollection(context(client), { full: true })
    await db.put('collection', { instanceId: 777, releaseId: 99, title: 'Bleibt' } as never)

    const summary = await syncCollection(context(client))

    expect((await db.getAllKeys('collection')) as number[]).toContain(777)
    expect(summary.removed).toBe(0)
  })

  /**
   * **Eine leere Antwort löscht nichts.**
   *
   * Eine 200 mit null Einträgen ist von „du hast nichts mehr" nicht zu
   * unterscheiden, und die Folgen sind nicht symmetrisch: im einen Fall
   * bleiben tote Zeilen liegen, im anderen ist das Regal weg und der Horizont
   * dazu.
   */
  it('refuses to empty the shelf on an empty answer', async () => {
    const db = await openFidelityDb()
    await db.put('collection', { instanceId: 777, releaseId: 99, title: 'Bleibt' } as never)

    const { client } = fakeClient([[]])
    const summary = await syncCollection(context(client), { full: true })

    expect((await db.getAllKeys('collection')) as number[]).toContain(777)
    expect(summary.removed).toBe(0)
  })

  /**
   * **Und eine Platte, die auf ihre Bestätigung wartet, überlebt.**
   *
   * Aus einem Fund ins Regal gelegte Platten liegen unter `-releaseId`, bis
   * Discogs sie kennt. Ihr Fehlen in der Antwort ist kein Beleg für
   * irgendetwas — sie wegzuräumen nähme einen Eintrag zurück, den jemand
   * gerade gemacht hat.
   */
  it('keeps a record that Discogs cannot know about yet', async () => {
    const db = await openFidelityDb()
    await db.put('collection', {
      instanceId: -42,
      releaseId: 42,
      title: 'Gerade erst',
    } as never)

    const { client } = fakeClient([[{ id: 1, date_added: '2026-01-02' }]])
    await syncCollection(context(client), { full: true })

    expect((await db.getAllKeys('collection')) as number[]).toContain(-42)
  })
})
