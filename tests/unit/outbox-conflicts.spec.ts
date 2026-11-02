import { afterEach, describe, expect, it, vi } from 'vitest'

import { dropJob, merge3, pendingJobs, queueJob } from '~~/db/outbox'
import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import { GONE_KEEP_MS } from '~~/db/schema'
import type { DiscogsClient } from '~~/worker/discogs/client'
import { drainOutbox, outboxOverview, resolveOutboxConflict } from '~~/worker/outbox'
import { syncCollection, syncWantlist } from '~~/worker/sync/library'

/**
 * Two sides, one record (#238): nothing disappears silently, and the app asks
 * only when both sides changed.
 */

afterEach(async () => {
  vi.useRealTimers()
  await deleteFidelityDb()
})

describe('the three-way merge', () => {
  const r = (rating: number) => ({ rating })

  it.each([
    // base, ours, theirs → outcome
    [3, 5, 3, 'send'], // only we changed it
    [3, 5, 5, 'settled'], // Discogs already holds ours
    [3, 3, 4, 'theirs'], // only Discogs changed it
    [3, 5, 4, 'conflict'], // both changed it, differently
    [3, 3, 3, 'settled'], // nobody changed anything
  ] as const)('base %i, ours %i, theirs %i → %s', (base, ours, theirs, outcome) => {
    expect(merge3(r(base), r(ours), r(theirs))).toBe(outcome)
  })

  it('sends when it cannot know what Discogs holds — a field, until #235 says otherwise', () => {
    expect(merge3({ value: 'VG' }, { value: 'VG' }, undefined)).toBe('send')
    expect(merge3({ value: 'VG' }, { value: 'NM' }, undefined)).toBe('send')
  })

  it('compares numbers and strings by what they say', () => {
    expect(
      merge3({ note: 'a', want: 3 }, { note: 'b', want: 3 }, { note: 'b', want: '3' }),
    ).toBe('settled')
  })
})

function release(id: number, rating: number, folder = 1) {
  return {
    id,
    date_added: `2026-08-0${id}T10:00:00-07:00`,
    instance_id: 500 + id,
    folder_id: folder,
    rating,
    notes: '',
    basic_information: {
      id,
      master_id: 0,
      title: `Release ${id}`,
      year: 1973,
      artists: [{ id: 1, name: 'Neu!' }],
      labels: [{ id: 5, name: 'Brain', catno: `BRAIN ${id}` }],
      genres: [],
      styles: [],
      formats: [{ name: 'Vinyl' }],
    },
  }
}

/** Discogs' collection or wantlist, one page, as it stands now. */
function discogs(rows: ReturnType<typeof release>[], key: 'releases' | 'wants' = 'releases') {
  return {
    client: {
      get: vi.fn(async (_path: string, schema: { parse: (v: unknown) => unknown }) =>
        schema.parse({ pagination: { page: 1, pages: 1, items: rows.length }, [key]: rows }),
      ),
      write: vi.fn(async () => null),
    } as unknown as DiscogsClient & { write: ReturnType<typeof vi.fn> },
    username: 'mrtnmlchr',
  }
}

/** A rating tapped here: the shelf shows it, the outbox holds it with its base. */
async function rateLocally(instanceId: number, rating: number, base: number) {
  const db = await openFidelityDb()
  const row = await db.get('collection', instanceId)
  await db.put('collection', { ...row!, rating })
  await queueJob({
    id: `collection.rating:${instanceId}`,
    kind: 'collection.rating',
    payload: { releaseId: instanceId - 500, folderId: 1, instanceId, rating },
    revert: { rating: base },
    queuedAt: 1,
  })
}

