import { describe, expect, it } from 'vitest'

import type { BasketLine, Dealer } from '#shared/types'
import { summarise } from '~~/worker/basket'
import { freshPostage, namedPostage, postageOf, shipsHereOf } from '~~/worker/basket/postage'

/**
 * Postage as Discogs names it (M34.2).
 *
 * The shape below is the answer measured on 2026-09-16 on a real account
 * (docs/02 §5): a British shop, the account in Germany, `curr_abbr=EUR`.
 */
const measured = {
  shipping_price: { value: 14.108108108108109, currency: 'EUR' },
  original_shipping_price: {
    curr_abbr: 'GBP',
    curr_id: 2,
    formatted: '£12.00',
    value: 12,
    converted: { curr_abbr: 'USD', curr_id: 1, formatted: '$16.22', value: 16.22 },
  },
  shipping_is_blocked: null,
}

/** And what the same request says without a token — for everybody. */
const unauthenticated = { shipping_price: {}, shipping_is_blocked: true }

const line = (over: Partial<BasketLine> = {}): BasketLine => ({
  listingId: 1,
  dealer: 'londonwax',
  releaseId: 10,
  title: 'Larry Young – Unity',
  price: 5.87,
  currency: 'EUR',
  addedAt: 0,
  note: null,
  priceExpired: false,
  sold: false,
  ...over,
})

const dealer: Dealer = {
  username: 'londonwax',
  displayName: 'London Wax',
  shipsFrom: 'United Kingdom',
  sellerRating: 100,
  ratingCount: 10,
  numForSale: 500,
  minOrderTotal: 0,
  shippingNote: '',
  lastScannedAt: null,
  newestListedAt: null,
  affinity: null,
  fingerprint: null,
  shippingTiers: [],
}

const noTable = { tiers: [], source: null, matched: [] }
const table = {
  tiers: [
    { minItems: 1, maxItems: 1, price: 20, currency: 'EUR', source: 'user' as const },
    { minItems: 2, maxItems: null, price: 22, currency: 'EUR', source: 'user' as const },
  ],
  source: 'user' as const,
  matched: [],
}

describe('reading the figure', () => {
  it('keeps the converted figure to the cent and the seller’s own one exactly', () => {
    expect(postageOf(measured, 1000)).toEqual({
      value: 14.11,
      currency: 'EUR',
      original: { value: 12, currency: 'GBP' },
      at: 1000,
    })
    expect(shipsHereOf(measured)).toBe(true)
  })

  it('reads nothing into an answer without a token', () => {
    expect(postageOf(unauthenticated, 1000)).toBeNull()
    // `shipping_is_blocked: true` is what everybody gets unauthenticated, so
    // it must never read as "does not ship here".
    expect(shipsHereOf(unauthenticated)).toBe(false)
    expect(shipsHereOf({})).toBeNull()
  })
})

describe('the basket with a named figure', () => {
  const named = postageOf(measured, 1000)

  it('takes Discogs’ word for a basket of one, over any table', () => {
    const summary = summarise([line({ postage: named, shipsHere: true })], dealer, table)
    expect(summary.shipping).toBe(14.11)
    expect(summary.shippingSource).toBe('discogs')
    expect(summary.total).toBe(5.87 + 14.11)
    expect(summary.postageNamed).toEqual(named)
    expect(summary.shipsHere).toBe(true)
  })

  it('keeps the table for two, and the figure beside it as the floor', () => {
    const summary = summarise(
      [line({ postage: named }), line({ listingId: 2, price: 10 })],
      dealer,
      table,
    )
    expect(summary.shipping).toBe(22)
    expect(summary.shippingSource).toBe('user')
    expect(summary.postageNamed).toEqual(named)
  })

  it('says unknown for two without a table, but still names the floor', () => {
    const summary = summarise(
      [line({ postage: named }), line({ listingId: 2, price: 10 })],
      dealer,
      noTable,
    )
    expect(summary.shipping).toBeNull()
    expect(summary.postageNamed).toEqual(named)
  })

  it('ignores a figure in another currency, an aged one, and a sold line', () => {
    const pounds = { ...named!, currency: 'GBP' }
    expect(summarise([line({ postage: pounds })], dealer, noTable).postageNamed).toBeNull()
    expect(
      summarise([line({ postage: named, priceExpired: true })], dealer, noTable).postageNamed,
    ).toBeNull()
    expect(
      summarise([line({ postage: named, sold: true, soldAt: 5 })], dealer, noTable)
        .postageNamed,
    ).toBeNull()
  })

  it('passes on that the shop does not ship here', () => {
    const summary = summarise([line({ postage: null, shipsHere: false })], dealer, table)
    expect(summary.shipsHere).toBe(false)
    expect(summary.shippingSource).toBe('user')
  })

  it('picks the newest figure, in lines and in items', () => {
    const older = { ...named!, value: 13, at: 500 }
    expect(namedPostage([line({ postage: older }), line({ postage: named })], 'EUR')).toEqual(
      named,
    )
    const items = [
      { ...line({ postage: older }), addedAt: 0 },
      { ...line({ postage: named }), addedAt: 0 },
    ]
    expect(freshPostage(items, 1000)).toEqual(named)
    // Six hours later the item's price is out, and its postage with it.
    expect(freshPostage(items, 7 * 60 * 60 * 1000)).toBeNull()
  })
})
