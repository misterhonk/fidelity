import { afterEach, describe, expect, it } from 'vitest'

import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import { MIN_QUERY_LENGTH, searchShelf, SHELF_LIMIT } from '~~/worker/collection/shelf'

afterEach(async () => {
  await deleteFidelityDb()
})

const NOW = 1_800_000_000_000

/**
 * "Habe ich die schon?" — asked with a record in your hand, answered from the
 * device alone, because record shops are basements.
 */
async function shelve(
  store: 'collection' | 'wantlist',
  over: Record<string, unknown> = {},
): Promise<void> {
  const db = await openFidelityDb()
  await db.put(store, {
    releaseId: 1,
    // Keyed by entry since v6. Derived from the release so an override of one
    // carries the other, and two fixtures never share a row by accident.
    instanceId: Number(over.releaseId ?? 1),
    folderId: 1,
    masterId: 0,
    title: 'Dummy',
    artistIds: [],
    artistNames: ['Portishead'],
    artistNorms: ['portishead'],
    labelIds: [],
    labelNames: [],
    labelNorms: [],
    catnos: [],
    genres: [],
    styles: [],
    formats: ['Vinyl', 'LP'],
    year: 1994,
    rating: 5,
    addedAt: '2019-03-01T00:00:00Z',
    ...over,
  } as never)
}

describe('what is already on your shelf', () => {
  it('answers by artist and by title', async () => {
    await shelve('collection')

    expect((await searchShelf('portishead', NOW)).hits).toHaveLength(1)
    expect((await searchShelf('dummy', NOW)).hits).toHaveLength(1)
    // Case and spacing are what somebody typing on a phone gets wrong.
    expect((await searchShelf('  PORTISHEAD  ', NOW)).hits).toHaveLength(1)
  })

  it('wants every word, so a near miss stays a miss', async () => {
    await shelve('collection')

    // Both words present, in either order.
    expect((await searchShelf('portishead dummy', NOW)).hits).toHaveLength(1)
    expect((await searchShelf('dummy portishead', NOW)).hits).toHaveLength(1)

    /*
     * Deliberately not the matcher's trigram cascade. That exists because
     * inventory artists arrive as free text with no ids; here a person is
     * typing and can add a letter — and "du hast die schon" about a different
     * record is worse than no answer at all.
     */
    expect((await searchShelf('portishead roseland', NOW)).hits).toEqual([])
  })

  it('says nothing to one letter', async () => {
    await shelve('collection')
    expect((await searchShelf('p', NOW)).hits).toEqual([])
    expect(MIN_QUERY_LENGTH).toBe(2)
  })

  it('tells owning from wanting', async () => {
    await shelve('collection', { releaseId: 1, title: 'Dummy' })
    await shelve('wantlist', { releaseId: 2, title: 'Dummy' })

    const result = await searchShelf('dummy', NOW)

    // Wanted before owned: both answers matter, but one of them says buy.
    expect(result.hits.map((hit) => hit.source)).toEqual(['wantlist', 'collection'])
    expect(result).toMatchObject({ collection: 1, wantlist: 1 })
  })

  it('carries the format, because that is the whole answer sometimes', async () => {
    // Holding the vinyl of something you own on CD is a buy, not a stop.
    await shelve('collection', { formats: ['CD', 'Album'] })

    const [hit] = (await searchShelf('dummy', NOW)).hits
    expect(hit?.formats).toEqual(['CD', 'Album'])
    expect(hit?.rating).toBe(5)
  })

  it('says how long a wanted record has been waiting', async () => {
    await shelve('wantlist', { addedAt: new Date(NOW - 400 * 86_400_000).toISOString() })

    const [hit] = (await searchShelf('dummy', NOW)).hits
    expect(hit?.waitingDays).toBe(400)
    // Owning something has no waiting time, and inventing one would be noise.
    await shelve('collection', { releaseId: 9 })
    const owned = (await searchShelf('dummy', NOW)).hits.find((h) => h.source === 'collection')
    expect(owned?.waitingDays).toBeNull()
  })

  it('counts the pressings of a wanted album from the horizon', async () => {
    const db = await openFidelityDb()
    await shelve('wantlist', { masterId: 55 })
    await db.put('horizon', {
      key: 'master:55',
      kind: 'master',
      entityId: 55,
      name: 'Dummy',
      fetchedAt: NOW,
      complete: true,
      requests: 1,
      releaseIds: Int32Array.from([1, 2, 3, 4]),
      roles: Uint8Array.from([0, 0, 0, 0]),
    } as never)

    // One of two hundred is a different proposition from the only one there is.
    expect((await searchShelf('dummy', NOW)).hits[0]?.pressings).toBe(4)
  })

  it('says the pressings are unknown rather than zero', async () => {
    await shelve('wantlist', { masterId: 55 })
    // The horizon has not expanded this album; that is not "no pressings".
    expect((await searchShelf('dummy', NOW)).hits[0]?.pressings).toBeNull()

    await shelve('wantlist', { releaseId: 2, masterId: 0, title: 'Ohne Master' })
    const noMaster = (await searchShelf('ohne master', NOW)).hits[0]
    expect(noMaster?.pressings).toBeNull()
  })

  it('stops at a phone screen’s worth', async () => {
    for (let i = 0; i < SHELF_LIMIT + 5; i++) {
      await shelve('collection', { releaseId: i, title: `Dummy ${i}` })
    }
    expect((await searchShelf('dummy', NOW)).hits).toHaveLength(SHELF_LIMIT)
  })

  it('needs no dig, no network and no request', async () => {
    // The whole reason it lives here: the collection and the wantlist have
    // been on the device since M1, and a basement has no signal.
    await shelve('collection')
    await openFidelityDb()
    expect((await searchShelf('portishead', NOW)).hits).toHaveLength(1)
  })
})
