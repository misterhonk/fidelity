import { beforeEach, describe, expect, it, vi } from 'vitest'

import { openFidelityDb } from '~~/db/open'
import type { CatalogueSource } from '#shared/ports'
import type { TasteFacet, TasteProfile } from '#shared/types'
import { compareWithCatalogue, lifts } from '~~/worker/collection/compared'
import { identify, identifyByRunout } from '~~/worker/identify'

/**
 * The shop and the map through the catalogue (M21.6): a barcode or a
 * run-out is answered from the index without a search request, and the map
 * gets the denominator its lift slot waited for since M1. Without a
 * catalogue, or when it does not know, everything is as it was.
 */
const searched: string[] = []
const client = {
  get: async (path: string) => {
    searched.push(path)
    return { results: [{ id: 42, title: 'From the search', master_id: null }] }
  },
} as never

const RELEASE = {
  id: 1,
  title: 'Stockholm',
  year: 1999,
  country: 'Sweden',
  masterId: 1660109,
  artists: ['The Persuader'],
  labels: [{ name: 'Svek', catno: 'SK032' }],
  formats: ['Vinyl, 12"'],
}

function catalogue(ids: number[] | null) {
  return {
    identify: vi.fn(async () => ids),
    release: vi.fn(async (id: number) => (id === 1 ? RELEASE : null)),
  } as unknown as CatalogueSource
}

beforeEach(async () => {
  searched.length = 0
  const db = await openFidelityDb()
  await db.clear('collection')
  await db.clear('wantlist')
})

describe('identifying through the catalogue', () => {
  it('answers a run-out from the index and makes no search request', async () => {
    const found = await identifyByRunout(
      client,
      'MPO SK 032 A1 G PHRUPMASTERGENERAL',
      undefined,
      catalogue([1]),
    )
    expect(searched).toEqual([])
    expect(found.candidates).toEqual([
      {
        releaseId: 1,
        title: 'The Persuader - Stockholm',
        year: 1999,
        country: 'Sweden',
        thumbUrl: '',
        format: 'Vinyl, 12"',
        label: 'Svek',
        catno: 'SK032',
        masterId: 1660109,
      },
    ])
  })

  it('answers a barcode the same way', async () => {
    const found = await identify(client, '7 24384 56142 3', undefined, catalogue([1]))
    expect(searched).toEqual([])
    expect(found.candidates.map((c) => c.releaseId)).toEqual([1])
  })

  it('falls through to the search when the catalogue does not know, and without one', async () => {
    for (const source of [catalogue([]), catalogue(null), null]) {
      searched.length = 0
      const found = await identify(client, '724384561423', undefined, source)
      expect(searched).toEqual(['/database/search'])
      expect(found.candidates.map((c) => c.releaseId)).toEqual([42])
    }
  })
})

describe('the map against the catalogue', () => {
  const facet = (name: string, weight: number): TasteFacet => ({
    name,
    n: 1,
    weight,
    lift: null,
  })
  const stats = {
    build: '2026-09-01',
    total: 1000,
    rows: [
      ['1970', 100],
      ['1990', 400],
    ] as [string, number][],
  }

  it('divides the collection’s share by the catalogue’s', () => {
    const result = lifts(
      { 1970: facet('1970er', 0.3), 1990: facet('1990er', 0.4), 2020: facet('2020er', 0.1) },
      stats,
      (key) => key,
    )
    // 0.3 / 0.1 = 3; 0.4 / 0.4 = 1; the 2020s the catalogue does not carry get no lift.
    expect(result).toEqual({ 1970: 3, 1990: 1 })
  })

  it('is null without a catalogue, and null when it does not answer', async () => {
    const profile = { decades: {}, styles: {}, genres: {} } as unknown as TasteProfile
    expect(await compareWithCatalogue(profile, null)).toBeNull()
    expect(
      await compareWithCatalogue(null, {
        stats: async () => stats,
      } as unknown as CatalogueSource),
    ).toBeNull()
    const mute = { stats: vi.fn(async () => null) } as unknown as CatalogueSource
    expect(await compareWithCatalogue(profile, mute)).toBeNull()
  })

  it('names the build it measured against', async () => {
    const profile = {
      decades: { 1970: facet('1970er', 0.3) },
      styles: { Techno: facet('Techno', 0.5) },
      genres: { Electronic: facet('Electronic', 0.9) },
    } as unknown as TasteProfile
    const source = {
      stats: vi.fn(async (kind: string) =>
        kind === 'decades'
          ? stats
          : {
              build: '2026-09-01',
              total: 1000,
              rows: [[kind === 'styles' ? 'Techno' : 'Electronic', 250]],
            },
      ),
    } as unknown as CatalogueSource
    expect(await compareWithCatalogue(profile, source)).toEqual({
      build: '2026-09-01',
      decades: { 1970: 3 },
      styles: { Techno: 2 },
      genres: { Electronic: 3.6 },
    })
  })
})
