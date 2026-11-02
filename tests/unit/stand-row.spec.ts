import { describe, expect, it } from 'vitest'

import type { Match } from '#shared/types'
import { standRow } from '~/utils/stand-row'
import { asShown } from '~~/db/expire'

/**
 * A stand's row at a record fair (#241).
 *
 * The lists are read at home in the morning and walked at the fair in the
 * afternoon, past their six hours. What a row may still say then: the
 * catalogue facts, the reason, the link — and the user's own max price, which
 * is theirs and no marketplace data (rule 4).
 */

const HOUR = 60 * 60 * 1000
const NOW = 1_800_000_000_000

const find = {
  digId: '01FAIR',
  listingId: 4_100_000_001,
  releaseId: 100_000_001,
  score: 88,
  signals: [],
  title: 'Maiden Voyage',
  artist: 'Herbie Hancock',
  label: 'Blue Note',
  catno: 'BLP 4195',
  format: 'Vinyl, LP',
  year: 1965,
  condition: 'Very Good Plus (VG+)',
  sleeve: 'Very Good (VG)',
  price: 18,
  currency: 'EUR',
  comments: null,
  thumbUrl: null,
  marketLowestPrice: null,
  marketNumForSale: null,
  expired: false,
} satisfies Match

describe("a stand's row", () => {
  it('keeps the price while the list is fresh, and no ceiling beside it', () => {
    const row = standRow(asShown(find, NOW + HOUR, NOW), 25)
    expect(row).toEqual({
      price: 18,
      currency: 'EUR',
      facts: 'Blue Note · BLP 4195 · 1965',
      maxPrice: null,
    })
  })

  it('past six hours hides price and condition and offers your own max price', () => {
    const shown = asShown(find, NOW - 2 * HOUR, NOW)
    expect(shown).toMatchObject({ price: null, condition: null, sleeve: null, expired: true })

    const row = standRow(shown, 25)
    expect(row).toEqual({
      price: null,
      currency: null,
      facts: 'Blue Note · BLP 4195 · 1965',
      maxPrice: 25,
    })
  })

  it('never shows a price on an expired row, even one a sweep has not reached', () => {
    expect(standRow({ ...find, expired: true }, null)).toMatchObject({
      price: null,
      maxPrice: null,
    })
  })

  it('says only the catalogue facts it has', () => {
    expect(standRow({ ...find, label: null, catno: null }, null).facts).toBe('1965')
  })
})
