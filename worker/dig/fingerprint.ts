import type { DealerFingerprint } from '#shared/types'

import { norm } from '../match/normalize'
import type { Listing } from '../match'

/**
 * "The Clerk's Take" — what a dealer's stock says about the dealer.
 *
 * Accumulated while the scan streams past, because the listings are already in
 * hand and keeping them to compute this afterwards would mean holding 40 MB of
 * inventory in memory for a few percentages.
 *
 * Derived statistics, not marketplace content, so this outlives the six-hour
 * window (docs/03 §6).
 */
export class FingerprintAccumulator {
  readonly #labels = new Map<string, number>()
  readonly #decades = new Map<string, number>()
  readonly #prices: number[] = []
  /** Every currency seen, so a shop that mixes them can say so. */
  readonly #currencies = new Set<string>()
  #sampled = 0

  add(listing: Listing): void {
    this.#sampled += 1

    if (listing.label) {
      const label = listing.label.trim()
      if (label) this.#labels.set(label, (this.#labels.get(label) ?? 0) + 1)
    }

    // Year 0 means Discogs does not know, which is not a decade.
    if (listing.year && listing.year > 1880) {
      const decade = `${Math.floor(listing.year / 10) * 10}er`
      this.#decades.set(decade, (this.#decades.get(decade) ?? 0) + 1)
    }

    if (listing.price !== null && listing.price > 0) {
      this.#prices.push(listing.price)
      if (listing.currency) this.#currencies.add(listing.currency)
    }
  }

  /** How much of the dealer's stock is on labels the collection already has. */
  shareOnKnownLabels(knownLabels: Set<string>): number {
    if (this.#sampled === 0) return 0

    let onKnown = 0
    for (const [label, count] of this.#labels) {
      if (knownLabels.has(norm(label))) onKnown += count
    }
    return onKnown / this.#sampled
  }

  build(totalItems: number): DealerFingerprint {
    return {
      sampledItems: this.#sampled,
      totalItems,
      coverage: totalItems > 0 ? Math.min(1, this.#sampled / totalItems) : 0,
      labelDist: top(this.#labels, 20),
      // Styles are absent from inventory listings and the horizon carries none
      // (docs/02 §3). Left empty rather than filled from the handful of
      // enriched matches, which would describe the matches and not the shop.
      styleDist: {},
      decadeDist: top(this.#decades, 12),
      medianPrice: median(this.#prices),
      // One currency or none. Two shops in one shop is a median of apples and
      // pears, and the screen has to be told rather than left to guess.
      priceCurrency: this.#currencies.size === 1 ? [...this.#currencies][0]! : null,
    }
  }
}

function top(counts: Map<string, number>, limit: number): Record<string, number> {
  return Object.fromEntries(
    [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, limit),
  )
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = sorted.length >> 1
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!
}

/**
 * How well a shop suits you, in a number you can compare between shops.
 *
 * Deliberately not "3.1× better than chance": chance would need a baseline
 * nobody in a browser can measure. Matches per thousand listings needs no
 * baseline at all, and ranking your dealers against each other — which is the
 * actual question — falls straight out of it.
 */
export function matchesPerThousand(matches: number, scanned: number): number {
  return scanned === 0 ? 0 : (matches / scanned) * 1000
}

/**
 * The factor against your own other shops. Only meaningful once more than one
 * has been scanned, and null until then rather than a made-up 1.0.
 */
export function affinityFactor(rate: number, otherRates: number[]): number | null {
  const others = otherRates.filter((value) => value > 0)
  if (others.length === 0) return null

  const sorted = [...others].sort((a, b) => a - b)
  const middle = sorted.length >> 1
  const reference =
    sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!

  return reference > 0 ? rate / reference : null
}