describe('a sync that meets a change still waiting', () => {
  it('keeps ours and sends it when only we changed it', async () => {
    await syncCollection(discogs([release(1, 3)]), { full: true })
    await rateLocally(501, 5, 3)

    await syncCollection(discogs([release(1, 3)]), { full: true })

    const db = await openFidelityDb()
    expect((await db.get('collection', 501))?.rating).toBe(5)
    expect((await pendingJobs()).map((job) => job.conflict)).toEqual([undefined])
  })

  it('takes Discogs when only Discogs changed it', async () => {
    await syncCollection(discogs([release(1, 3)]), { full: true })
    await rateLocally(501, 3, 3)

    await syncCollection(discogs([release(1, 4)]), { full: true })

    const db = await openFidelityDb()
    expect((await db.get('collection', 501))?.rating).toBe(4)
    expect(await pendingJobs()).toEqual([])
  })

  it('drops ours when Discogs already holds it', async () => {
    await syncCollection(discogs([release(1, 3)]), { full: true })
    await rateLocally(501, 5, 3)

    await syncCollection(discogs([release(1, 5)]), { full: true })

    expect(await pendingJobs()).toEqual([])
  })

  it('asks when both changed it, and sends nothing meanwhile', async () => {
    await syncCollection(discogs([release(1, 3)]), { full: true })
    await rateLocally(501, 5, 3)

    await syncCollection(discogs([release(1, 4)]), { full: true })

    const db = await openFidelityDb()
    // Ours stays on the shelf until somebody chooses.
    expect((await db.get('collection', 501))?.rating).toBe(5)
    const [job] = await pendingJobs()
    expect(job?.conflict?.remote).toEqual({ rating: 4 })

    const side = discogs([])
    const drained = await drainOutbox(side.client, side.username)
    expect(side.client.write).not.toHaveBeenCalled()
    expect(drained.waiting).toBe(1)
  })

  it('takes Discogs on a moved folder while our rating still goes out', async () => {
    await syncCollection(discogs([release(1, 3, 1)]), { full: true })
    await rateLocally(501, 5, 3)
    await queueJob({
      id: 'collection.folder:501',
      kind: 'collection.folder',
      payload: { releaseId: 1, folderId: 1, instanceId: 501, moveTo: 1 },
      revert: { folderId: 1 },
      queuedAt: 2,
    })

    await syncCollection(discogs([release(1, 3, 7)]), { full: true })

    const db = await openFidelityDb()
    const row = await db.get('collection', 501)
    expect(row).toMatchObject({ rating: 5, folderId: 7 })
    expect((await pendingJobs()).map((job) => job.id)).toEqual(['collection.rating:501'])
  })

  it('takes a folder moved on Discogs while our rating waits, and rates it there', async () => {
    await syncCollection(discogs([release(1, 3, 1)]), { full: true })
    await rateLocally(501, 5, 3)

    await syncCollection(discogs([release(1, 3, 7)]), { full: true })

    const db = await openFidelityDb()
    expect(await db.get('collection', 501)).toMatchObject({ rating: 5, folderId: 7 })
    const side = discogs([])
    await drainOutbox(side.client, side.username)
    expect(side.client.write).toHaveBeenCalledWith(
      'POST',
      expect.stringContaining('/collection/folders/7/releases/1/instances/501'),
      expect.anything(),
    )
  })

  it('merges a wantlist note the same way', async () => {
    const want = { ...release(1, 0), rating: 2, notes: 'theirs' }
    await syncWantlist(discogs([{ ...want, notes: 'base' }], 'wants'))
    await queueJob({
      id: 'wantlist.note:1',
      kind: 'wantlist.note',
      payload: { releaseId: 1, note: 'ours', want: 2 },
      revert: { note: 'base', want: 2 },
      queuedAt: 1,
    })

    await syncWantlist(discogs([want], 'wants'))

    expect((await pendingJobs())[0]?.conflict?.remote).toEqual({ note: 'theirs', want: 2 })
  })
})

describe('answering a conflict', () => {
  async function inConflict() {
    await syncCollection(discogs([release(1, 3)]), { full: true })
    await rateLocally(501, 5, 3)
    await syncCollection(discogs([release(1, 4)]), { full: true })
  }

  it('keeps mine: sends ours, over what Discogs now holds', async () => {
    await inConflict()

    expect(await resolveOutboxConflict('collection.rating:501', 'mine')).toBe(true)

    const [job] = await pendingJobs()
    expect(job?.conflict).toBeUndefined()
    expect(job?.revert).toEqual({ rating: 4 })
    const side = discogs([])
    await drainOutbox(side.client, side.username)
    expect(side.client.write).toHaveBeenCalledOnce()
  })

  it('keeps my folder: moves it out of the folder Discogs put it in', async () => {
    await syncCollection(discogs([release(1, 3, 1)]), { full: true })
    await queueJob({
      id: 'collection.folder:501',
      kind: 'collection.folder',
      payload: { releaseId: 1, folderId: 1, instanceId: 501, moveTo: 5 },
      revert: { folderId: 1 },
      queuedAt: 1,
    })
    await syncCollection(discogs([release(1, 3, 7)]), { full: true })

    expect(await resolveOutboxConflict('collection.folder:501', 'mine')).toBe(true)

    const side = discogs([])
    await drainOutbox(side.client, side.username)
    expect(side.client.write).toHaveBeenCalledWith(
      'POST',
      '/users/mrtnmlchr/collection/folders/7/releases/1/instances/501',
      expect.objectContaining({ body: { folder_id: 5 } }),
    )
  })

  it('takes Discogs: their value on the shelf, nothing sent', async () => {
    await inConflict()

    expect(await resolveOutboxConflict('collection.rating:501', 'theirs')).toBe(true)

    const db = await openFidelityDb()
    expect((await db.get('collection', 501))?.rating).toBe(4)
    expect(await pendingJobs()).toEqual([])
  })

  it('refuses a job that has no question to answer', async () => {
    await syncCollection(discogs([release(1, 3)]), { full: true })
    await rateLocally(501, 5, 3)
    expect(await resolveOutboxConflict('collection.rating:501', 'theirs')).toBe(false)
  })

  it('keeps the question when the same row is changed again', async () => {
    await inConflict()
    await rateLocally(501, 2, 3)
    expect((await pendingJobs())[0]?.conflict?.remote).toEqual({ rating: 4 })
  })

  it('shows it in the overview, grouped by record', async () => {
    await inConflict()
    const overview = await outboxOverview()
    expect(overview.records).toEqual([
      {
        key: 'collection:501',
        title: 'Release 1',
        changes: [
          expect.objectContaining({ kind: 'collection.rating', ours: '★★★★★', theirs: '★★★★' }),
        ],
      },
    ])
  })
})

