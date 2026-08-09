import type { Signal } from '#shared/types'

/**
 * S10 and S11 — the two signals that cost a request each.
 *
 * Pure, like everything else in this directory. The fetching lives in
 * `worker/dig/enrich.ts`, which is the one bounded pass allowed to spend
 * requests after a scan.
 */

export interface MarketStats {
  /** null when nothing is for sale, or when the currency does not match. */
  lowestPrice: number | null
  currency: string | null
  numForSale: number
}

/** Ratios from docs/04 §S10, unchanged. */
export const PRICE_STRONG = 0.7
export const PRICE_WEAK = 0.85
export const PRICE_NEGATIVE = 1.3

/**
 * S10 — clearly under the going rate.
 *
 * Returns the signal, or `{ negative: true }` when the listing is well above
 * the market, which is a score dampener rather than a signal (docs/04 §2:
 * a criterion is either one or the other, never both).
 *
 * Currencies are compared, not converted. A browser has no exchange rate it
 * can trust, and a wrong one turns a bargain into a rip-off with no way for
 * anybody to see why. Different currency means no signal at all.
 */
export function priceSignal(
  listingPrice: number | null,
  listingCurrency: string | null,
  stats: MarketStats,
): { signal: Signal | null; negative: boolean } {
  const none = { signal: null, negative: false }

  if (listingPrice === null || listingPrice <= 0) return none
  if (stats.lowestPrice === null || stats.lowestPrice <= 0) return none
  if (!listingCurrency || !stats.currency || listingCurrency !== stats.currency) return none

  const ratio = listingPrice / stats.lowestPrice

  if (ratio > PRICE_NEGATIVE) return { signal: null, negative: true }

  const confidence = ratio <= PRICE_STRONG ? 1 : ratio <= PRICE_WEAK ? 0.6 : 0
  if (confidence === 0) return none

  return {
    signal: {
      type: 'PRICE_SIGNAL',
      confidence,
      evidence: {
        price: listingPrice,
        marketLowest: stats.lowestPrice,
        currency: stats.currency,
        ratio: Math.round(ratio * 100) / 100,
      },
    },
    negative: false,
  }
}

/** Rungs from docs/04 §S11, unchanged. */
export const SCARCE_STRONG = 3
export const SCARCE_WEAK = 10

/**
 * S11 — rarely on the marketplace at all.
 *
 * docs/04 §S11 gives three rungs: ≤ 3 is 1.0, ≤ 10 is 0.5, and above 30 there
 * is no signal because the record will come around again. What it does not say
 * is what 11–30 is worth, and that gap is left silent rather than filled with
 * an invented constant — a made-up confidence would quietly move every score
 * that touches it and nobody could point at where the number came from.
 */
export function scarcitySignal(stats: MarketStats): Signal | null {
  const n = stats.numForSale
  if (n <= 0) return null

  const confidence = n <= SCARCE_STRONG ? 1 : n <= SCARCE_WEAK ? 0.5 : 0
  if (confidence === 0) return null

  return {
    type: 'SCARCITY',
    confidence,
    evidence: { numForSale: n },
  }
}
