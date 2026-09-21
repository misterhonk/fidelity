import type { LandedPrice, Match, SignalType, SortDirection } from '#shared/types'

import { byScoreThenPrice } from '#shared/score'

import { byStrength } from '~~/worker/match/reason'

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

/**
 * Which way round each ordering starts (M32.2).
 *
 * Every key has one direction that is obviously the right one to offer first
 * — cheapest, newest, A to Z — and it used to be the *only* one: the arrow sat
 * inside the label, baked in, and "price ascending" was the whole of what
 * price sorting meant. Asked for outright on 2026-09-14: "I want to sort the
 * price from cheap to expensive or the other way round."
 *
 * The shelf has had this since M26 (`DEFAULT_SHELF_DIRECTION`), with the same
 * rule: picking a key takes its default, pressing the key again turns it.
 */
export const DEFAULT_DIRECTION = {
  score: 'desc',
  price: 'asc',
  landed: 'asc',
  year: 'desc',
  artist: 'asc',
} as const satisfies Record<SortKey, SortDirection>

export function parseDirection(value: string, sort: SortKey): SortDirection {
  return value === 'asc' || value === 'desc' ? value : DEFAULT_DIRECTION[sort]
}

/**
 * The density, out of the address — in English, and in the German it used to
 * be written in.
 *
 * ADR-010 says addresses are English, and every other view setting on this
 * screen already was: `sig`, `sort`, `dir`, `q`, `upto`. This one stayed
 * `?dicht=kompakt` and `?dicht=kiste` until 2026-09-16, with a comment beside
 * it noting the fact rather than fixing it.
 *
 * The old words are still read, and that is not politeness: a dig's address is
 * the thing people send each other — "look what this shop has" — and `?find=`
 * made a link point at one record. A link sent last week has to open the crate
 * it was sent about. Writing them is over; reading them is forever, the same
 * bargain `renamed.global.ts` struck for the eighteen German paths.
 */
export function parseDensity(value: string): Density {
  if (value === 'compact' || value === 'kompakt') return 'compact'
  if (value === 'crate' || value === 'kiste') return 'crate'
  return 'comfortable'
}

/**
 * Sorting has to survive expiry. Six hours after a dig, title, artist, price
 * and year are gone by design (docs/03 §6) and the score is all that is left —
 * so every key puts the missing ones last rather than letting nulls sort to
 * the front and make an expired dig look like the cheapest shop in town.
 */
/**
 * Which of the two lacks the field this ordering reads — or null where both
 * have it and the real comparison can happen.
 *
 * Split out from `compare` so that turning the direction round cannot turn
 * this round with it: missing belongs last from either end.
 */
function missingFor(
  a: Match,
  b: Match,
  key: SortKey,
  landed: (match: Match) => number | null,
): number | null {
  switch (key) {
    case 'price':
      return missingLast(a.price, b.price)
    case 'landed':
      return missingLast(landed(a), landed(b))
    case 'year':
      return missingLast(a.year, b.year)
    case 'artist':
      return missingLast(a.artist, b.artist)
    default:
      return null
  }
}

/** The key's own order, the way round it is offered first. */
function compare(
  a: Match,
  b: Match,
  key: SortKey,
  landed: (match: Match) => number | null,
): number {
  switch (key) {
    case 'price':
      return a.price! - b.price!
    case 'landed':
      return landed(a)! - landed(b)!
    case 'year':
      return b.year! - a.year!
    case 'artist':
      return a.artist!.localeCompare(b.artist!, activeLocale())
    default:
      return b.score - a.score
  }
}

/**
 * What decides when the ordering in force has nothing left to say (M33 #2).
 *
 * `byScoreThenPrice` from `shared/score.ts`, which is where the rule lives now
 * — and which this file had been getting for free without saying so. It sorted
 * on the score alone; the worker hands its matches over already ranked
 * (`bestPerRelease`), and `Array.sort` is stable, so the price ordering
 * survived underneath a comparison that knew nothing about it. It held, and it
 * held by accident: a change to how the worker loads a dig would have taken it
 * away silently.
 *
 * Outside the direction, deliberately. Turning "by score" round asks for the
 * weakest find first, not for the dearest one — the same reason the score
 * itself never turns when it breaks a tie under `price`.
 */
const tieBreak = byScoreThenPrice

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
 * Which signal a find leads with — the one its sentence is built from.
 *
 * `byStrength` is the engine's own ordering and reads `WEIGHTS`, the table the
 * score comes out of. Asking it here rather than re-deciding means the word on
 * the card can never name a different reason than the sentence would.
 */
export function leadOf(match: Match): SignalType | null {
  return [...match.signals].sort(byStrength)[0]?.type ?? null
}

/**
 * A reason that repeats is not a reason, it is a category (M33 #1).
 *
 * Twenty of twenty-seven cards said "*X* steht schon in deiner Sammlung —
 * diese Platte nicht" on 2026-09-16, with a different X each time. Read once
 * that is the product; read twenty times it is a column heading that somebody
 * printed into every row. The card carries the repeated one as a plate
 * instead, and keeps the sentence for what it has left to say.
 *
 * Two thresholds, because either alone gets a real list wrong. **Five**,
 * because four of anything is still four things you read one at a time. **A
 * quarter of the list**, because five credits among two hundred finds are five
 * discoveries, not a category — and a quarter rather than a half so that two
 * signals dividing a list between them can both be one.
 */
const REPEATED_AT_LEAST = 5
const REPEATED_SHARE = 0.25

export function repeatedLeads(matches: Match[]): Set<SignalType> {
  const leads = new Map<SignalType, number>()
  for (const match of matches) {
    const lead = leadOf(match)
    if (lead) leads.set(lead, (leads.get(lead) ?? 0) + 1)
  }

  const floor = Math.max(REPEATED_AT_LEAST, matches.length * REPEATED_SHARE)
  return new Set([...leads.entries()].filter(([, n]) => n >= floor).map(([type]) => type))
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
  direction: SortDirection = DEFAULT_DIRECTION[sort],
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

  /*
   * The direction turns the *values*, never the missing ones.
   *
   * A record whose price expired belongs at the end of "cheapest first" and at
   * the end of "dearest first" alike — flipping the whole comparison would
   * float the blanks to the top the moment somebody turned the arrow round,
   * and an expired dig would look like the cheapest shop in town from the
   * other end.
   */
  const turn = direction === DEFAULT_DIRECTION[sort] ? 1 : -1
  return [...filtered].sort((a, b) => {
    /*
     * `missingFor` answers null where both have the field, ±1 where one does,
     * and **0 where neither does** — which is not "equal", it is "nothing left
     * to compare but the score".
     */
    const missing = missingFor(a, b, sort, totalOf)
    if (missing !== null) return missing || tieBreak(a, b)
    // Score is the tiebreaker under every other key, so two records at the
    // same price come out in the order the engine ranked them — and under
    // score itself the price carries on where the score stops (M33 #2).
    return turn * compare(a, b, sort, totalOf) || tieBreak(a, b)
  })
}
