import { describe, expect, it, vi } from 'vitest'

import { familyFacts, pressingFamily, yearOf } from '~~/worker/pressing-family'
import type { HubClient } from '~~/worker/hub/client'
import type { CatalogueSource } from '#shared/ports'

/**
 * The pressing in your hand, among all the others (docs/06 M19 #7).
 *
 * M7 reads a pressing for the top finds of a dig, against a first year the
 * horizon supplies — so it reaches as far as the collection does. A record
 * identified in a shop is usually beyond that. Here the album's own versions
 * list stands in: one request, sorted by release date, and the reading says
 * how many pressings exist, which came first, and where this one stands.
 */

function fakeClient(answers: Record<string, unknown>) {
  const calls: { path: string; query?: Record<string, unknown> }[] = []
  return {
    calls,
    client: {
      get: async (
        path: string,
        schema: { parse: (v: unknown) => unknown },
        options?: { query?: Record<string, unknown> },
      ) => {
        calls.push({ path, query: options?.query })
        const answer = answers[path]
        if (answer === undefined) throw new Error(`no answer for ${path}`)
        if (answer instanceof Error) throw answer
        return schema.parse(answer)
      },
    } as never,
  }
}

/** Dummy, as measured 2026-09-11: 160 pressings, the first from 1994. */
const versions = {
  pagination: { page: 1, pages: 2, items: 160 },
  versions: [
    {
      id: 1065562,
      released: '1994',
      country: 'India',
      label: 'Go! Beat',
      catno: '828 553-4',
      format: 'Album',
      major_formats: ['Cassette'],
    },
    {
      id: 4033175,
      released: '1994',
      country: 'Europe',
      label: 'Go! Beat',
      catno: '828 522-2',
      format: 'Album, Stereo',
      major_formats: ['CD'],
    },
    {
      id: 372340,
      released: '1994-08-22',
      country: 'UK',
      label: 'Go! Beat',
      catno: '828 553-1',
      format: 'Album',
      major_formats: ['Vinyl'],
    },
    {
      id: 372341,
      released: '0',
      country: 'Europe',
      label: 'Go! Beat',
      catno: '828 553-1',
      format: 'Album, Unofficial',
      major_formats: ['Vinyl'],
    },
    {
      id: 10147986,
      released: '2017-11-03',
      country: 'Europe',
      label: 'Go! Beat',
      catno: '0602557150995',
      format: 'Album, Reissue',
      major_formats: ['Vinyl'],
    },
  ],
}

const reissue = {
  id: 10147986,
  master_id: 5542,
  country: 'Europe',
  year: 2017,
  released: '2017-11-03',
  formats: [{ name: 'Vinyl', descriptions: ['LP', 'Album', 'Reissue'] }],
  identifiers: [{ type: 'Matrix / Runout', value: 'STERLING 828 553-1 A1' }],
}

describe('placing a pressing among its family', () => {
  it('reads the release, then the versions earliest first — two requests', async () => {
    const { client, calls } = fakeClient({
      '/releases/10147986': reissue,
      '/masters/5542/versions': versions,
    })

    const family = await pressingFamily(client, 10147986)

    expect(calls.map((c) => c.path)).toEqual(['/releases/10147986', '/masters/5542/versions'])
    expect(calls[1]?.query).toMatchObject({ sort: 'released', sort_order: 'asc' })
    expect(family).toMatchObject({
      masterId: 5542,
      total: 160,
      firstYear: 1994,
      amongFirst: false,
    })
  })

  it('knows the first year without a horizon — that is what M7 lacked', async () => {
    const { client } = fakeClient({
      '/releases/10147986': reissue,
      '/masters/5542/versions': versions,
    })
    const family = await pressingFamily(client, 10147986)

    expect(family?.profile.masterYear).toBe(1994)
    expect(family?.profile.yearGap).toBe(23)
    // Stated by Discogs, so it is the strong warning, with the original's year.
    expect(family?.warnings.map((w) => w.kind)).toEqual(['reissue'])
    expect(family?.warnings[0]?.facts.masterYear).toBe(1994)
    expect(family?.profile.stamps.map((s) => s.key)).toEqual(['STERLING'])
  })

  it('lists the first pressings on the same medium, not the cassette from India', async () => {
    const { client } = fakeClient({
      '/releases/10147986': reissue,
      '/masters/5542/versions': versions,
    })
    const family = await pressingFamily(client, 10147986)

    expect(family?.first.map((s) => s.releaseId)).toEqual([372340])
    expect(family?.first[0]).toMatchObject({
      country: 'UK',
      label: 'Go! Beat',
      catno: '828 553-1',
    })
  })

  it('says so when the one in your hand is among the first', async () => {
    const { client } = fakeClient({
      '/releases/372340': {
        id: 372340,
        master_id: 5542,
        country: 'UK',
        year: 1994,
        formats: [{ name: 'Vinyl', descriptions: ['LP', 'Album'] }],
      },
      '/masters/5542/versions': versions,
    })
    const family = await pressingFamily(client, 372340)

    expect(family?.amongFirst).toBe(true)
    expect(family?.warnings).toEqual([])
  })

  it('is only itself without a master, and still reads the pressing', async () => {
    const { client, calls } = fakeClient({
      '/releases/7': { id: 7, country: 'Germany', year: 1973, formats: [{ name: 'Vinyl' }] },
    })
    const family = await pressingFamily(client, 7)

    expect(calls).toHaveLength(1)
    expect(family).toMatchObject({ masterId: null, total: 0, firstYear: null, first: [] })
    expect(family?.profile.country).toBe('Germany')
  })

  it('keeps the reading when only the versions fail', async () => {
    const { client } = fakeClient({
      '/releases/10147986': reissue,
      '/masters/5542/versions': new Error('502'),
    })
    const family = await pressingFamily(client, 10147986)

    expect(family?.total).toBe(0)
    expect(family?.profile.statedReissue).toBe(true)
  })

  it('is null, not an error, when Discogs will not answer at all', async () => {
    const { client } = fakeClient({ '/releases/1': new Error('offline') })
    expect(await pressingFamily(client, 1)).toBeNull()
  })
})

