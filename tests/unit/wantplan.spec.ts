import { describe, expect, it } from 'vitest'

import type { Dig, Match, WantlistItem } from '#shared/types'
import {
  evaluate,
  offersFrom,
  optimise,
  type PlanShopInput,
  type WantOffer,
} from '~~/worker/collection/wantplan'

/**
 * Your wants across the shops you dug (docs/06 M19 #9).
 *
 * The number that makes it a plan and not a price list is the postage: a
 * shop that has two wants a euro dearer beats two shops a euro cheaper once
 * the second parcel is counted. That is what is pinned first.
 */

const tiers = (first: number, more = first) => [
  { minItems: 1, maxItems: 1, price: first, currency: 'EUR', source: 'user' as const },
  { minItems: 2, maxItems: null, price: more, currency: 'EUR', source: 'user' as const },
]

const shop = (
  dealer: string,
  first: number,
  more = first,
  minOrderTotal = 0,
): PlanShopInput => ({
  dealer,
  displayName: dealer.toUpperCase(),
  digId: `dig-${dealer}`,
  tiers: tiers(first, more),
  minOrderTotal,
})

const offer = (
  wantKey: number,
  dealer: string,
  price: number,
  exact = true,
  want = 0,
): WantOffer => ({
  wantKey,
  dealer,
  listingId: wantKey * 100 + dealer.length,
  releaseId: wantKey,
  price,
  currency: 'EUR',
  exact,
  title: `Want ${wantKey}`,
  artist: 'Somebody',
  want,
})

describe('the cheapest set of shops', () => {
  it('prefers one parcel over two cheaper records', () => {
    // A has both wants a euro dearer; B and C each have one, cheaper.
    const shops = new Map([
      ['a', shop('a', 5)],
      ['b', shop('b', 5)],
      ['c', shop('c', 5)],
    ])
    const offers = [offer(1, 'a', 11), offer(2, 'a', 11), offer(1, 'b', 10), offer(2, 'c', 10)]

    const { best, naive } = optimise(offers, shops)

    expect(naive?.shops.map((s) => s.dealer).sort()).toEqual(['b', 'c'])
    expect(naive?.total).toBe(30)
    expect(best?.shops.map((s) => s.dealer)).toEqual(['a'])
    expect(best?.total).toBe(27)
    expect(best?.shops[0]?.items.map((item) => item.wantedReleaseId)).toEqual([1, 2])
  })

  it('keeps two shops when the second parcel is worth it', () => {
    const shops = new Map([
      ['a', shop('a', 5)],
      ['b', shop('b', 5)],
    ])
    const offers = [offer(1, 'a', 10), offer(2, 'a', 40), offer(2, 'b', 10)]

    const { best } = optimise(offers, shops)
    expect(best?.shops.map((s) => s.dealer).sort()).toEqual(['a', 'b'])
    expect(best?.total).toBe(30)
  })

  it('takes fewer shops at the same price', () => {
    const shops = new Map([
      ['a', shop('a', 5)],
      ['b', shop('b', 5)],
    ])
    const offers = [offer(1, 'a', 10), offer(2, 'a', 15), offer(2, 'b', 10)]
    // a alone: 25 + 5 = 30; a + b: 10 + 10 + 5 + 5 = 30. One parcel wins the tie.
    expect(optimise(offers, shops).best?.shops.map((s) => s.dealer)).toEqual(['a'])
  })

  it('lists the ones you want most first in a shop', () => {
    const shops = new Map([['a', shop('a', 5)]])
    const offers = [
      offer(1, 'a', 10, true, 0),
      offer(2, 'a', 10, true, 5),
      offer(3, 'a', 10, true, 3),
    ]
    const { best } = optimise(offers, shops)
    expect(best?.shops[0]?.items.map((item) => [item.wantedReleaseId, item.want])).toEqual([
      [2, 5],
      [3, 3],
      [1, 0],
    ])
  })

  it('refuses a parcel the postage table does not cover', () => {
    const only = { ...shop('a', 5), tiers: [tiers(5)[0]!] }
    const shops = new Map([['a', only]])
    expect(
      evaluate(new Set(['a']), [offer(1, 'a', 10), offer(2, 'a', 10)], shops, new Set([1, 2])),
    ).toBeNull()
  })

  it('leaves out an offer at a shop without a table, and a want only found there', () => {
    const shops = new Map([['a', shop('a', 5)]])
    const offers = [offer(1, 'a', 10), offer(2, 'z', 3)]
    const { best } = optimise(offers, shops)
    expect(best?.shops.map((s) => s.dealer)).toEqual(['a'])
    expect(best?.shops[0]?.items).toHaveLength(1)
  })

  it('flags a shop under its minimum instead of hiding the plan', () => {
    const shops = new Map([['a', shop('a', 5, 5, 20)]])
    const { best } = optimise([offer(1, 'a', 10)], shops)
    expect(best?.shops[0]?.belowMinimum).toBe(true)
  })

  it('finds nothing when no shop has a table', () => {
    expect(optimise([offer(1, 'z', 3)], new Map())).toEqual({ best: null, naive: null })
  })
})

describe('the offers a dig leaves behind', () => {
  const dig = (id: string, dealer: string): Dig => ({ id, dealer, expiresAt: 10 }) as Dig
  const match = (over: Partial<Match>): Match =>
    ({
      digId: 'd1',
      listingId: 1,
      releaseId: 1,
      score: 80,
      signals: [],
      title: 'T',
      artist: 'A',
      price: 10,
      currency: 'EUR',
      expired: false,
      ...over,
    }) as Match
  const want = (releaseId: number, masterId: number, priority = 0): WantlistItem =>
    ({ releaseId, masterId, want: priority }) as WantlistItem

  it('takes the wantlist as the truth, not the signal', () => {
    // A dig from before the want was dropped still carries the signal.
    const offers = offersFrom(
      [
        match({
          releaseId: 1,
          signals: [{ type: 'WANTLIST_EXACT', confidence: 1, evidence: {} }],
        }),
      ],
      [dig('d1', 'a')],
      [want(2, 0)],
    )
    expect(offers).toEqual([])
  })

  it('reads another pressing through the master, unless the exact one is somewhere', () => {
    const pressing = {
      type: 'WANTLIST_PRESSING' as const,
      confidence: 0.9,
      evidence: { masterId: 7 },
    }
    const other = match({ listingId: 5, releaseId: 55, price: 8, signals: [pressing] })

    expect(offersFrom([other], [dig('d1', 'a')], [want(1, 7)])).toMatchObject([
      { wantKey: 1, exact: false, price: 8 },
    ])
    // The exact pressing at another shop: the cheap other pressing must not win.
    expect(
      offersFrom(
        [other, match({ digId: 'd2', listingId: 6, releaseId: 1, price: 30 })],
        [dig('d1', 'a'), dig('d2', 'b')],
        [want(1, 7)],
      ),
    ).toMatchObject([{ wantKey: 1, exact: true, dealer: 'b' }])
  })

  it('carries the priority from the wantlist onto the offer', () => {
    const offers = offersFrom([match({ releaseId: 1 })], [dig('d1', 'a')], [want(1, 0, 5)])
    expect(offers[0]?.want).toBe(5)
  })

  it('keeps the cheapest listing per want and shop, and nothing expired', () => {
    const offers = offersFrom(
      [
        match({ listingId: 1, price: 12 }),
        match({ listingId: 2, price: 9 }),
        match({ listingId: 3, price: 5, expired: true, price: null }),
      ],
      [dig('d1', 'a')],
      [want(1, 0)],
    )
    expect(offers).toMatchObject([{ listingId: 2, price: 9 }])
  })
})
