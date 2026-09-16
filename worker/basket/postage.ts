import type { BasketItem, BasketLine, ListingPostage } from '#shared/types'

/**
 * Postage as Discogs names it, one listing at a time (M34.2).
 *
 * Measured on 2026-09-16 on a real account (docs/02 §5): with a token,
 * `GET /marketplace/listings/{id}` carries `shipping_price` — the postage for
 * that one record to the account's address, converted into the account's
 * currency the same way the price is — and `original_shipping_price`, the
 * seller's exact figure in the seller's currency. Without a token both are
 * empty and `shipping_is_blocked` is `true` for everybody, which is why this
 * app believed for a year that Discogs would not say.
 *
 * Pure functions: the paste and the refresh hand a parsed answer in, the
 * basket arithmetic hands lines in.
 */

/** The two fields, as the paste and the refresh schemas parse them. */
export interface PostageFields {
  shipping_price?: { value?: number | null; currency?: string | null } | null
  original_shipping_price?: { curr_abbr?: string | null; value?: number | null } | null
  shipping_is_blocked?: boolean | null
}

/** Six hours, like the price beside it (CLAUDE.md rule 4). */
export const POSTAGE_TTL_MS = 6 * 60 * 60 * 1000

const cents = (value: number) => Math.round(value * 100) / 100

export function postageOf(listing: PostageFields, now: number): ListingPostage | null {
  const shown = listing.shipping_price
  if (!shown || typeof shown.value !== 'number' || !shown.currency) return null

  const original = listing.original_shipping_price
  return {
    value: cents(shown.value),
    currency: shown.currency,
    original:
      original && typeof original.value === 'number' && original.curr_abbr
        ? { value: cents(original.value), currency: original.curr_abbr }
        : null,
    at: now,
  }
}

/**
 * `null` where Discogs said nothing — which is what it says without a token,
 * so an absent flag must never read as "does not ship here".
 */
export function shipsHereOf(listing: PostageFields): boolean | null {
  if (listing.shipping_is_blocked === true) return false
  if (listing.shipping_price && typeof listing.shipping_price.value === 'number') return true
  return null
}

/**
 * The figure for one record, off the newest line that still carries a fresh
 * one in the basket's currency. Sold lines and aged prices do not count: the
 * postage aged with them.
 */
export function namedPostage(
  lines: BasketLine[],
  currency: string | null,
): ListingPostage | null {
  let newest: ListingPostage | null = null
  for (const line of lines) {
    const postage = line.postage
    if (!postage || line.sold || line.priceExpired) continue
    if (currency !== null && postage.currency !== currency) continue
    if (!newest || postage.at > newest.at) newest = postage
  }
  return newest
}

/** The same, for a screen that has items rather than lines. */
export function freshPostage(items: BasketItem[], now: number): ListingPostage | null {
  let newest: ListingPostage | null = null
  for (const item of items) {
    const postage = item.postage
    if (!postage || item.soldAt || now - item.addedAt > POSTAGE_TTL_MS) continue
    if (!newest || postage.at > newest.at) newest = postage
  }
  return newest
}
