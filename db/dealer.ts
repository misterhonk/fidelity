import type { Dealer } from '#shared/types'

/**
 * A dealer row with nothing in it yet.
 *
 * Two callers create one: a scan, which then fills in what it learned, and a
 * hand-typed postage table for a shop that has never been scanned. Both need
 * the same shape, and defining it once is what stops the next field from being
 * added in one place and forgotten in the other — which is precisely how
 * scanning a shop came to stop watching it.
 */
export function blankDealer(username: string): Dealer {
  return {
    username,
    displayName: username,
    shipsFrom: '',
    sellerRating: 0,
    ratingCount: 0,
    numForSale: 0,
    minOrderTotal: 0,
    shippingNote: '',
    lastScannedAt: null,
    affinity: null,
    fingerprint: null,
    shippingTiers: [],
  }
}
