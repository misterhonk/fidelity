import { afterEach, describe, expect, it } from 'vitest'

import { blankDealer } from '~~/db/dealer'
import { updatePreferences } from '~~/db/meta'
import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import { compareBasket } from '~~/worker/basket/compare'
import type { BasketItem, Dealer, Dig, ShippingTier, StockRow } from '#shared/types'

afterEach(async () => {
  await deleteFidelityDb()
})

/**
 * The same basket, at the other shops (M29).
 *
 * "Five records clicked together at one shop for €100 — could another shop
 * have the same five for €80? And if one has only four of them but far
 * cheaper? Or the same ones in better condition?"
 *
 * There is no documented way to ask Discogs who else sells a release, so this
 * is a join over the stock rows every dig already wrote — free, and limited to
 * the six hours those rows are allowed to live.
 */
const NOW = 1_800_000_000_000
const HOUR = 60 * 60 * 1000

const TIERS = (price: number): ShippingTier[] => [
  { minItems: 1, maxItems: 12, price, currency: 'EUR', source: 'user' },
]

async function shop(username: string, postage: number, fields: Partial<Dealer> = {}) {
  const db = await openFidelityDb()
  await db.put('dealers', {
    ...blankDealer(username),
    displayName: username,
    shippingTiers: TIERS(postage),
    ...fields,
  })
}

async function dig(digId: string, dealer: string, ageMs = 0) {
  const db = await openFidelityDb()
  const dig: Dig = {
    id: digId,
    dealer,
    status: 'done',
    startedAt: NOW - ageMs,
    finishedAt: NOW - ageMs,
    expiresAt: NOW - ageMs + 6 * HOUR,
    listingsTotal: 10,
    listingsScanned: 10,
    uniqueSeen: 10,
    coverage: 1,
    depth: 'normal',
    truncated: false,
    matchCount: 0,
    apiRequests: 1,
    cursor: null,
  }
  await db.put('digs', dig)
}

async function stock(
  digId: string,
  releaseId: number,
  price: number,
  condition: string,
  over: Partial<StockRow> = {},
) {
  const db = await openFidelityDb()
  await db.put('stock', {
    digId,
    listingId: releaseId * 100 + Math.round(price),
    releaseId,
    label: 'Blue Note',
    decade: 1960,
    title: `Record ${releaseId}`,
    artist: 'Wayne Shorter',
    catno: null,
    format: 'Vinyl, LP',
    year: 1966,
    condition,
    price,
    currency: 'EUR',
    ...over,
  })
}

async function basket(dealer: string, entries: [releaseId: number, price: number][]) {
  const db = await openFidelityDb()
  for (const [releaseId, price] of entries) {
    const item: BasketItem = {
      listingId: releaseId * 100 + Math.round(price),
      dealer,
      releaseId,
      title: `Record ${releaseId}`,
      price,
      currency: 'EUR',
      addedAt: NOW,
      note: null,
    }
    await db.put('basket', item)
  }
}

/** Five records at `home`, €20 each plus €10 postage: €110. */
async function fiveAtHome() {
  await updatePreferences({ shipsToCountry: 'Germany' })
  await shop('home', 10)
  await dig('01HOME', 'home')
  for (const releaseId of [1, 2, 3, 4, 5]) {
    await stock('01HOME', releaseId, 20, 'Very Good Plus (VG+)')
  }
  await basket(
    'home',
    [1, 2, 3, 4, 5].map((releaseId) => [releaseId, 20]),
  )
}

