import { describe, expect, it } from 'vitest'

import type { Match } from '#shared/types'
import { bestPerRelease, topFive } from '~~/worker/match/select'

function match(overrides: Partial<Match> & { listingId: number }): Match {
  return {
    digId: '01A',
    releaseId: overrides.listingId,
    score: 50,
    signals: [{ type: 'ARTIST_KNOWN', confidence: 1, evidence: {} }],
    reason: '',
    title: 'Platte',
    artist: 'Trentemøller',
    label: null,
    catno: null,
    format: '12"',
    year: null,
    condition: 'Mint (M)',
    sleeve: null,
    price: 10,
    currency: 'EUR',
    comments: null,
    thumbUrl: null,
    marketLowestPrice: null,
    marketNumForSale: null,
    expired: false,
    ...overrides,
  }
}

describe('folding duplicate copies of the same record', () => {
  it('keeps the best-scoring copy', () => {
    const { matches, folded } = bestPerRelease([
      match({ listingId: 1, releaseId: 500, score: 48 }),
      match({ listingId: 2, releaseId: 500, score: 87 }),
    ])

    expect(matches).toHaveLength(1)
    expect(matches[0]?.listingId).toBe(2)
    expect(folded).toBe(1)
  })

  it('prefers the cheaper copy when the score is the same', () => {
    const { matches } = bestPerRelease([
      match({ listingId: 1, releaseId: 500, price: 30 }),
      match({ listingId: 2, releaseId: 500, price: 12 }),
    ])

    expect(matches[0]?.price).toBe(12)
  })

  it('treats a copy without a price as the last resort, not the cheapest', () => {
    const { matches } = bestPerRelease([
      match({ listingId: 1, releaseId: 500, price: null }),
      match({ listingId: 2, releaseId: 500, price: 30 }),
    ])

    expect(matches[0]?.price).toBe(30)
  })

  it('leaves two different records by the same artist alone', () => {
    // Three Trentemøller records you do not own is a finding, not noise.
    const { matches, folded } = bestPerRelease([
      match({ listingId: 1, releaseId: 500, title: 'Moan' }),
      match({ listingId: 2, releaseId: 501, title: 'Obverse' }),
      match({ listingId: 3, releaseId: 502, title: 'Into The Great Wide Yonder' }),
    ])

    expect(matches).toHaveLength(3)
    expect(folded).toBe(0)
  })

  it('is stable for identical scores and prices', () => {
    const { matches } = bestPerRelease([
      match({ listingId: 9, releaseId: 500 }),
      match({ listingId: 2, releaseId: 500 }),
    ])
    expect(matches[0]?.listingId).toBe(2)
  })
})

describe('the Top Five', () => {
  const spread = [
    match({ listingId: 1, releaseId: 1, score: 87, artist: 'Portishead' }),
    match({ listingId: 2, releaseId: 2, score: 52, artist: 'Trentemøller' }),
    match({ listingId: 3, releaseId: 3, score: 48, artist: 'Trentemøller' }),
    match({ listingId: 4, releaseId: 4, score: 48, artist: 'Trentemøller' }),
    match({ listingId: 5, releaseId: 5, score: 48, artist: 'James Holden' }),
    match({ listingId: 6, releaseId: 6, score: 48, artist: 'Robag Wruhme' }),
    match({ listingId: 7, releaseId: 7, score: 30, artist: 'Sven Väth' }),
  ]

  it('shows five different artists rather than the same name three times', () => {
    expect(topFive(spread).map((m) => m.artist)).toEqual([
      'Portishead',
      'Trentemøller',
      'James Holden',
      'Robag Wruhme',
      'Sven Väth',
    ])
  })

  it('still leads with the strongest match', () => {
    expect(topFive(spread)[0]?.score).toBe(87)
  })

  it('fills the remaining places when there are not enough artists', () => {
    const oneArtist = [
      match({ listingId: 1, releaseId: 1, score: 60 }),
      match({ listingId: 2, releaseId: 2, score: 50 }),
      match({ listingId: 3, releaseId: 3, score: 40 }),
    ]
    // An empty slot helps nobody.
    expect(topFive(oneArtist)).toHaveLength(3)
    expect(topFive(oneArtist).map((m) => m.score)).toEqual([60, 50, 40])
  })

  it('never returns more than five', () => {
    expect(topFive(spread)).toHaveLength(5)
  })

  it('copes with an empty result', () => {
    expect(topFive([])).toEqual([])
  })

  it('does not group everything under a missing artist name', () => {
    const anonymous = [
      match({ listingId: 1, releaseId: 1, artist: '', score: 60 }),
      match({ listingId: 2, releaseId: 2, artist: '', score: 50 }),
    ]
    expect(topFive(anonymous)).toHaveLength(2)
  })
})
