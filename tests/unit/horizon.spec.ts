import { describe, expect, it } from 'vitest'

import type { CollectionItem, WantlistItem } from '#shared/types'
import { indexOfRelease, packChunk, parseCatno, roleIndex } from '~~/worker/horizon/pack'
import { selectCandidates } from '~~/worker/horizon/select'

function record(overrides: Partial<CollectionItem> = {}): CollectionItem {
  return {
    releaseId: 1,
    masterId: 0,
    title: 'Platte',
    artistIds: [100],
    artistNorms: [],
    artistNames: ['Robag Wruhme'],
    labelIds: [500],
    labelNorms: [],
    labelNames: ['Musik Krause'],
    catnos: [],
    genres: [],
    styles: [],
    formats: [],
    year: 2004,
    rating: 0,
    addedAt: '',
    ...overrides,
  }
}

describe('choosing what to expand', () => {
  it('takes an artist you own twice, not one you own once', () => {
    const candidates = selectCandidates(
      [
        record({ releaseId: 1, artistIds: [100], artistNames: ['Robag Wruhme'] }),
        record({ releaseId: 2, artistIds: [100], artistNames: ['Robag Wruhme'] }),
        record({ releaseId: 3, artistIds: [101], artistNames: ['Einmalig'] }),
      ],
      [],
    )

    const artists = candidates.filter((c) => c.kind === 'artist')
    expect(artists.map((c) => c.name)).toEqual(['Robag Wruhme'])
  })

  it('takes every wantlist album that has a master', () => {
    const wantlist = [
      { ...record({ releaseId: 900, masterId: 77, title: 'Dummy' }) },
      // No master: there is nothing to ask for all pressings of.
      { ...record({ releaseId: 901, masterId: 0 }) },
    ] as unknown as WantlistItem[]

    const masters = selectCandidates([], wantlist).filter((c) => c.kind === 'master')
    expect(masters).toEqual([{ kind: 'master', id: 77, name: 'Dummy', owned: 1 }])
  })

  it('puts wantlist masters first, then whatever you own most of', () => {
    const collection = [
      record({ releaseId: 1, artistIds: [100], artistNames: ['Zwei'] }),
      record({ releaseId: 2, artistIds: [100], artistNames: ['Zwei'] }),
      record({ releaseId: 3, artistIds: [102], artistNames: ['Drei'] }),
      record({ releaseId: 4, artistIds: [102], artistNames: ['Drei'] }),
      record({ releaseId: 5, artistIds: [102], artistNames: ['Drei'] }),
    ]
    const wantlist = [
      { ...record({ releaseId: 900, masterId: 77 }) },
    ] as unknown as WantlistItem[]

    // An interrupted run should already have done the most valuable part.
    const order = selectCandidates(collection, wantlist).map((c) => `${c.kind}:${c.name}`)
    expect(order[0]).toBe('master:Platte')
    expect(order.indexOf('artist:Drei')).toBeLessThan(order.indexOf('artist:Zwei'))
  })

  it('counts a release once per entity even when it names it twice', () => {
    const candidates = selectCandidates(
      [record({ artistIds: [100, 100], artistNames: ['Robag Wruhme', 'Robag Wruhme'] })],
      [],
    )
    expect(candidates.filter((c) => c.kind === 'artist')).toHaveLength(0)
  })
})

describe('catalogue numbers', () => {
  it.each([
    ['BLP 4058', 'BLP', 4058],
    ['brain 1028', 'BRAIN', 1028],
    ['MK 02', 'MK', 2],
    ['COR12176', 'COR', 12176],
    ['imr33lp', 'IMR', 33],
  ])('%s → %s %i', (input, prefix, num) => {
    expect(parseCatno(input)).toEqual({ prefix, num })
  })

  it('gives up rather than guessing at the messy ones', () => {
    // A wrong series is worse than no series.
    expect(parseCatno('none')).toBeNull()
    expect(parseCatno('')).toBeNull()
    expect(parseCatno(undefined)).toBeNull()
  })
})

describe('roles', () => {
  it('maps the ones that matter for the credit graph', () => {
    expect(roleIndex('Main')).toBe(0)
    expect(roleIndex('Producer')).toBe(1)
    expect(roleIndex('Remix')).toBe(5)
  })

  it('treats an unfamiliar role as a main credit rather than dropping the edge', () => {
    expect(roleIndex('Photography By')).toBe(0)
    expect(roleIndex(undefined)).toBe(0)
  })
})

