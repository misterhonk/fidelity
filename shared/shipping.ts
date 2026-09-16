import type { LandedContext, LandedPrice, Match, ShippingTier } from './types'

/**
 * The postage arithmetic both sides of the worker boundary need.
 *
 * `worker/basket/shipping.ts` had `sortTiers` and `shippingFor` from the start
 * and the basket used them. Then the find list wanted the same number — what a
 * record costs *with* the postage it adds — and the list is sorted on the main
 * thread (`app/utils/digview.ts`), which cannot import a worker module without
 * dragging a chunk across the boundary for six lines of arithmetic. So the six
 * lines moved here, next to the types, where `shared/format.ts` already sets
 * the precedent. The worker re-exports them; nothing there changed.
 */

/** Cheapest first, so a malformed profile still behaves predictably. */
/**
 * What Discogs assumes a record weighs when a seller bills by weight and has
 * not said otherwise (M34.2): its own defaults, in grams, from the seller's
 * shipping-policy settings. The shipping profile v2 (M34.3) rates by them.
 */
export const DISCOGS_DEFAULT_WEIGHT_G = { lp: 230, ten: 135, cd: 85 } as const

export function sortTiers(tiers: ShippingTier[]): ShippingTier[] {
  return [...tiers].sort((a, b) => a.minItems - b.minItems)
}

/**
 * What N records cost to ship, or null when the table does not cover N.
 *
 * Null rather than an extrapolation: a table that stops at six records says
 * nothing about seven, and inventing the seventh would be a number somebody
 * plans a purchase around.
 */
export function shippingFor(tiers: ShippingTier[], items: number): ShippingTier | null {
  if (items <= 0) return null

  for (const tier of sortTiers(tiers)) {
    const withinLower = items >= tier.minItems
    const withinUpper = tier.maxItems === null || items <= tier.maxItems
    if (withinLower && withinUpper) return tier
  }
  return null
}

/**
 * The landed price: what this record costs once it is in the parcel.
 *
 * Price plus the postage the record *adds* — the difference between the tier
 * for the basket as it stands at this shop and the tier one record larger.
 * Not the parcel's postage divided by its records: that number changes for
 * every record already in the basket the moment one more goes in, and a list
 * sorted by it would reorder itself under somebody's eyes.
 *
 * So the first record carries the whole first tier, the second whatever the
 * second tier adds (often nothing, inside a 1–3 tier), and a record that is
 * already in the basket carries the postage it added when it went in — it is
 * taken out of the count before the arithmetic, or it would pay twice.
 *
 * Null wherever the number would be a guess: no price (the dig has expired),
 * no table for this shop, a table that stops short of the parcel size, or a
 * listing priced in a currency the table is not. Currencies are compared,
 * never converted — the basket and S10 refuse for the same reason, and a
 * bargain in pounds sorted as if it were euros is the kind of wrong nobody
 * sees.
 */
export function landedPrice(match: Match, context: LandedContext | null): LandedPrice | null {
  if (!context || context.tiers.length === 0) return null
  if (match.price === null || match.price === undefined || !match.currency) return null
  if (context.currency && match.currency !== context.currency) return null

  const already = context.listingIds.includes(match.listingId)
  const before = Math.max(0, context.inBasket - (already ? 1 : 0))

  const now = before === 0 ? 0 : (shippingFor(context.tiers, before)?.price ?? null)
  const then = shippingFor(context.tiers, before + 1)?.price ?? null
  if (now === null || then === null) return null

  const postage = Math.max(0, then - now)
  return {
    total: match.price + postage,
    postage,
    currency: match.currency,
    items: before + 1,
    source: context.source,
  }
}