/**
 * Through the hub (M20 #7): a family somebody else fetched costs no request;
 * a fresh one is offered back; a month-old one is a miss.
 */
describe('the family through the hub', () => {
  const fakeHub = (cached: unknown) => {
    const offered: unknown[] = []
    return {
      offered,
      hub: {
        family: async () => cached,
        contributeFamily: async (family: unknown) => {
          offered.push(family)
        },
      } as unknown as HubClient,
    }
  }

  it('takes a fresh family from the hub and asks Discogs nothing', async () => {
    const { client, calls } = fakeClient({ '/releases/10147986': reissue })
    const { hub } = fakeHub({
      masterId: 5542,
      total: 160,
      fetchedAt: 900,
      siblings: [
        {
          releaseId: 372340,
          year: 1994,
          country: 'UK',
          label: 'Go! Beat',
          catno: '828 553-1',
          format: 'Vinyl, Album',
        },
      ],
    })

    const family = await pressingFamily(client, 10147986, { hub, now: () => 1000 })

    expect(calls.map((c) => c.path)).toEqual(['/releases/10147986'])
    expect(family?.total).toBe(160)
    expect(family?.firstYear).toBe(1994)
  })

  it('treats a month-old family as a miss, and offers the fresh one back', async () => {
    const { client } = fakeClient({ '/masters/5542/versions': versions })
    const { hub, offered } = fakeHub({ masterId: 5542, total: 1, fetchedAt: 0, siblings: [] })
    const DAY = 24 * 60 * 60 * 1000

    const facts = await familyFacts(client, 5542, { hub, now: () => 31 * DAY })

    expect(facts.total).toBe(160)
    // Fire-and-forget on the way out: give it a tick.
    await new Promise((done) => setTimeout(done, 0))
    expect(offered).toHaveLength(1)
    expect((offered[0] as { fetchedAt: number }).fetchedAt).toBe(31 * DAY)
  })

  it('works exactly as before without a hub', async () => {
    const { client, calls } = fakeClient({ '/masters/5542/versions': versions })
    const facts = await familyFacts(client, 5542, { hub: null, now: () => 5 })
    expect(calls).toHaveLength(1)
    expect(facts).toMatchObject({ masterId: 5542, total: 160, fetchedAt: 5 })
  })
})

/**
 * Through the catalogue first (ADR-013, docs/16 §6): the dump's answer is
 * good for the month and the same for everybody, so it is taken before the
 * hub and offered nowhere. A catalogue that does not know is the old path.
 */
describe('the family through the catalogue', () => {
  const catalogueWith = (family: unknown) =>
    ({ family: async () => family }) as unknown as CatalogueSource

  it('takes the family from the catalogue and asks neither hub nor Discogs', async () => {
    const { client, calls } = fakeClient({})
    const hub = { family: vi.fn(async () => null), contributeFamily: vi.fn() }
    const catalogue = catalogueWith({ masterId: 5542, total: 160, fetchedAt: 0, siblings: [] })

    const facts = await familyFacts(client, 5542, {
      hub: hub as unknown as HubClient,
      catalogue,
      now: () => 5,
    })

    expect(facts.total).toBe(160)
    expect(calls).toHaveLength(0)
    expect(hub.family).not.toHaveBeenCalled()
    expect(hub.contributeFamily).not.toHaveBeenCalled()
  })

  it('falls through to Discogs when the catalogue does not know', async () => {
    const { client, calls } = fakeClient({ '/masters/5542/versions': versions })
    const facts = await familyFacts(client, 5542, {
      hub: null,
      catalogue: catalogueWith(null),
      now: () => 5,
    })
    expect(calls).toHaveLength(1)
    expect(facts.total).toBe(160)
  })
})

describe('the small readers', () => {
  it('reads a year off a date, and nothing off "0"', () => {
    expect(yearOf('1994-08-22')).toBe(1994)
    expect(yearOf('1994')).toBe(1994)
    expect(yearOf('0')).toBeNull()
    expect(yearOf(undefined)).toBeNull()
  })
})
