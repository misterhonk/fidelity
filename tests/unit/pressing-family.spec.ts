import { describe, expect, it } from 'vitest'

import { pressingFamily, yearOf } from '~~/worker/pressing-family'

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

describe('the small readers', () => {
  it('reads a year off a date, and nothing off "0"', () => {
    expect(yearOf('1994-08-22')).toBe(1994)
    expect(yearOf('1994')).toBe(1994)
    expect(yearOf('0')).toBeNull()
    expect(yearOf(undefined)).toBeNull()
  })
})