describe('the same basket at another shop', () => {
  it('prices the basket where it stands', async () => {
    await fiveAtHome()

    const result = await compareBasket('home', NOW)
    expect(result.baseline).toEqual({
      items: 5,
      currency: 'EUR',
      subtotal: 100,
      shipping: 10,
      total: 110,
    })
    // Its own shop is never one of the alternatives — it would find itself.
    expect(result.offers).toEqual([])
  })

  it('finds a shop with all five, cheaper, and says by how much', async () => {
    await fiveAtHome()
    await shop('cheaper', 6)
    await dig('02CHEAP', 'cheaper')
    for (const releaseId of [1, 2, 3, 4, 5]) {
      await stock('02CHEAP', releaseId, 14, 'Very Good Plus (VG+)')
    }

    const [offer] = (await compareBasket('home', NOW)).offers

    expect(offer).toMatchObject({
      dealer: 'cheaper',
      covered: 5,
      subtotal: 70,
      shipping: 6,
      total: 76,
      rest: null,
      combined: 76,
      delta: -34,
    })
  })

  /*
   * The case the whole thing turns on.
   *
   * Four of five somewhere else is only a saving once the fifth has been paid
   * for a second time — a second parcel and a second postage tier. A
   * comparison that left that out would recommend a split that costs more,
   * which is worse than no comparison at all.
   */
  it('counts the second parcel when a shop has only four of them', async () => {
    await fiveAtHome()
    await shop('mostly', 6)
    await dig('03MOST', 'mostly')
    for (const releaseId of [1, 2, 3, 4]) {
      await stock('03MOST', releaseId, 12, 'Very Good Plus (VG+)')
    }

    const [offer] = (await compareBasket('home', NOW)).offers

    expect(offer).toMatchObject({
      dealer: 'mostly',
      covered: 4,
      subtotal: 48,
      total: 54,
      // The fifth stays where it is, and brings its own postage with it.
      rest: { items: 1, subtotal: 20, shipping: 10, total: 30 },
      combined: 84,
      delta: -26,
    })
  })

  it('counts how many come in a better or a worse condition', async () => {
    await fiveAtHome()
    await shop('nicer', 10)
    await dig('04NICE', 'nicer')
    await stock('04NICE', 1, 20, 'Near Mint (NM or M-)')
    await stock('04NICE', 2, 20, 'Mint (M)')
    await stock('04NICE', 3, 20, 'Very Good Plus (VG+)')
    await stock('04NICE', 4, 20, 'Very Good (VG)')

    const [offer] = (await compareBasket('home', NOW)).offers
    expect(offer).toMatchObject({ better: 2, worse: 1 })
  })

  it('takes the cheapest copy where a shop has the same record twice', async () => {
    await fiveAtHome()
    await shop('twice', 5)
    await dig('05TWICE', 'twice')
    await stock('05TWICE', 1, 30, 'Near Mint (NM or M-)')
    await stock('05TWICE', 1, 11, 'Very Good (VG)')

    const [offer] = (await compareBasket('home', NOW)).offers
    // One of your five, not two.
    expect(offer?.covered).toBe(1)
    expect(offer?.subtotal).toBe(11)
  })

  /*
   * Six hours, and it is the same rule rather than a limitation of its own:
   * stock goes with its dig when it expires (rule 4), so the shops that can be
   * compared are exactly the shops whose prices may be shown.
   */
  it('will not quote a shop whose dig has aged out', async () => {
    await fiveAtHome()
    await shop('stale', 5)
    await dig('06STALE', 'stale', 7 * HOUR)
    for (const releaseId of [1, 2, 3, 4, 5]) {
      await stock('06STALE', releaseId, 5, 'Near Mint (NM or M-)')
    }

    const result = await compareBasket('home', NOW)
    expect(result.offers).toEqual([])
    expect(result.looked).toBe(0)
  })

  it('does not compare prices in two currencies', async () => {
    await fiveAtHome()
    await shop('pounds', 5)
    await dig('07GBP', 'pounds')
    for (const releaseId of [1, 2, 3]) {
      await stock('07GBP', releaseId, 9, 'Near Mint (NM or M-)', { currency: 'GBP' })
    }

    expect((await compareBasket('home', NOW)).offers).toEqual([])
  })

  it('suggests where to look next, by what the shop is known to stock', async () => {
    await fiveAtHome()
    // Never dug fresh, but a past dig left a fingerprint — and that is derived
    // rather than marketplace content, so it outlives the six hours.
    await shop('jazzy', 7, {
      lastScannedAt: NOW - 5 * 24 * HOUR,
      fingerprint: {
        sampledItems: 100,
        totalItems: 100,
        coverage: 1,
        labelDist: { 'Blue Note': 40, Impulse: 10 },
        styleDist: {},
        decadeDist: {},
        medianPrice: 18,
      },
    })
    await shop('technoid', 7, {
      lastScannedAt: NOW - 5 * 24 * HOUR,
      fingerprint: {
        sampledItems: 100,
        totalItems: 100,
        coverage: 1,
        labelDist: { Kompakt: 60 },
        styleDist: {},
        decadeDist: {},
        medianPrice: 12,
      },
    })

    const { candidates } = await compareBasket('home', NOW)
    expect(candidates.map((c) => c.dealer)).toEqual(['jazzy'])
    expect(candidates[0]?.overlap).toBe(1)
  })
})
