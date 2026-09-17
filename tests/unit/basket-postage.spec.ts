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

describe('a table in the seller’s currency', () => {
  const named = postageOf(measured, 1000)
  const pounds = {
    tiers: [
      { minItems: 1, maxItems: 1, price: 12, currency: 'GBP', source: 'parsed' as const },
      { minItems: 2, maxItems: 2, price: 13.5, currency: 'GBP', source: 'parsed' as const },
    ],
    source: 'parsed' as const,
    matched: [],
    freeOver: { amount: 300, currency: 'GBP' },
  }

  it('is turned into the basket’s currency at Discogs’ own rate', () => {
    // 14.11 / 12 is the rate the measured line carries; 13.5 GBP at it is 15.87 EUR.
    const summary = summarise(
      [line({ postage: named }), line({ listingId: 2, price: 10 })],
      dealer,
      pounds,
    )
    expect(summary.shipping).toBe(15.87)
    expect(summary.shippingConverted).toEqual({ from: 'GBP', rate: 14.11 / 12 })
    expect(summary.freeOver).toEqual({ amount: 352.75, missing: 336.88 })
  })

  it('refuses to add a table it cannot convert', () => {
    const summary = summarise([line(), line({ listingId: 2 })], dealer, pounds)
    expect(summary.shipping).toBeNull()
    expect(summary.shippingConverted).toBeNull()
  })

  it('makes the postage free once the basket is over the threshold', () => {
    const euros = {
      tiers: [
        { minItems: 1, maxItems: null, price: 5, currency: 'EUR', source: 'user' as const },
      ],
      source: 'user' as const,
      matched: [],
      freeOver: { amount: 20, currency: 'EUR' },
    }
    const under = summarise(
      [line({ price: 8 }), line({ listingId: 2, price: 8 })],
      dealer,
      euros,
    )
    expect(under.shipping).toBe(5)
    expect(under.freeOver).toEqual({ amount: 20, missing: 4 })
    const over = summarise(
      [line({ price: 12 }), line({ listingId: 2, price: 9 })],
      dealer,
      euros,
    )
    expect(over.shipping).toBe(0)
    expect(over.total).toBe(21)
    expect(over.freeOver).toEqual({ amount: 20, missing: 0 })
  })
})

describe('the read-off field', () => {
  it('cuts the user’s own tier around the count it was read for', async () => {
    const { deleteFidelityDb, openFidelityDb } = await import('~~/db/open')
    const { readOffShipping } = await import('~~/worker/basket/profiles')
    const db = await openFidelityDb()
    await db.put('dealers', {
      ...dealer,
      shippingTiers: [
        { minItems: 1, maxItems: 1, price: 6, currency: 'EUR', source: 'user' },
        { minItems: 2, maxItems: 5, price: 9, currency: 'EUR', source: 'user' },
        {
          minItems: 6,
          maxItems: null,
          price: 12,
          currency: 'EUR',
          source: 'parsed',
        },
      ],
    })
    const updated = await readOffShipping('londonwax', 3, 9.8, 'EUR')
    expect(updated.shippingTiers.map((t) => [t.minItems, t.maxItems, t.price])).toEqual([
      [1, 1, 6],
      [2, 2, 9],
      [3, 3, 9.8],
      [4, 5, 9],
    ])
    await deleteFidelityDb()
  })
})
