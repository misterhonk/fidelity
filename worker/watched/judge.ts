import type { WatchedRelease, WatchPoint } from '#shared/types'

/**
 * When a watched record is worth reporting (M11).
 *
 * **Pure functions, no I/O** — like `worker/match/`, and for the same reason:
 * this is the one place with a decision in it, and decisions belong under test
 * without opening a database.
 *
 * The direction depends on whose record it is. On one you own, the **rise** is
 * the news ("the cheapest now costs 95 instead of 40"); on one you want, the
 * **fall** below your own pain threshold.
 */

export type WatchNews =
  | { kind: 'rose'; from: number; to: number; percent: number; currency: string | null }
  | { kind: 'fell'; to: number; threshold: number; currency: string | null }
  | { kind: 'appeared'; numForSale: number; price: number | null; currency: string | null }
  | { kind: 'fewer'; from: number; to: number }
  /**
   * A particular offer is gone — the more precise case of `fewer` (M11).
   *
   * Only possible where a dig on this device saw the offer itself;
   * `worker/watched/offers.ts` explains why that is the only place the watcher
   * may name a shop. And still not "sold": a listing can also be withdrawn.
   */
  | { kind: 'gone'; dealer: string; listingId: number; from: number; to: number }

/**
 * The oldest point that is compared against.
 *
 * Not the penultimate: between two measurements a day apart there is almost
 * never anything, and anyone comparing only neighbours never sees a rise from
 * forty to ninety-five — it comes in thirty small steps. So the comparison is
 * against the oldest point in the window.
 */
export const WINDOW_MS = 90 * 24 * 60 * 60 * 1000

/** How many measurements are kept. One a day, a quarter of a year back. */
export const MAX_POINTS = 120

/**
 * What has happened since the oldest point in the window — or nothing.
 *
 * `null` means "no news", and that is the ordinary case: a record that has
 * cost the same for three months has nothing to say.
 */
export function judge(watched: WatchedRelease, now: number): WatchNews | null {
  const points = watched.points
  const latest = points.at(-1)
  if (!latest) return null

  const oldest = points.find((point) => point.at >= now - WINDOW_MS) ?? points[0]
  if (!oldest || oldest === latest) return null

  if (watched.kind === 'shelf') return judgeShelf(watched, oldest, latest)
  return judgeWantlist(watched, oldest, latest)
}

/**
 * A record you own: has it become worth more?
 *
 * This is the question nobody else answers — Discogs does not tell you, and
 * anyone wanting to sell learns about the rise today by chance.
 */
function judgeShelf(
  watched: WatchedRelease,
  oldest: WatchPoint,
  latest: WatchPoint,
): WatchNews | null {
  const threshold = watched.threshold ?? 25

  if (oldest.lowestPrice !== null && latest.lowestPrice !== null && oldest.lowestPrice > 0) {
    const percent = Math.round(
      ((latest.lowestPrice - oldest.lowestPrice) / oldest.lowestPrice) * 100,
    )
    if (percent >= threshold) {
      return {
        kind: 'rose',
        from: oldest.lowestPrice,
        to: latest.lowestPrice,
        percent,
        currency: latest.currency,
      }
    }
  }

  /*
   * And the other half: copies are disappearing.
   *
   * **"Sold" is not claimed.** A falling `num_for_sale` can be a purchase or a
   * withdrawn listing, and the API does not say which. So the text says "one
   * offer fewer" — what was measured, not what is guessed.
   *
   * Only from two, because a single copy comes and goes constantly.
   */
  if (oldest.numForSale - latest.numForSale >= 2) {
    return { kind: 'fewer', from: oldest.numForSale, to: latest.numForSale }
  }

  return null
}

/**
 * A record you want: has it become affordable — or available at all?
 *
 * ⚠️ Here Fidelity is **weaker than Discogs' own Wantlister**, and that
 * deserves saying: it knows *who* has just listed, because Discogs owns the
 * marketplace. We only see "there are three now, the cheapest at €24". The
 * value added is the **threshold**, not the discovery — which is why none of
 * these messages names a shop.
 */
function judgeWantlist(
  watched: WatchedRelease,
  oldest: WatchPoint,
  latest: WatchPoint,
): WatchNews | null {
  if (watched.threshold !== null && latest.lowestPrice !== null) {
    const before = oldest.lowestPrice
    // Report on crossing only, not for as long as it stays below.
    const above = before === null || before > watched.threshold
    if (above && latest.lowestPrice <= watched.threshold) {
      return {
        kind: 'fell',
        to: latest.lowestPrice,
        threshold: watched.threshold,
        currency: latest.currency,
      }
    }
  }

  // From zero to anything: the record was nowhere to be had and now is. For a
  // rare record that is the real news.
  if (oldest.numForSale === 0 && latest.numForSale > 0) {
    return {
      kind: 'appeared',
      numForSale: latest.numForSale,
      price: latest.lowestPrice,
      currency: latest.currency,
    }
  }

  return null
}

/**
 * Appending a measurement and keeping the history short.
 *
 * One a day at most: anyone opening the app five times measures the same thing
 * five times, and five identical points turn the oldest in the window into
 * this morning's.
 */
export function addPoint(points: WatchPoint[], next: WatchPoint): WatchPoint[] {
  const previous = points.at(-1)
  const sameDay =
    previous !== undefined &&
    new Date(previous.at).toDateString() === new Date(next.at).toDateString()

  const kept = sameDay ? points.slice(0, -1) : points
  return [...kept, next].slice(-MAX_POINTS)
}
