import type { Match, SignalType } from '#shared/types'

/**
 * Filtering, sorting and counting for a dig result — pure, so it can be tested
 * without a router or a DOM. `useDigView` is the thin part that binds these to
 * the URL; everything that can actually be wrong lives here.
 */

export type SortKey = 'score' | 'price' | 'year' | 'artist'
export type Density = 'comfortable' | 'compact'

export const SORTS = [
  { key: 'score', label: 'Score' },
  { key: 'price', label: 'Preis' },
  { key: 'year', label: 'Jahr' },
  { key: 'artist', label: 'Künstler' },
] as const satisfies readonly { key: SortKey; label: string }[]

const SORT_KEYS = new Set<string>(SORTS.map((sort) => sort.key))

export function parseSort(value: string): SortKey {
  return SORT_KEYS.has(value) ? (value as SortKey) : 'score'
}

export function parseDensity(value: string): Density {
  return value === 'kompakt' ? 'compact' : 'comfortable'
}

/**
 * Sorting has to survive expiry. Six hours after a dig, title, artist, price
 * and year are gone by design (docs/03 §6) and the score is all that is left —
 * so every key puts the missing ones last rather than letting nulls sort to
 * the front and make an expired dig look like the cheapest shop in town.
 */
function compare(a: Match, b: Match, key: SortKey): number {
  switch (key) {
    case 'price':
      return missingLast(a.price, b.price) ?? a.price! - b.price!
    case 'year':
      return missingLast(a.year, b.year) ?? b.year! - a.year!
    case 'artist':
      return missingLast(a.artist, b.artist) ?? a.artist!.localeCompare(b.artist!, 'de')
    default:
      return b.score - a.score
  }
}

/**
 * Ranks a present value ahead of a missing one, and returns null when both
 * sides have the field so the caller can do the real comparison.
 *
 * Written out rather than leaning on `null ?? Infinity` arithmetic: two
 * missing years subtracted give NaN, NaN is falsy, and the tie-break would
 * then work only by accident.
 */
function missingLast(a: unknown, b: unknown): number | null {
  const hasA = a !== null && a !== undefined && a !== ''
  const hasB = b !== null && b !== undefined && b !== ''
  if (hasA && hasB) return null
  return (hasA ? 0 : 1) - (hasB ? 0 : 1)
}

/**
 * The signals the chips can offer, with how many matches carry each.
 *
 * Derived from the list rather than from SIGNAL_TYPES: a chip for a signal
 * that fired nowhere is a filter that can only ever empty the screen.
 */
export function availableSignals(matches: Match[]): { type: SignalType; n: number }[] {
  const counts = new Map<SignalType, number>()
  for (const match of matches) {
    // A match cannot carry the same signal twice, so no dedup is needed here —
    // and if it ever could, counting both would be the honest answer anyway.
    for (const signal of match.signals) {
      counts.set(signal.type, (counts.get(signal.type) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([type, n]) => ({ type, n }))
    .sort((a, b) => b.n - a.n || a.type.localeCompare(b.type))
}

/**
 * Which of the requested signals are real. Validated against what is actually
 * in the list, so a stale or hand-edited URL degrades to "no filter" instead
 * of an empty screen with no way back.
 */
export function parseSignals(raw: string, matches: Match[]): SignalType[] {
  const wanted = new Set(raw.split(',').filter(Boolean))
  const present = new Set(matches.flatMap((match) => match.signals.map((s) => s.type)))
  return [...present].filter((type) => wanted.has(type))
}

/**
 * Chips are OR, not AND. Two selected chips answer "show me the wantlist hits
 * and the label ones", which is what somebody scanning a shelf means; AND
 * would mostly return nothing and read as a bug.
 */
export function arrange(matches: Match[], active: SignalType[], sort: SortKey): Match[] {
  const wanted = new Set(active)
  const filtered =
    wanted.size === 0
      ? matches
      : matches.filter((match) => match.signals.some((signal) => wanted.has(signal.type)))

  // Score is the tiebreaker under every other key, so two records at the same
  // price come out in the order the engine ranked them.
  return [...filtered].sort((a, b) => compare(a, b, sort) || b.score - a.score)
}
