import { describe, expect, it } from 'vitest'

import { norm } from '~~/worker/match/normalize'
import { similarity, trigrams, TrigramIndex } from '~~/worker/match/trigram'

describe('trigrams', () => {
  it('pads each word the way pg_trgm does', () => {
    // "  ab " → "  a", " ab", "ab "
    expect([...trigrams('ab')]).toEqual(['  a', ' ab', 'ab '])
  })

  it('treats a multi-word name as the union of its words', () => {
    expect(trigrams('neu 2').size).toBeGreaterThan(trigrams('neu').size)
  })

  it('ignores an empty string', () => {
    expect(trigrams('').size).toBe(0)
  })
})

describe('similarity', () => {
  it('is 1 for identical names and 0 for two empty ones', () => {
    expect(similarity('kraftwerk', 'kraftwerk')).toBe(1)
    expect(similarity('', '')).toBe(0)
  })

  it('is symmetric', () => {
    expect(similarity('kraftwerk', 'kraftwerke')).toBeCloseTo(
      similarity('kraftwerke', 'kraftwerk'),
    )
  })

  it('rates a typo high and two different artists low', () => {
    expect(similarity(norm('Kraftwerk'), norm('Kraftwrek'))).toBeGreaterThan(0.4)
    expect(similarity(norm('Kraftwerk'), norm('Can'))).toBeLessThan(0.1)
  })

  it('does not confuse an artist with its disambiguated namesake', () => {
    // They are similar as strings, which is exactly why stage 3 has a high
    // threshold: 0.85 keeps these apart.
    expect(similarity(norm('Nirvana'), norm('Nirvana (2)'))).toBeLessThan(0.85)
  })
})

describe('TrigramIndex', () => {
  const index = new TrigramIndex(
    ['kraftwerk', 'neu', 'harmonia', 'cluster'].map((key) => ({ key, value: key })),
  )

  it('finds the closest entry above the threshold', () => {
    expect(index.best('kraftwerk', 0.85)?.value).toBe('kraftwerk')
  })

  it('returns nothing when everything is too far away', () => {
    expect(index.best('miles davis', 0.85)).toBeNull()
  })

  it('returns nothing for an empty candidate', () => {
    expect(index.best('', 0.85)).toBeNull()
  })

  it('is the same answer as the pairwise function', () => {
    const hit = index.best('kraftwer', 0.4)
    expect(hit?.value).toBe('kraftwerk')
    expect(hit?.similarity).toBeCloseTo(similarity('kraftwer', 'kraftwerk'))
  })
})
