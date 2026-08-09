import { afterEach, describe, expect, it, vi } from 'vitest'

import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import { getMeta } from '~~/db/meta'
import type { CollectionItem, CreditHarvest } from '#shared/types'
import type { DiscogsClient } from '~~/worker/discogs/client'
import {
  creditCandidates,
  harvestCredits,
  MIN_APPEARANCES,
  MIN_RATING,
} from '~~/worker/horizon/credits'

afterEach(async () => {
  await deleteFidelityDb()
})

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
    rating: 5,
    addedAt: '',
    ...over,
  }
}

type Credit = { id: number; name: string; role?: string }

function client(creditsByRelease: Record<number, Credit[]>) {
  const get = vi.fn(async (path: string, schema: { parse: (v: unknown) => unknown }) => {
    const id = Number(/\/releases\/(\d+)/.exec(path)?.[1] ?? 0)
    return schema.parse({ id, extraartists: creditsByRelease[id] ?? [] })
  })
  return { client: { get } as unknown as DiscogsClient, get }
}

const plank = (role = 'Producer'): Credit => ({ id: 55, name: 'Conny Plank', role })

async function seed(items: CollectionItem[]) {
  const db = await openFidelityDb()
  for (const item of items) await db.put('collection', item)
  return db
}

describe('harvesting credits off the favourites', () => {
  it('reads only records rated highly', async () => {
    await seed([
      record({ releaseId: 1, rating: 5 }),
      record({ releaseId: 2, rating: 4 }),
      record({ releaseId: 3, rating: 3 }),
      record({ releaseId: 4, rating: 0 }),
    ])

    const { client: api, get } = client({})
    const harvest = await harvestCredits({ client: api })

    // 2.412 records would be 2.412 requests and exactly the loop CLAUDE.md
    // rule 2 forbids. The favourites are a few hundred.
    expect(get).toHaveBeenCalledTimes(2)
    expect(harvest.totalFavourites).toBe(2)
    expect(MIN_RATING).toBe(4)
  })

  it('counts a person once per record, not once per role', async () => {
    await seed([record({ releaseId: 1 }), record({ releaseId: 2 })])
    const { client: api } = client({
      1: [plank('Producer'), plank('Mixed By'), plank('Engineer')],
      2: [plank('Producer')],
    })

    const harvest = await harvestCredits({ client: api })
    const person = harvest.people.find((p) => p.entityId === 55)
    // Doubling every producer who also mixes would be most of them.
    expect(person?.appearances).toBe(2)
    expect(person?.roles.length).toBeGreaterThan(1)
  })

  it('ignores credits that say nothing about how a record sounds', async () => {
    await seed([record({ releaseId: 1 })])
    const { client: api } = client({
      1: [
        { id: 90, name: 'Fotograf', role: 'Photography By' },
        { id: 91, name: 'Grafiker', role: 'Design' },
        plank(),
      ],
    })

    const harvest = await harvestCredits({ client: api })
    expect(harvest.people.map((p) => p.entityId)).toEqual([55])
  })

  it('resumes rather than restarting', async () => {
    await seed([record({ releaseId: 1 }), record({ releaseId: 2 })])

    const first = client({ 1: [plank()], 2: [plank()] })
    await harvestCredits({ client: first.client, limit: 1 })
    expect(first.get).toHaveBeenCalledTimes(1)

    const second = client({ 1: [plank()], 2: [plank()] })
    const harvest = await harvestCredits({ client: second.client })
    // The second run reads the record the first did not, and nothing else.
    expect(second.get).toHaveBeenCalledTimes(1)
    expect(harvest.people.find((p) => p.entityId === 55)?.appearances).toBe(2)
  })

  it('writes after every record, so a closed tab costs one request', async () => {
    await seed([record({ releaseId: 1 }), record({ releaseId: 2 })])
    const { client: api } = client({ 1: [plank()], 2: [plank()] })

    await harvestCredits({ client: api, limit: 1 })
    const stored = await getMeta('credits')
    expect(stored?.harvestedReleaseIds).toHaveLength(1)
  })

  it('does not stall forever on a release that will not load', async () => {
    await seed([record({ releaseId: 1 }), record({ releaseId: 2 })])

    const get = vi.fn(async (path: string, schema: { parse: (v: unknown) => unknown }) => {
      if (path.includes('/releases/1')) throw new Error('404')
      return schema.parse({ id: 2, extraartists: [plank()] })
    })
    await harvestCredits({ client: { get } as unknown as DiscogsClient })

    const stored = await getMeta('credits')
    expect(stored?.harvestedReleaseIds.sort()).toEqual([1, 2])
  })

  it('reports progress with a subject', async () => {
    await seed([record({ releaseId: 1, title: 'Wuppdeck' })])
    const { client: api } = client({ 1: [plank()] })

    const seenTitles: string[] = []
    await harvestCredits({ client: api, report: (p) => seenTitles.push(p.current) })
    expect(seenTitles).toContain('Wuppdeck')
  })
})

describe('which harvested people are worth expanding', () => {
  const harvest = (appearances: number[]): CreditHarvest => ({
    harvestedAt: 1,
    harvestedReleaseIds: [1],
    totalFavourites: 1,
    people: appearances.map((n, i) => ({
      entityId: 100 + i,
      name: `Person ${i}`,
      appearances: n,
      roles: ['Producer'],
    })),
  })

  it('needs three of your favourites, not one', () => {
    // One is a coincidence; three is a hand.
    expect(creditCandidates(harvest([1, 2, 3]), new Set()).map((c) => c.id)).toEqual([102])
    expect(MIN_APPEARANCES).toBe(3)
  })

  it('leaves out anybody the collection already selects as an artist', () => {
    // Expanding them twice would be the same chunk under the same key.
    expect(creditCandidates(harvest([5]), new Set([100]))).toEqual([])
  })

  it('says nothing before a harvest has run', () => {
    expect(creditCandidates(null, new Set())).toEqual([])
  })

  it('offers them as artist entities, because that is what they are', () => {
    const [candidate] = creditCandidates(harvest([9]), new Set())
    expect(candidate).toMatchObject({ kind: 'artist', id: 100, owned: 9 })
  })
})
