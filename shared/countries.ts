/**
 * "Only from Germany / the EU" (docs/06 M20 #2).
 *
 * Seven forum threads since 2014 ask for a ships-from filter on the wants, and
 * staff said in 2021 there is none. Here it is a view: on the plan and on the
 * shops screen, in the address, beside the block list that stays the hard rule.
 *
 * Canonical English names, lower-cased for the comparison — that is what
 * `shipsFrom` carries (docs/02: an English country name, not a code) and what
 * `shipsToCountry` holds. The list is the customs union, not the continent:
 * "from the EU" is asked for because of customs and postage, and Switzerland,
 * Norway and the UK are exactly the cases the question is about.
 */

export type OriginFilter = 'any' | 'home' | 'eu'

export const ORIGIN_FILTERS: OriginFilter[] = ['any', 'home', 'eu']

/** The 27 member states, as Discogs spells them. */
export const EU = new Set([
  'austria',
  'belgium',
  'bulgaria',
  'croatia',
  'cyprus',
  'czechia',
  'czech republic',
  'denmark',
  'estonia',
  'finland',
  'france',
  'germany',
  'greece',
  'hungary',
  'ireland',
  'italy',
  'latvia',
  'lithuania',
  'luxembourg',
  'malta',
  'netherlands',
  'poland',
  'portugal',
  'romania',
  'slovakia',
  'slovenia',
  'spain',
  'sweden',
])

const key = (name: string | null | undefined) => (name ?? '').trim().toLowerCase()

export function isEu(country: string | null | undefined): boolean {
  return EU.has(key(country))
}

export function sameCountry(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = key(a)
  return left.length > 0 && left === key(b)
}

/**
 * Whether a shop's origin passes the filter.
 *
 * Unknown is out under any filter but "any": a shop that has not said where it
 * ships from cannot be "from Germany", and showing it there would be the same
 * guess the block list refuses to make.
 */
export function passesOrigin(
  shipsFrom: string | null | undefined,
  filter: OriginFilter,
  home: string,
): boolean {
  if (filter === 'any') return true
  if (filter === 'home') return sameCountry(shipsFrom, home)
  return isEu(shipsFrom)
}

export function readOrigin(value: unknown): OriginFilter {
  return value === 'home' || value === 'eu' ? value : 'any'
}
