import { afterEach, describe, expect, it } from 'vitest'

import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import type { Dealer, Match, ShippingTier } from '#shared/types'
import {
  addToBasket,
  basketListingIds,
  basketSummary,
  clearBasket,
  PRICE_TTL_MS,
  removeFromBasket,
  summarise,
  type BasketLine,
} from '~~/worker/basket'
import {
  MAX_SWAP_ROUNDS,
  planBasket,
  suggestCandidates,
  toCandidate,
  type Candidate,
} from '~~/worker/basket/optimise'

afterEach(async () => {
  await deleteFidelityDb()
})

const tier = (minItems: number, maxItems: number | null, price: number): ShippingTier => ({
  minItems,
  maxItems,
  price,
  currency: 'EUR',
  source: 'user',
})

// 1 LP 6 €, 2–3 LP 9 €, 4–6 LP 12 €.
const table = [tier(1, 1, 6), tier(2, 3, 9), tier(4, 6, 12)]

function match(over: Partial<Match> = {}): Match {
  return {
    digId: '01A',
    listingId: 1,
    releaseId: 10,
    score: 60,
    signals: [],
    reason: 'Weil.',
    title: 'Platte',
    artist: 'Wer',
    label: null,
    catno: null,
    format: '12"',
    year: 2004,
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

const line = (over: Partial<BasketLine> = {}): BasketLine => ({
  listingId: 1,
  dealer: 'shop',
  releaseId: 10,
  title: 'Wer – Platte',
  price: 10,
  currency: 'EUR',
  addedAt: 0,
  note: null,
  priceExpired: false,
  sold: false,
  ...over,
})

const dealer = (over: Partial<Dealer> = {}): Dealer => ({
  username: 'shop',
  displayName: 'Der Laden',
  shipsFrom: 'Germany',
  sellerRating: 99,
  ratingCount: 500,
  numForSale: 4000,
  minOrderTotal: 0,
  shippingNote: '',
  lastScannedAt: 1,
  affinity: null,
  fingerprint: null,
  shippingTiers: [],
  ...over,
})

const shipping = (tiers: ShippingTier[], source: ShippingTier['source'] | null = 'user') => ({
  tiers,
  source,
  matched: [],
})

describe('holding a basket', () => {
  it('keeps what was added', async () => {
    await addToBasket(match({ listingId: 7, artist: 'Robag', title: 'Wuppdeck' }), 'shop', 1000)

    const db = await openFidelityDb()
    expect(await db.get('basket', 7)).toMatchObject({
      listingId: 7,
      dealer: 'shop',
      title: 'Robag – Wuppdeck',
      price: 10,
      addedAt: 1000,
    })
  })

  it('holds one dealer at a time', async () => {
    // Postage is per shipment and a shipment is per dealer. Two dealers in one
    // total is a number nobody can pay.
    await addToBasket(match({ listingId: 1 }), 'shop-a', 1000)
    await addToBasket(match({ listingId: 2 }), 'shop-b', 1000)

    expect(await basketListingIds()).toEqual([2])
  })

  it('keeps adding within the same dealer', async () => {
    await addToBasket(match({ listingId: 1 }), 'shop', 1000)
    await addToBasket(match({ listingId: 2 }), 'shop', 1000)
    expect((await basketListingIds()).sort()).toEqual([1, 2])
  })

  it('can be emptied one record at a time or all at once', async () => {
    await addToBasket(match({ listingId: 1 }), 'shop', 1000)
    await addToBasket(match({ listingId: 2 }), 'shop', 1000)

    await removeFromBasket(1)
    expect(await basketListingIds()).toEqual([2])

    await clearBasket()
    expect(await basketListingIds()).toEqual([])
  })

  it('has no summary while it is empty', async () => {
    expect(await basketSummary(1000, 'Germany')).toBeNull()
  })

  it('stores the title rather than pointing at the dig', async () => {
    // Only the last five digs survive, and the basket has to outlive that.
    await addToBasket(match({ listingId: 7, artist: 'A', title: 'B' }), 'shop', 1000)
    const db = await openFidelityDb()
    expect((await db.get('basket', 7))?.title).toBe('A – B')
  })
})

describe('what a basket costs', () => {
  it('adds goods and postage', () => {
    const summary = summarise(
      [line({ listingId: 1, price: 10 }), line({ listingId: 2, price: 14 })],
      dealer(),
      shipping(table),
    )
    expect(summary.subtotal).toBe(24)
    expect(summary.shipping).toBe(9)
    expect(summary.total).toBe(33)
    expect(summary.perItem).toBe(16.5)
  })

  it('refuses to total a basket whose prices have aged out', () => {
    // A subtotal over the lines that are still fresh would be a smaller number
    // than the truth, presented with the same confidence (CLAUDE.md rule 4).
    const summary = summarise(
      [line({ listingId: 1 }), line({ listingId: 2, priceExpired: true })],
      dealer(),
      shipping(table),
    )
    expect(summary.subtotal).toBeNull()
    expect(summary.total).toBeNull()
    expect(summary.perItem).toBeNull()
  })

  it('marks a line expired once it is older than the ToS window', async () => {
    await addToBasket(match({ listingId: 1 }), 'shop', 0)
    const summary = await basketSummary(PRICE_TTL_MS + 1, 'Germany')
    expect(summary?.lines[0]?.priceExpired).toBe(true)
    expect(PRICE_TTL_MS).toBe(6 * 60 * 60 * 1000)
  })

  it('shows a sold line but stops counting it', () => {
    /*
     * Four records, one of them gone. The subtotal is over the three that are
     * left, and the postage tier drops with them — five back down to four may
     * genuinely be a rung cheaper, and that is the useful half of the news.
     */
    const summary = summarise(
      [
        line({ listingId: 1, price: 10 }),
        line({ listingId: 2, price: 10 }),
        line({ listingId: 3, price: 10 }),
        line({ listingId: 4, price: 10, sold: true }),
      ],
      dealer(),
      shipping(table),
    )

    // Still shown — removing somebody's basket entry is their decision.
    expect(summary.lines).toHaveLength(4)
    expect(summary.subtotal).toBe(30)
    // 4–6 LP would have been 12 €; three fall into the 2–3 rung at 9 €.
    expect(summary.shipping).toBe(9)
    expect(summary.total).toBe(39)
    expect(summary.perItem).toBe(13)
  })

  it('ignores an aged-out price on a line that has already sold', () => {
    // The sold line is out of the arithmetic entirely, so its stale price
    // cannot poison a total that is otherwise perfectly knowable.
    const summary = summarise(
      [
        line({ listingId: 1, price: 10 }),
        line({ listingId: 2, priceExpired: true, sold: true }),
      ],
      dealer(),
      shipping(table),
    )
    expect(summary.subtotal).toBe(10)
    expect(summary.total).toBe(16)
  })

  it('refuses to add two currencies together', () => {
    const summary = summarise(
      [line({ listingId: 1, currency: 'EUR' }), line({ listingId: 2, currency: 'GBP' })],
      dealer(),
      shipping(table),
    )
    expect(summary.subtotal).toBeNull()
  })

  it('says postage is unknown rather than guessing it', () => {
    const summary = summarise([line()], dealer(), shipping([], null))
    expect(summary.shipping).toBeNull()
    expect(summary.total).toBeNull()
    expect(summary.shippingSource).toBeNull()
  })

  it('carries where the postage table came from', () => {
    expect(summarise([line()], dealer(), shipping(table, 'parsed')).shippingSource).toBe(
      'parsed',
    )
  })

  it('flags a basket under the dealer minimum', () => {
    const summary = summarise(
      [line({ price: 10 })],
      dealer({ minOrderTotal: 25 }),
      shipping(table),
    )
    expect(summary.belowMinimum).toBe(true)
    expect(
      summarise([line({ price: 30 })], dealer({ minOrderTotal: 25 }), shipping(table))
        .belowMinimum,
    ).toBe(false)
  })

  it('offers the saving that is one record away', () => {
    const summary = summarise(
      [line({ listingId: 1 }), line({ listingId: 2 })],
      dealer(),
      shipping(table),
    )
    expect(summary.advice).toMatchObject({ addItems: 1, perItemNow: 4.5, perItemThen: 3 })
  })
})

describe('planning a shipment', () => {
  const c = (over: Partial<Candidate> = {}): Candidate => ({
    listingId: 1,
    releaseId: 10,
    score: 60,
    price: 10,
    currency: 'EUR',
    title: 'Platte',
    reason: '',
    ...over,
  })

  it('turns a match into a candidate, or refuses to', () => {
    expect(toCandidate(match())?.price).toBe(10)
    expect(toCandidate(match({ price: null }))).toBeNull()
    // An expired match has no price left to plan around.
    expect(toCandidate(match({ expired: true }))).toBeNull()
  })

  it('fills a budget with the best value per euro', () => {
    const plan = planBasket(
      [
        c({ listingId: 1, score: 90, price: 40 }),
        c({ listingId: 2, score: 60, price: 12 }),
        c({ listingId: 3, score: 60, price: 12 }),
      ],
      table,
      45,
    )
    // Two 60s at 12 € beat one 90 at 40 € once postage is in the total.
    expect(plan.chosen.map((item) => item.listingId).sort()).toEqual([2, 3])
    expect(plan.total).toBe(33)
  })

  it('stays inside the budget, postage included', () => {
    const plan = planBasket([c({ listingId: 1, price: 10 })], table, 15)
    // 10 + 6 postage is 16, over a budget of 15.
    expect(plan.chosen).toEqual([])
    expect(plan.total).toBe(0)
  })

  it('takes the fourth record when it ships for the same as three', () => {
    const plan = planBasket(
      [
        c({ listingId: 1, score: 50, price: 9 }),
        c({ listingId: 2, score: 50, price: 9 }),
        c({ listingId: 3, score: 50, price: 9 }),
        c({ listingId: 4, score: 49, price: 9 }),
      ],
      table,
      48,
    )
    expect(plan.chosen).toHaveLength(4)
    expect(plan.shipping).toBe(12)
    expect(plan.total).toBe(48)
  })

  it('does not let three decent records crowd out one great one', () => {
    // Score-per-euro picks B, C and D for 90 points. The one record worth 100
    // then no longer fits, and no one-for-one swap can recover it, because
    // escaping this means shrinking the set. The second, score-seeded pass is
    // what catches it.
    const plan = planBasket(
      [
        c({ listingId: 1, score: 100, price: 20 }),
        c({ listingId: 2, score: 30, price: 5 }),
        c({ listingId: 3, score: 30, price: 5 }),
        c({ listingId: 4, score: 30, price: 5 }),
      ],
      table,
      30,
    )
    expect(plan.chosen.map((item) => item.listingId)).toEqual([1])
    expect(plan.score).toBe(100)
    expect(plan.total).toBe(26)
  })

  it('never returns a set it cannot pay for', () => {
    const plan = planBasket(
      Array.from({ length: 20 }, (_, i) => c({ listingId: i + 1, score: 50 + i, price: 5 })),
      table,
      30,
    )
    expect(plan.total).not.toBeNull()
    expect(plan.total!).toBeLessThanOrEqual(30)
  })

  it('gives up rather than looping when nothing improves', () => {
    const plan = planBasket([c({ listingId: 1, price: 10 })], table, 100)
    expect(plan.improvements).toBe(0)
    expect(MAX_SWAP_ROUNDS).toBe(3)
  })

  it('plans nothing without a postage table it can price', () => {
    // Unknown postage means an unknown total, and a plan with an unknown total
    // is a guess dressed as arithmetic.
    expect(planBasket([c()], [], 100).chosen).toEqual([])
  })
})

describe('what else to put in', () => {
  const c = (over: Partial<Candidate> = {}): Candidate => ({
    listingId: 1,
    releaseId: 10,
    score: 60,
    price: 10,
    currency: 'EUR',
    title: 'Platte',
    reason: '',
    ...over,
  })

  it('suggests the best scores that are not already in', () => {
    const suggestions = suggestCandidates(
      [
        c({ listingId: 1, score: 80 }),
        c({ listingId: 2, score: 90 }),
        c({ listingId: 3, score: 70 }),
      ],
      new Set([2]),
      null,
    )
    expect(suggestions.map((item) => item.listingId)).toEqual([1, 3])
  })

  it('respects the comfort price rather than a number derived from the saving', () => {
    const suggestions = suggestCandidates(
      [c({ listingId: 1, score: 90, price: 40 }), c({ listingId: 2, score: 70, price: 8 })],
      new Set(),
      15,
    )
    expect(suggestions.map((item) => item.listingId)).toEqual([2])
  })

  it('breaks ties on price, cheapest first', () => {
    const suggestions = suggestCandidates(
      [c({ listingId: 1, score: 70, price: 20 }), c({ listingId: 2, score: 70, price: 8 })],
      new Set(),
      null,
    )
    expect(suggestions.map((item) => item.listingId)).toEqual([2, 1])
  })
})
