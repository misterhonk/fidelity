import type { Match } from '#shared/types'

import { norm } from './normalize'

/**
 * Turning a pile of matches into a list worth reading.
 *
 * Pure functions on purpose: what gets shown first is a product decision, and
 * product decisions deserve tests rather than a sort call buried in a
 * template.
 */

export const TOP_FIVE = 5

/** Strongest first; cheaper wins a tie, then the lower listing id for stability. */
function byRank(a: Match, b: Match): number {
  if (b.score !== a.score) return b.score - a.score
  const priceA = a.price ?? Infinity
  const priceB = b.price ?? Infinity
  if (priceA !== priceB) return priceA - priceB
  return a.listingId - b.listingId
}

/**
 * Folds several copies of the same record into one.
 *
 * A dealer routinely lists the same release two or three times in different
 * conditions. Those are duplicates in the only sense that matters here — you
 * would buy one of them — so the best-ranked copy stands for the rest.
 *
 * Two different records by the same artist are NOT duplicates. That a shop has
 * three Trentemøller records you lack is a finding, not noise.
 */
export function bestPerRelease(matches: Match[]): { matches: Match[]; folded: number } {
  const best = new Map<number, Match>()

  for (const match of [...matches].sort(byRank)) {
    if (!best.has(match.releaseId)) best.set(match.releaseId, match)
  }

  return { matches: [...best.values()].sort(byRank), folded: matches.length - best.size }
}

/**
 * The shortlist. At most one record per artist, so five different finds rather
 * than the same name three times — the full list below keeps everything.
 *
 * If there are not enough distinct artists to fill it, the remaining places go
 * to the next best regardless: an empty slot helps nobody.
 */
export function topFive(matches: Match[], limit: number = TOP_FIVE): Match[] {
  const ranked = [...matches].sort(byRank)
  const seenArtists = new Set<string>()
  const picked: Match[] = []
  const rest: Match[] = []

  for (const match of ranked) {
    const artist = norm(match.artist ?? '')
    if (picked.length < limit && artist.length > 0 && !seenArtists.has(artist)) {
      seenArtists.add(artist)
      picked.push(match)
    } else {
      rest.push(match)
    }
  }

  return [...picked, ...rest].slice(0, limit)
}
