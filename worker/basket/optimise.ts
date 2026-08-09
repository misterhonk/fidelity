import type { BasketCandidate, BasketPlan, Match, ShippingTier } from '#shared/types'

import { shippingFor } from './shipping'

/**
 * Which records to add, and which set to buy at all.
 *
 * Two related questions with the same shape: given what this dealer has that
 * you want, what does a shipment look like. The postage tiers are what make it
 * more than "buy the highest scores" — a fourth record can be free to ship and
 * a seventh can cost as much as the record.
 */

export function toCandidate(match: Match): BasketCandidate | null {
  if (match.price === null || !match.currency || match.expired) return null
  return {
    listingId: match.listingId,
    releaseId: match.releaseId,
    score: match.score,
    price: match.price,
    currency: match.currency,
    title: [match.artist, match.title].filter(Boolean).join(' – ') || 'Unbekannt',
    reason: match.reason,
  }
}

/**
 * How many swap rounds are allowed.
 *
 * Three, because the improvement is monotone and in practice converges in one
 * or two — and because this runs in a worker that also has a scan to get back
 * to. An unbounded loop here would be a hang nobody could explain.
 */
export const MAX_SWAP_ROUNDS = 3

function cost(
  chosen: BasketCandidate[],
  tiers: ShippingTier[],
): { goods: number; shipping: number | null; total: number | null } {
  const goods = chosen.reduce((sum, item) => sum + item.price, 0)
  const shipping = chosen.length === 0 ? 0 : (shippingFor(tiers, chosen.length)?.price ?? null)
  return { goods, shipping, total: shipping === null ? null : goods + shipping }
}

const scoreOf = (chosen: BasketCandidate[]) => chosen.reduce((sum, item) => sum + item.score, 0)

/**
 * Greedy, twice, then swap improvement — and the better of the two wins.
 *
 * Greedy by score-per-euro is the right instinct and has one blind spot: three
 * decent cheap records crowd out the one expensive record that was worth more
 * than all of them. A one-for-one swap cannot recover that, because escaping it
 * means *shrinking* the set, and the swap pass only ever exchanges.
 *
 * So the whole thing runs a second time seeded by absolute score, where that
 * case is trivial, and the higher-scoring plan is kept. Two cheap passes rather
 * than one clever one.
 *
 * The swap pass then earns its keep on the tier boundaries: it exchanges a
 * chosen record for a better left-out one whenever the budget still holds, and
 * tries to add afterwards, because a swap can free exactly the euros a nearly
 * free fourth record needed.
 *
 * Not an exact knapsack. That is NP-hard, this runs on somebody's phone, and
 * the answer is a shopping suggestion rather than a proof.
 */
export function planBasket(
  candidates: BasketCandidate[],
  tiers: ShippingTier[],
  budget: number,
): BasketPlan {
  const affordable = candidates.filter((item) => item.price > 0 && item.price <= budget)

  const byValue = [...affordable].sort(
    (a, b) => b.score / b.price - a.score / a.price || b.score - a.score,
  )
  const byScore = [...affordable].sort((a, b) => b.score - a.score || a.price - b.price)

  const plans = [byValue, byScore].map((order) => improve(order, tiers, budget))
  return plans.reduce((best, plan) => (plan.score > best.score ? plan : best))
}

function improve(order: BasketCandidate[], tiers: ShippingTier[], budget: number): BasketPlan {
  const fits = (set: BasketCandidate[]) => {
    const { total } = cost(set, tiers)
    return total !== null && total <= budget
  }

  const chosen: BasketCandidate[] = []
  for (const item of order) {
    if (fits([...chosen, item])) chosen.push(item)
  }

  let improvements = 0
  const rest = () => order.filter((item) => !chosen.some((c) => c.listingId === item.listingId))

  for (let round = 0; round < MAX_SWAP_ROUNDS; round++) {
    let improvedThisRound = false

    for (let i = 0; i < chosen.length; i++) {
      for (const other of rest()) {
        const swapped = chosen.map((item, index) => (index === i ? other : item))
        if (scoreOf(swapped) > scoreOf(chosen) && fits(swapped)) {
          chosen.splice(i, 1, other)
          improvements += 1
          improvedThisRound = true
          break
        }
      }
    }

    // Adding is tried after swapping: a swap can free up the euros an extra
    // record needed, and a tier boundary can make that record nearly free.
    for (const other of rest()) {
      if (fits([...chosen, other])) {
        chosen.push(other)
        improvements += 1
        improvedThisRound = true
      }
    }

    if (!improvedThisRound) break
  }

  const { goods, shipping, total } = cost(chosen, tiers)
  return { chosen, score: scoreOf(chosen), goods, shipping, total, improvements }
}

/**
 * The records worth adding to reach the next postage step.
 *
 * The price ceiling is the user's own comfort price, not a number derived from
 * the postage saving. You do not buy a record because it saves postage — the
 * saving only tips a decision that was already close, and a ceiling computed
 * from it would be an invented constant dressed up as a recommendation.
 */
export function suggestCandidates(
  candidates: BasketCandidate[],
  inBasket: Set<number>,
  maxPrice: number | null,
  limit = 12,
): BasketCandidate[] {
  return candidates
    .filter((item) => !inBasket.has(item.listingId))
    .filter((item) => maxPrice === null || item.price <= maxPrice)
    .sort((a, b) => b.score - a.score || a.price - b.price)
    .slice(0, limit)
}
