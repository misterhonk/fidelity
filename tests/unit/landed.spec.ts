import { describe, expect, it } from 'vitest'

import type { LandedContext, Match, ShippingTier } from '#shared/types'
import { landedPrice } from '#shared/shipping'

/**
 * The landed price: price plus the postage this record adds to the parcel.
 *
 * The number people asked for most, after "which seller has most of my
 * wantlist" — Discogs shows postage only in its cart, and a list sorted by
 * price alone puts a €4 record from a shop that charges €9 to ship ahead of a
 * €7 one that is already in a parcel. `docs/06` M19 has the ranking; this is
 * the arithmetic it rests on.
 */

function tier(minItems: number, maxItems: number | null, price: number): ShippingTier {
  return { minItems, maxItems, price, currency: 'EUR', source: 'parsed' }
}

/** 1 LP: €6, 2–3 LP: €9, 4+: €12 — the shape most German shops write. */
const TIERS = [tier(1, 1, 6), tier(2, 3, 9), tier(4, null, 12)]

function context(over: Partial<LandedContext> = {}): LandedContext {
  return {
    dealer: 'fatplastics',
    tiers: TIERS,
    source: 'parsed',
    section: null,
    inBasket: 0,
    listingIds: [],
    currency: 'EUR',
    ...over,
  }
}

function match(over: Partial<Match> = {}): Match {
  return {
    digId: '01A',
    listingId: 1,
    releaseId: 1,
    score: 50,
    signals: [],
    title: 'Platte',
    artist: 'Beta',
    label: null,
    catno: null,
    format: '12"',
    year: 2000,
    condition: null,
    sleeve: null,
    price: 10,
    currency: 'EUR',
    comments: null,
    thumbUrl: null,
    marketLowestPrice: null,
    marketNumForSale: null,
    expired: false,
    ...over,
  }
}

describe('the landed price', () => {
  it('carries the whole first tier when the parcel is empty', () => {
    expect(landedPrice(match(), context())).toEqual({
      total: 16,
      postage: 6,
      currency: 'EUR',
      items: 1,
      source: 'parsed',
    })
  })

  it('adds only what the next tier costs on top of the current one', () => {
    // One record in the parcel pays €6; the second moves the parcel to the
    // €9 tier, so this record adds €3 — not €9, and not €4.50.
    expect(landedPrice(match(), context({ inBasket: 1, listingIds: [9] }))?.postage).toBe(3)
  })

  it('adds nothing inside a tier', () => {
    // Two in the parcel already pay the 2–3 tier; a third rides for free.
    const landed = landedPrice(match(), context({ inBasket: 2, listingIds: [8, 9] }))
    expect(landed).toMatchObject({ total: 10, postage: 0, items: 3 })
  })

  it('does not charge a record that is already in the parcel twice', () => {
    // Listing 1 is in the basket alone. Its landed price is what it added
    // when it went in — the first tier — not the second tier's step.
    expect(landedPrice(match(), context({ inBasket: 1, listingIds: [1] }))).toMatchObject({
      postage: 6,
      items: 1,
    })
  })

  it('says nothing when there is nothing to say', () => {
    // No table for this shop.
    expect(landedPrice(match(), context({ tiers: [] }))).toBeNull()
    // No shop context at all — the shared-list screen, the stack.
    expect(landedPrice(match(), null)).toBeNull()
    // The dig has expired and the price is gone with it (docs/03 §6).
    expect(landedPrice(match({ price: null }), context())).toBeNull()
  })

  it('refuses to add pounds to euros', () => {
    // Compared, never converted — the same refusal as the basket and S10.
    expect(landedPrice(match({ currency: 'GBP' }), context())).toBeNull()
  })

  it('stops where the table stops', () => {
    // A table that ends at three records says nothing about a fourth.
    const short = context({ tiers: [tier(1, 1, 6), tier(2, 3, 9)], inBasket: 3 })
    expect(landedPrice(match(), short)).toBeNull()
    // And nothing about the parcel as it stands, if that is already past it.
    const past = context({ tiers: [tier(1, 1, 6)], inBasket: 2, listingIds: [8, 9] })
    expect(landedPrice(match(), past)).toBeNull()
  })
})