describe('the base after a sent value lands under a newer one', () => {
  it('moves forward to what was sent', async () => {
    await queueJob({
      id: 'collection.rating:501',
      kind: 'collection.rating',
      payload: { releaseId: 1, folderId: 1, instanceId: 501, rating: 4 },
      revert: { rating: 3 },
      queuedAt: 1,
    })
    const [sent] = await pendingJobs()
    await queueJob({ ...sent!, payload: { ...sent!.payload, rating: 5 }, queuedAt: 2 })

    await dropJob(sent!.id, sent)

    expect((await pendingJobs())[0]?.revert).toEqual({ rating: 4 })
  })
})

describe('a copy Discogs no longer has', () => {
  const placeIn = async (instanceId: number, placeId: string) => {
    const db = await openFidelityDb()
    await db.put('places', { id: placeId, name: 'Crate 3', parentId: null } as never)
    await db.put('placements', { instanceId, placeId, at: 1 })
  }

  it('is named for 30 days with its place, not dropped without a word', async () => {
    await syncCollection(discogs([release(1, 3), release(2, 0)]), { full: true })
    await placeIn(502, 'crate-3')

    await syncCollection(discogs([release(1, 3)]), { full: true })

    const db = await openFidelityDb()
    expect(await db.get('collection', 502)).toBeUndefined()
    const { gone } = await outboxOverview()
    expect(gone).toEqual([
      expect.objectContaining({ instanceId: 502, title: 'Release 2', place: 'Crate 3' }),
    ])
  })

  it('takes its old place again when the release comes back as a new entry', async () => {
    await syncCollection(discogs([release(1, 3), release(2, 0)]), { full: true })
    await placeIn(502, 'crate-3')
    await syncCollection(discogs([release(1, 3)]), { full: true })

    const back = {
      ...release(2, 0),
      instance_id: 9002,
      date_added: '2026-09-01T10:00:00-07:00',
    }
    await syncCollection(discogs([back, release(1, 3)]), { full: true })

    const db = await openFidelityDb()
    expect((await db.get('placements', 9002))?.placeId).toBe('crate-3')
    expect((await db.get('placements', 502))?.placeId).toBeNull()
    expect(await db.count('gone')).toBe(0)
  })

  it('does not hand the place to a second copy owned all along', async () => {
    const twin = { ...release(2, 0), instance_id: 9002 }
    await syncCollection(discogs([release(1, 3), release(2, 0), twin]), { full: true })
    await placeIn(502, 'crate-3')

    await syncCollection(discogs([release(1, 3), twin]), { full: true })

    const db = await openFidelityDb()
    expect(await db.get('placements', 9002)).toBeUndefined()
    expect(await db.count('gone')).toBe(1)
  })

  it('frees the place after 30 days', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(1_800_000_000_000)
    await syncCollection(discogs([release(1, 3), release(2, 0)]), { full: true })
    await placeIn(502, 'crate-3')
    await syncCollection(discogs([release(1, 3)]), { full: true })

    vi.setSystemTime(1_800_000_000_000 + GONE_KEEP_MS + 1)
    await syncCollection(discogs([release(1, 3)]), { full: true })

    const db = await openFidelityDb()
    expect(await db.count('gone')).toBe(0)
    expect((await db.get('placements', 502))?.placeId).toBeNull()
  })
})
