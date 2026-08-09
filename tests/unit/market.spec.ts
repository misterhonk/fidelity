import { describe, expect, it } from 'vitest'

import {
  PRICE_NEGATIVE,
  PRICE_STRONG,
  PRICE_WEAK,
  priceSignal,
  SCARCE_STRONG,
  SCARCE_WEAK,
  scarcitySignal,
  type MarketStats,
} from '~~/worker/match/market'

const market = (over: Partial<MarketStats> = {}): MarketStats => ({
  lowestPrice: 20,
  currency: 'EUR',
  numForSale: 40,
  ...over,
})

describe('S10 — the price signal', () => {
  it('holds the ratios docs/04 §S10 sets', () => {
    expect({ PRICE_STRONG, PRICE_WEAK, PRICE_NEGATIVE }).toEqual({
      PRICE_STRONG: 0.7,
      PRICE_WEAK: 0.85,
      PRICE_NEGATIVE: 1.3,
    })
  })

  it('is fully confident well under the going rate', () => {
    // 12 of 20 is 0,6.
    expect(priceSignal(12, 'EUR', market()).signal?.confidence).toBe(1)
  })

  it('is half confident a little under', () => {
    // 16 of 20 is 0,8.
    expect(priceSignal(16, 'EUR', market()).signal?.confidence).toBe(0.6)
  })

  it('says nothing at the going rate', () => {
    expect(priceSignal(20, 'EUR', market()).signal).toBeNull()
    expect(priceSignal(20, 'EUR', market()).negative).toBe(false)
  })

  it('dampens rather than rewards well above the market', () => {
    const result = priceSignal(30, 'EUR', market())
    // Never a reason to buy, so it can only ever be a dampener (docs/04 §2).
    expect(result.signal).toBeNull()
    expect(result.negative).toBe(true)
  })

  it('names both prices in the evidence, not the ratio alone', () => {
    expect(priceSignal(12, 'EUR', market()).signal?.evidence).toEqual({
      price: 12,
      marketLowest: 20,
      currency: 'EUR',
      ratio: 0.6,
    })
  })

  it('refuses to compare across currencies', () => {
    // A browser has no exchange rate it can trust, and a wrong one turns a
    // bargain into a rip-off with nobody able to see why.
    expect(priceSignal(12, 'GBP', market({ currency: 'EUR' })).signal).toBeNull()
    expect(priceSignal(12, 'GBP', market({ currency: 'EUR' })).negative).toBe(false)
  })

  it('says nothing when either side has no price', () => {
    expect(priceSignal(null, 'EUR', market()).signal).toBeNull()
    expect(priceSignal(12, 'EUR', market({ lowestPrice: null })).signal).toBeNull()
    expect(priceSignal(12, 'EUR', market({ lowestPrice: 0 })).signal).toBeNull()
    expect(priceSignal(0, 'EUR', market()).signal).toBeNull()
  })
})

describe('S11 — scarcity', () => {
  it('holds the rungs docs/04 §S11 sets', () => {
    expect({ SCARCE_STRONG, SCARCE_WEAK }).toEqual({ SCARCE_STRONG: 3, SCARCE_WEAK: 10 })
  })

  it('is fully confident at three copies or fewer', () => {
    expect(scarcitySignal(market({ numForSale: 3 }))?.confidence).toBe(1)
    expect(scarcitySignal(market({ numForSale: 1 }))?.confidence).toBe(1)
  })

  it('is half confident up to ten', () => {
    expect(scarcitySignal(market({ numForSale: 10 }))?.confidence).toBe(0.5)
    expect(scarcitySignal(market({ numForSale: 4 }))?.confidence).toBe(0.5)
  })

  it('stays silent above ten rather than inventing a rung', () => {
    // docs/04 §S11 defines ≤3, ≤10 and >30 and leaves 11–30 unsaid. A made-up
    // confidence there would move every score that touches it, and nobody
    // could point at where the number came from.
    expect(scarcitySignal(market({ numForSale: 11 }))).toBeNull()
    expect(scarcitySignal(market({ numForSale: 30 }))).toBeNull()
    expect(scarcitySignal(market({ numForSale: 31 }))).toBeNull()
  })

  it('says nothing when nothing is for sale', () => {
    expect(scarcitySignal(market({ numForSale: 0 }))).toBeNull()
  })
})