describe('packing a chunk', () => {
  const chunk = packChunk(
    'label',
    500,
    'Brain',
    [
      { releaseId: 300, role: 0, year: 1973, catnoNum: 1031, catnoPrefix: 'BRAIN' },
      { releaseId: 100, role: 0, year: 1972, catnoNum: 1001, catnoPrefix: 'BRAIN' },
      { releaseId: 200, role: 0, year: 1974, catnoNum: 1042, catnoPrefix: 'BRAIN' },
    ],
    { fetchedAt: 42, complete: true, requests: 2 },
  )

  it('sorts the ids so they can be searched and compress', () => {
    expect([...chunk.releaseIds]).toEqual([100, 200, 300])
    expect([...chunk.years]).toEqual([1972, 1974, 1973])
  })

  it('uses TypedArrays, not object lists', () => {
    expect(chunk.releaseIds).toBeInstanceOf(Int32Array)
    expect(chunk.roles).toBeInstanceOf(Uint8Array)
    expect(chunk.years).toBeInstanceOf(Int16Array)
  })

  it('keeps the dominant catalogue prefix and its numbers', () => {
    expect(chunk.catnoPrefix).toBe('BRAIN')
    expect([...(chunk.catnoNums ?? [])]).toEqual([1001, 1042, 1031])
  })

  it('keeps the strongest role when an artist appears twice on one release', () => {
    const twice = packChunk(
      'artist',
      100,
      'Conny Plank',
      [
        { releaseId: 10, role: 1, year: 1973 },
        { releaseId: 10, role: 0, year: 1973 },
      ],
      { fetchedAt: 0, complete: true, requests: 1 },
    )
    expect([...twice.releaseIds]).toEqual([10])
    expect([...twice.roles]).toEqual([0])
  })

  it('treats an impossible year as unknown', () => {
    const odd = packChunk('artist', 1, 'X', [{ releaseId: 1, role: 0, year: 99999 }], {
      fetchedAt: 0,
      complete: true,
      requests: 1,
    })
    expect(odd.years[0]).toBe(0)
  })

  it('finds a release by binary search, and says so when it is absent', () => {
    expect(indexOfRelease(chunk, 200)).toBe(1)
    expect(indexOfRelease(chunk, 999)).toBe(-1)
  })
})

describe('what "complete" is allowed to mean', () => {
  it('is decided by what arrived, not by the page header', async () => {
    // Discogs' pagination is a claim, not a promise. A label that reports
    // 1.499 releases and yields 947 distinct ones over all its pages is not
    // complete, however tidy the arithmetic looks.
    const { expandEntity } = await import('~~/worker/horizon/expand')

    let page = 0
    const client = {
      get: async (_path: string, schema: { parse: (v: unknown) => unknown }) => {
        page += 1
        return schema.parse({
          pagination: { page, pages: 3, items: 300 },
          // Every page returns the same fifty releases — the duplication that
          // makes a claimed 300 collapse to 50.
          releases: Array.from({ length: 50 }, (_, i) => ({ id: i + 1, catno: `X ${i}` })),
        })
      },
    }

    const result = await expandEntity(
      { kind: 'label', id: 1, name: 'Cocoon Recordings', owned: 6 },
      { client: client as never, now: () => 0 },
    )

    expect(result.catalogueSize).toBe(300)
    expect(result.chunk.releaseIds.length).toBe(50)
    expect(result.chunk.complete).toBe(false)
  })

  it('tolerates a few duplicates without crying incomplete', async () => {
    const { expandEntity } = await import('~~/worker/horizon/expand')

    const client = {
      get: async (_path: string, schema: { parse: (v: unknown) => unknown }) =>
        schema.parse({
          pagination: { page: 1, pages: 1, items: 100 },
          releases: Array.from({ length: 100 }, (_, i) => ({ id: i + 1 })),
        }),
    }

    const result = await expandEntity(
      { kind: 'label', id: 1, name: 'Border Community', owned: 5 },
      { client: client as never, now: () => 0 },
    )

    expect(result.chunk.complete).toBe(true)
  })
})
