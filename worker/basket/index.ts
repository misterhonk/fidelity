import { openFidelityDb } from '~~/db/open'
import type { BasketLine, BasketSummary, Dealer, Match } from '#shared/types'

import { resolveShipping, type ShippingResolution } from './profiles'
import { shippingAdvice, shippingCurve, shippingFor } from './shipping'

/**
 * The basket.
 *
 * Discogs shows combined postage only inside its own cart. This shows it
 * before — which is the point of the whole feature (docs/00 §7) — and then
 * hands over with a deep link, because running a checkout would be both a ToS
 * violation and strategically stupid.
 *
 * One basket per dealer, always. Postage is per shipment and a shipment is per
 * dealer, so a mixed basket would produce a total nobody could pay.
 */

/** The ToS window, same as a dig's (CLAUDE.md rule 4). */
export const PRICE_TTL_MS = 6 * 60 * 60 * 1000

export type { BasketLine, BasketSummary }

export async function addToBasket(match: Match, dealer: string, now: number): Promise<void> {
  const db = await openFidelityDb()

  /*
   * Nothing is thrown away here.
   *
   * This used to wipe the basket whenever a record came from a different shop
   * — postage is per shipment, so one total across two dealers is a number
   * nobody can pay, and merging them would have been worse. But a shopping
   * session *is* several shops at once: you find three records at one seller,
   * two at another, and want to fill both up to the next postage tier. Losing
   * the first basket to a click on the second is not a simplification, it is
   * silent data loss.
   *
   * The arithmetic stays per shipment. There is simply more than one of them
   * now — see `basketSummaries`.
   */
  await db.put('basket', {
    listingId: match.listingId,
    dealer,
    releaseId: match.releaseId,
    // Stored, not referenced: a dig ages out after five newer ones and the
    // basket has to survive that.
    title: [match.artist, match.title].filter(Boolean).join(' – ') || 'Unbekannt',
    price: match.price ?? 0,
    currency: match.currency ?? '',
    addedAt: now,
    note: null,
  })
}

export async function removeFromBasket(listingId: number): Promise<void> {
  const db = await openFidelityDb()
  await db.delete('basket', listingId)
}

export async function clearBasket(): Promise<void> {
  const db = await openFidelityDb()
  await db.clear('basket')
}

/** Which listings are in the basket — what the cards need to render their state. */
export async function basketListingIds(): Promise<number[]> {
  const db = await openFidelityDb()
  return (await db.getAll('basket')).map((item) => item.listingId)
}

/**
 * One basket per dealer, newest first.
 *
 * Postage is per shipment, so every basket is its own sum, its own tier table
 * and its own advice — that has always been true and has not changed. What
 * changed is that a session can hold several, which is what a session actually
 * looks like.
 *
 * Ordered by the most recent addition, so the shop somebody is working on sits
 * at the top rather than wherever the map happened to put it.
 */
export async function basketSummaries(now: number, country: string): Promise<BasketSummary[]> {
  const db = await openFidelityDb()
  const items = await db.getAll('basket')
  if (items.length === 0) return []

  const byDealer = new Map<string, BasketLine[]>()
  for (const item of items) {
    const line: BasketLine = {
      ...item,
      priceExpired: now - item.addedAt > PRICE_TTL_MS,
      sold: Boolean(item.soldAt),
    }
    const lines = byDealer.get(item.dealer)
    if (lines) lines.push(line)
    else byDealer.set(item.dealer, [line])
  }

  const summaries = await Promise.all(
    [...byDealer].map(async ([dealerName, lines]) => {
      const dealer = await db.get('dealers', dealerName)
      lines.sort((a, b) => a.addedAt - b.addedAt)
      return summarise(lines, dealer ?? null, await tiersFor(dealer, country))
    }),
  )

  const newest = (summary: BasketSummary) =>
    Math.max(...summary.lines.map((line) => line.addedAt))

  return summaries.sort((a, b) => newest(b) - newest(a))
}

async function tiersFor(
  dealer: Dealer | undefined,
  country: string,
): Promise<ShippingResolution> {
  return dealer ? resolveShipping(dealer, country) : { tiers: [], source: null, matched: [] }
}

/**
 * The arithmetic, split out so it can be tested without a database.
 *
 * Everything goes null the moment one price has aged out. A subtotal over the
 * three lines that are still fresh would be a smaller number than the truth,
 * presented with the same confidence — worse than admitting the basket needs
 * a rescan.
 */
export function summarise(
  lines: BasketLine[],
  dealer: Dealer | null,
  shipping: ShippingResolution,
): BasketSummary {
  /*
   * A sold line is still shown but no longer counted.
   *
   * It is not part of the order any more, so leaving it in the subtotal would
   * be a total nobody can pay — and dropping it out of the postage count is
   * the useful half of the bad news: five records back down to four may also
   * be one shipping tier cheaper.
   *
   * The line itself stays. Removing somebody's basket entry behind their back
   * is a decision that is theirs.
   */
  const live = lines.filter((line) => !line.sold)

  const anyExpired = live.some((line) => line.priceExpired)
  const currency = live.find((line) => line.currency)?.currency ?? null

  // Two currencies in one basket cannot be added up, and a browser has no
  // exchange rate it can trust (same reason S10 refuses to convert).
  const mixedCurrency = new Set(live.map((line) => line.currency).filter(Boolean)).size > 1

  const subtotal =
    anyExpired || mixedCurrency ? null : live.reduce((sum, line) => sum + line.price, 0)

  const postage = shippingFor(shipping.tiers, live.length)?.price ?? null
  const total = subtotal === null || postage === null ? null : subtotal + postage
  const minOrderTotal = dealer?.minOrderTotal ?? 0
  /*
   * How far under the dealer's floor this basket is. The threshold on its own
   * is a fact about the shop; the difference is the only part that is about
   * the decision in front of somebody.
   */
  const missingToMinimum =
    subtotal !== null && minOrderTotal > 0 && subtotal < minOrderTotal
      ? minOrderTotal - subtotal
      : null

  return {
    dealer: lines[0]?.dealer ?? '',
    displayName: dealer?.displayName || (lines[0]?.dealer ?? ''),
    avatarUrl: dealer?.avatarUrl,
    // Both filled by the caller, which is the only place that can see the digs.
    candidates: [],
    dig: null,
    lines,
    subtotal,
    currency,
    shipping: postage,
    shippingSource: shipping.source,
    shippingMatched: shipping.matched,
    shippingSection: shipping.section ?? null,
    total,
    perItem: total === null || live.length === 0 ? null : total / live.length,
    advice: shippingAdvice(shipping.tiers, live.length),
    // Two past the current count is enough to see the next step without
    // turning the panel into a table nobody reads.
    curve: shippingCurve(shipping.tiers, Math.max(6, live.length + 2)),
    minOrderTotal,
    belowMinimum: missingToMinimum !== null,
    missingToMinimum,
  }
}
