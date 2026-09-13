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

export type OriginFilter = 'any' | 'home' | 'eu' | 'europe'

export const ORIGIN_FILTERS: OriginFilter[] = ['any', 'home', 'eu', 'europe']

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

/**
 * Europe, the continent — which is a different question from the EU.
 *
 * "From the EU" is about a customs border. For somebody in Zurich, London or
 * Oslo that border runs the wrong way round: the EU is the group they pay duty
 * to, and the shops that reach them without a customs form are the ones in
 * their own country. What they are actually asking is "near me" — a parcel
 * that takes three days instead of three weeks, and a seller who has heard of
 * their address format.
 *
 * So the two live side by side. The EU set is the customs union and stays
 * exactly as it was; this one is the continent, and it is the useful filter
 * for the two-thirds of Europe that is not in the other list.
 */
export const EUROPE = new Set([
  ...EU,
  'albania',
  'andorra',
  'bosnia and herzegovina',
  'faroe islands',
  'gibraltar',
  'guernsey',
  'iceland',
  'isle of man',
  'jersey',
  'kosovo',
  'liechtenstein',
  'moldova',
  'monaco',
  'montenegro',
  'north macedonia',
  'norway',
  'san marino',
  'serbia',
  'switzerland',
  'ukraine',
  'united kingdom',
  'vatican city',
])

const key = (name: string | null | undefined) => (name ?? '').trim().toLowerCase()

export function isEu(country: string | null | undefined): boolean {
  return EU.has(key(country))
}

export function isEurope(country: string | null | undefined): boolean {
  return EUROPE.has(key(country))
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
  if (filter === 'europe') return isEurope(shipsFrom)
  return isEu(shipsFrom)
}

export function readOrigin(value: unknown): OriginFilter {
  return value === 'home' || value === 'eu' || value === 'europe' ? value : 'any'
}

/**
 * Where this device is, as the English country name Discogs uses.
 *
 * The default used to be the string `'Germany'`, written once by somebody
 * sitting in Germany. Every other user got a chip saying "From Germany" and a
 * postage estimate for the wrong border until they found the setting — and the
 * one thing they were least likely to go looking for is a setting that is
 * already filled in.
 *
 * The browser knows. `navigator.languages` is ordered by preference, and the
 * first entry that carries a region carries the right one; `de` on its own
 * says nothing about where somebody is and is skipped rather than guessed at.
 * Germany remains the last resort, because a wrong default is still better
 * than an empty one — the filter would otherwise match nothing at all.
 *
 * Only ever a *default*. `getPreferences` merges what is stored over this, so
 * anybody who has chosen a country keeps it.
 */
let guessed: string | null = null

export function guessHomeCountry(): string {
  /*
   * Worked out once per process, and not before something asks.
   *
   * `Intl.DisplayNames` is not free to construct — `app/utils/countries.ts`
   * says so about its own copy — and the first version of this ran at module
   * load of `db/meta.ts`, which nearly everything in the worker imports. On a
   * slow CI container that showed up as a five-second assertion failing in a
   * spec about shelves, three commits away from anything to do with countries.
   */
  if (guessed !== null) return guessed

  const tags: string[] = [
    ...(globalThis.navigator?.languages ?? []),
    globalThis.navigator?.language ?? '',
  ].filter(Boolean)

  for (const tag of tags) {
    let region: string | undefined
    try {
      region = new Intl.Locale(tag).region
    } catch {
      // A tag the runtime will not parse says nothing. The next one might.
      continue
    }
    if (!region) continue

    try {
      const name = new Intl.DisplayNames(['en'], { type: 'region' }).of(region)
      // `of` hands back the code itself for a region it does not know, which
      // is not a country name and must not reach a comparison with Discogs.
      if (name && name !== region) {
        guessed = name
        return guessed
      }
    } catch {
      break
    }
  }

  guessed = 'Germany'
  return guessed
}

/** For the tests, which stub `navigator` between cases. */
export function forgetHomeCountry(): void {
  guessed = null
}
