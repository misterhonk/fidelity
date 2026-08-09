import type { ShippingAdvice, ShippingPoint, ShippingTier } from '#shared/types'

/**
 * Shipping, which Discogs will not tell us.
 *
 * `shipping_price` is empty for most dealers in the inventory API — Discogs
 * computes postage in the cart and nowhere else (docs/00 §7). So the tiers
 * come from three places, in this order of trust:
 *
 *   user    somebody typed the dealer's table in by hand
 *   bundled `shipping-profiles.json`, maintained in the repository by PR
 *   parsed  a heuristic read of the dealer's free text, always labelled
 *
 * Everything here is a pure function on a tier list. Where the list came from
 * is the caller's problem, and the source travels with it so the interface can
 * say "geschätzt" where it is only a guess.
 */

/** Cheapest first, so a malformed profile still behaves predictably. */
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
 * The marginal-cost curve (docs/00 §7).
 *
 * The number that matters is not the total but the per-record cost, because
 * that is what makes "die dritte Platte senkt den Versand von 4,50 € auf
 * 3,00 € pro Stück" a sentence somebody can act on.
 */
export function shippingCurve(tiers: ShippingTier[], upTo: number): ShippingPoint[] {
  const points: ShippingPoint[] = []

  for (let items = 1; items <= upTo; items++) {
    const here = shippingFor(tiers, items)?.price ?? null
    const next = shippingFor(tiers, items + 1)?.price ?? null

    points.push({
      items,
      total: here,
      perItem: here === null ? null : here / items,
      marginal: here === null || next === null ? null : next - here,
    })
  }

  return points
}

/**
 * "Eine Platte mehr spart X € pro Stück."
 *
 * Looks a few records ahead rather than only at the next one, because tiers
 * are steps: inside a 4–6 tier the next record changes nothing, and only
 * checking n+1 would report no saving where there plainly is one.
 *
 * The *nearest* saving wins, not the deepest. "Noch eine Platte und der
 * Versand fällt von 4,50 € auf 3,00 € pro Stück" is a decision somebody can
 * make; "noch vier Platten und er fällt auf 2,00 €" is a shopping trip. The
 * full picture is one curve away for anyone who wants it.
 *
 * Returns null when nothing ahead is actually cheaper per record — which is
 * the common case at the bottom of a tier, and saying nothing is better than
 * dressing up a non-saving as advice.
 */
export function shippingAdvice(
  tiers: ShippingTier[],
  items: number,
  lookAhead = 4,
): ShippingAdvice | null {
  if (items <= 0) return null

  const now = shippingFor(tiers, items)?.price ?? null
  if (now === null) return null

  const perItemNow = now / items

  for (let extra = 1; extra <= lookAhead; extra++) {
    const then = shippingFor(tiers, items + extra)?.price ?? null
    if (then === null) continue

    const perItemThen = then / (items + extra)
    // Fractions of a cent are not advice.
    if (perItemNow - perItemThen < 0.01) continue

    return { addItems: extra, perItemNow, perItemThen, savedPerItem: perItemNow - perItemThen }
  }

  return null
}
