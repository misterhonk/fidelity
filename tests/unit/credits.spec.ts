import { afterEach, describe, expect, it } from 'vitest'

import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import type { CollectionItem, HorizonChunk, Match } from '#shared/types'
import { creditGroups, MIN_MATCHES } from '~~/worker/dig/credits'

afterEach(async () => {
  await deleteFidelityDb()
})

function chunk(over: Partial<HorizonChunk> & Pick<HorizonChunk, 'kind' | 'entityId'>) {
  const ids = over.releaseIds ?? Int32Array.from([])
  return {
    key: `${over.kind}:${over.entityId}`,
    name: 'Entität',
    fetchedAt: 1,
    complete: true,
    requests: 1,
    releaseIds: ids,
    roles: over.roles ?? new Uint8Array(ids.length),
    years: over.years ?? new Int16Array(ids.length),
    ...over,
  } as HorizonChunk
}

function record(over: Partial<CollectionItem> = {}): CollectionItem {
  return {
    releaseId: 1,
    masterId: 0,
    title: 'Platte',
    artistIds: [],
    artistNorms: [],
    artistNames: [],
    labelIds: [],
    labelNorms: [],
    labelNames: [],
    catnos: [],
    genres: [],
    styles: [],
    formats: ['Vinyl', 'LP'],
    year: 1975,
    rating: 0,
    addedAt: '',
    ...over,
  }
}

function match(listingId: number, releaseId: number, score = 60): Match {
  return {
    digId: '01A',
    listingId,
    releaseId,
    score,
    signals: [],
    reason: 'Weil.',
    title: `Platte ${releaseId}`,
    artist: 'Irgendwer',
    label: null,
    catno: null,
    format: 'LP',
    year: 1976,
    condition: null,
    sleeve: null,
    price: 20,
    currency: 'EUR',
    comments: null,
    thumbUrl: null,
    marketLowestPrice: null,
    marketNumForSale: null,
    expired: false,
  }
}

async function seed(chunks: HorizonChunk[], collection: CollectionItem[], matches: Match[]) {
  const db = await openFidelityDb()
  for (const c of chunks) await db.put('horizon', c)
  for (const item of collection) await db.put('collection', item)
  for (const m of matches) await db.put('matches', m)
  return db
}

// Conny Plank: three records of his own on the shelf, four he produced that
// this dealer has.
const plank = chunk({
  kind: 'artist',
  entityId: 55,
  name: 'Conny Plank',
  releaseIds: Int32Array.from([1, 2, 3, 500, 501, 502, 503]),
  roles: Uint8Array.from([0, 0, 0, 1, 1, 1, 1]),
  years: Int16Array.from([1973, 1974, 1975, 1976, 1977, 1978, 1979]),
})

describe('the credit-graph explorer', () => {
  it("groups a dealer's stock by the hand behind it", async () => {
    await seed(
      [plank],
      [1, 2, 3].map((id) => record({ releaseId: id })),
      [500, 501, 502, 503].map((id, i) => match(100 + i, id, 70 - i)),
    )

    const [group] = await creditGroups('01A')
    expect(group).toMatchObject({ entityId: 55, name: 'Conny Plank', owned: 3, total: 3 })
    expect(group?.matches).toHaveLength(4)
    // Strongest first inside a group.
    expect(group?.matches.map((m) => m.score)).toEqual([70, 69, 68, 67])
  })

  it('names the role, so production reads as production', async () => {
    await seed([plank], [record({ releaseId: 1 })], [match(100, 500), match(101, 501)])
    const [group] = await creditGroups('01A')
    expect(group?.matches[0]?.role).not.toBe('Main')
  })

  it('ignores a person with only one record here', async () => {
    // One is a coincidence, not a thread worth pulling.
    await seed([plank], [record({ releaseId: 1 })], [match(100, 500)])
    expect(await creditGroups('01A')).toEqual([])
    expect(MIN_MATCHES).toBe(2)
  })

  it('puts the person you already collect first', async () => {
    const other = chunk({
      kind: 'artist',
      entityId: 66,
      name: 'Jemand Anders',
      releaseIds: Int32Array.from([500, 501, 502]),
      roles: Uint8Array.from([1, 1, 1]),
    })
    await seed(
      [plank, other],
      [1, 2, 3].map((id) => record({ releaseId: id })),
      [500, 501, 502].map((id, i) => match(100 + i, id)),
    )

    // Somebody you own three records of is a stronger thread than somebody you
    // own none of, whatever the shop happens to be holding.
    expect((await creditGroups('01A')).map((g) => g.name)).toEqual([
      'Conny Plank',
      'Jemand Anders',
    ])
  })

  it('says nothing about a dig with no matches', async () => {
    await seed([plank], [record({ releaseId: 1 })], [])
    expect(await creditGroups('01A')).toEqual([])
  })

  it('says nothing without a horizon', async () => {
    await seed([], [], [match(100, 500), match(101, 501)])
    expect(await creditGroups('01A')).toEqual([])
  })
})
