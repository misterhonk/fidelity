import { describe, expect, it } from 'vitest'

import type { CollectionItem } from '#shared/types'
import { computeTasteProfile, topFacets } from '~~/worker/match/taste'

function item(overrides: Partial<CollectionItem> = {}): CollectionItem {
  return {
    releaseId: 1,
    masterId: 0,
    title: 'Neu! 2',
    artistIds: [1],
    artistNorms: ['neu'],
    artistNames: ['Neu!'],
    labelIds: [5],
    labelNorms: ['brain'],
    labelNames: ['Brain'],
    catnos: ['BRAIN 1031'],
    genres: ['Electronic'],
    styles: ['Krautrock'],
    formats: ['Vinyl', 'LP'],
    year: 1973,
    rating: 0,
    addedAt: '2026-08-01T00:00:00-07:00',
    ...overrides,
  }
}

describe('the taste profile', () => {
  it('counts a facet once per release, not once per mention', () => {
    const profile = computeTasteProfile(
      [item({ releaseId: 1, artistIds: [1, 1], artistNames: ['Neu!', 'Neu!'] })],
      0,
    )

    expect(profile.artists['1']?.n).toBe(1)
  })

  it('weights facets against the size of the collection', () => {
    const profile = computeTasteProfile(
      [
        item({ releaseId: 1 }),
        item({ releaseId: 2 }),
        item({ releaseId: 3, labelIds: [9], labelNames: ['Ohr'], labelNorms: ['ohr'] }),
      ],
      0,
    )

    expect(profile.releaseCount).toBe(3)
    expect(profile.labels['5']).toMatchObject({ name: 'Brain', n: 2 })
    expect(profile.labels['5']?.weight).toBeCloseTo(2 / 3)
    expect(profile.labels['9']?.weight).toBeCloseTo(1 / 3)
  })

  it('leaves lift null rather than inventing a denominator', () => {
    const profile = computeTasteProfile([item()], 0)
    expect(profile.labels['5']?.lift).toBeNull()
    expect(profile.artists['1']?.lift).toBeNull()
  })

  it('buckets years into decades and ignores the ones Discogs does not know', () => {
    const profile = computeTasteProfile(
      [
        item({ releaseId: 1, year: 1973 }),
        item({ releaseId: 2, year: 1978 }),
        item({ releaseId: 3, year: 1981 }),
        item({ releaseId: 4, year: 0 }),
      ],
      0,
    )

    expect(profile.decades['1970']).toMatchObject({ name: '1970er', n: 2 })
    expect(profile.decades['1980']?.n).toBe(1)
    // Year 0 means "unknown", not "the zeroth decade".
    expect(profile.decades['0']).toBeUndefined()
  })

  it('produces a unit-length style centroid for the cosine work in M3', () => {
    const profile = computeTasteProfile(
      [
        item({ releaseId: 1, styles: ['Krautrock'] }),
        item({ releaseId: 2, styles: ['Krautrock', 'Ambient'] }),
      ],
      0,
    )

    const length = Math.hypot(...Object.values(profile.styleCentroid))
    expect(length).toBeCloseTo(1)
  })

  it('survives an empty collection without dividing by zero', () => {
    const profile = computeTasteProfile([], 0)

    expect(profile.releaseCount).toBe(0)
    expect(profile.artists).toEqual({})
    expect(profile.styleCentroid).toEqual({})
  })

  it('is a pure function of its input', () => {
    const items = [item({ releaseId: 1 }), item({ releaseId: 2 })]
    expect(computeTasteProfile(items, 42)).toEqual(computeTasteProfile(items, 42))
  })

  it('ranks the strongest facets first, ties alphabetically', () => {
    const profile = computeTasteProfile(
      [
        item({ releaseId: 1, styles: ['Krautrock'] }),
        item({ releaseId: 2, styles: ['Krautrock'] }),
        item({ releaseId: 3, styles: ['Ambient'] }),
        item({ releaseId: 4, styles: ['Minimal'] }),
      ],
      0,
    )

    expect(topFacets(profile.styles, 3).map((facet) => facet.name)).toEqual([
      'Krautrock',
      'Ambient',
      'Minimal',
    ])
  })
})
