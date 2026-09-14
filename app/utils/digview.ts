import type { LandedPrice, Match, SignalType } from '#shared/types'

import { activeLocale } from '~/composables/useMessages'

/**
 * Filtering, sorting and counting for a dig result — pure, so it can be tested
 * without a router or a DOM. `useDigView` is the thin part that binds these to
 * the URL; everything that can actually be wrong lives here.
 */

export type SortKey = 'score' | 'price' | 'landed' | 'year' | 'artist'
/**
 * Three ways to look at the same finds (M31.22).
 *
 * `comfortable` is the default and the only one that carries the sentence
 * saying *why* a record is in the list — which is the app's whole product, so
 * it is what somebody sees first. `compact` is a table for comparing two
 * hundred of them. `crate` is the one a phone needed: a card with a big cover
 * is one screen per record, and flipping through two hundred and fifty-nine
 * finds that way is two hundred and fifty-nine swipes. In a real crate you see
 * twenty spines at once.
 */
export type Density = 'comfortable' | 'compact' | 'crate'

/**
 * The orderings, in the order they are offered. Keys only — the labels carry a
 * direction arrow and live in the pack with everything else somebody reads.
 */
export const SORTS = [
  'score',
  'price',
  'landed',
  'year',
  'artist',
] as const satisfies readonly SortKey[]

/**
 * What the list knows about postage, when it knows anything.
 *
 * `of` is the landed price of a record or null (`shared/shipping.ts` says
 * when); `upTo` is the filter somebody typed, in the shop's currency. Both
 * optional: the shared-list screen and the stack sort the same matches with
 * no shop context at all.
 */
export interface LandedView {
  of: (match: Match) => LandedPrice | null
  upTo: number | null
}

/** A ceiling out of the URL, or null for anything that is not a positive amount. */
export function parseUpTo(value: string): number | null {
  const amount = Number(value.replace(',', '.'))
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

const SORT_KEYS = new Set<string>(SORTS)

export function parseSort(value: string): SortKey {
  return SORT_KEYS.has(value) ? (value as SortKey) : 'score'
}

export function parseDensity(value: string): Density {
  if (value === 'kompakt') return 'compact'
  // German in the address, like `dicht` itself and `kompakt` beside it.
  if (value === 'kiste') return 'crate'
  return 'comfortable'
}

/**
 * Sorting has to survive expiry. Six hours after a dig, title, artist, price
 * and year are gone by design (docs/03 §6) and the score is all that is left —
 * so every key puts the missing ones last rather than letting nulls sort to
 * the front and make an expired dig look like the cheapest shop in town.
 */
function compare(
  a: Match,
  b: Match,
  key: SortKey,
  landed: (match: Match) => number | null,
): number {
  switch (key) {
    case 'price':
      return missingLast(a.price, b.price) ?? a.price! - b.price!
    case 'landed': {
      const la = landed(a)
      const lb = landed(b)
      return missingLast(la, lb) ?? la! - lb!
    }
    case 'year':
      return missingLast(a.year, b.year) ?? b.year! - a.year!
    case 'artist':
      return (
        missingLast(a.artist, b.artist) ?? a.artist!.localeCompare(b.artist!, activeLocale())
      )
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
 * Free text over everything printed on the card. Deliberately a plain
 * substring test on a normalised string and not the trigram cascade the
 * matching engine uses: this is somebody typing a name they can already see,
 * not the engine guessing whether two spellings are the same record.
 */
export function textMatches(match: Match, needle: string): boolean {
  if (!needle) return true
  const haystack = [match.artist, match.title, match.label, match.catno]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return needle
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word))
}

/**
 * Chips are OR, not AND. Two selected chips answer "show me the wantlist hits
 * and the label ones", which is what somebody scanning a shelf means; AND
 * would mostly return nothing and read as a bug.
 *
 * Text narrows on top of the chips rather than replacing them — the two are
 * different questions and both should be answerable at once.
 */
export function arrange(
  matches: Match[],
  active: SignalType[],
  sort: SortKey,
  query = '',
  landed: LandedView | null = null,
): Match[] {
  const wanted = new Set(active)
  const needle = query.trim()

  /*
   * Computed once per record, not once per comparison: a sort makes n·log n
   * comparisons, and the landed price walks a tier table each time it is
   * asked. Only when something actually reads it — most views never do.
   */
  const totals = new Map<number, number | null>()
  const wantsLanded = landed !== null && (sort === 'landed' || landed.upTo !== null)
  const totalOf = (match: Match): number | null => {
    if (!wantsLanded) return null
    if (!totals.has(match.listingId))
      totals.set(match.listingId, landed.of(match)?.total ?? null)
    return totals.get(match.listingId) ?? null
  }

  const filtered = matches.filter((match) => {
    if (wanted.size > 0 && !match.signals.some((signal) => wanted.has(signal.type)))
      return false
    if (!textMatches(match, needle)) return false
    // A ceiling with postage keeps only what can be priced with postage: a
    // record nobody can put a number on is not "under €30", it is unknown.
    if (landed?.upTo !== null && landed?.upTo !== undefined) {
      const total = totalOf(match)
      if (total === null || total > landed.upTo) return false
    }
    return true
  })

  // Score is the tiebreaker under every other key, so two records at the same
  // price come out in the order the engine ranked them.
  return [...filtered].sort((a, b) => compare(a, b, sort, totalOf) || b.score - a.score)
}
