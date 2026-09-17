import type { ShippingTier } from '#shared/types'

import { sortTiers } from './shipping'

/**
 * Reading a dealer's shipping table out of free text.
 *
 * This is a heuristic and it is labelled one everywhere it surfaces
 * (docs/00 §7 point 3). `seller.shipping` is a free-text box: dealers write
 * German, English, tables, prose, emoji and sometimes nothing useful at all.
 *
 * The rule that keeps it honest: **recognise or refuse.** Anything that does
 * not match a shape below produces no tier rather than a guess, because a
 * wrong postage table is worse than no postage table — somebody plans a
 * purchase around it and finds out at the checkout.
 *
 * Every tier it produces carries `source: 'parsed'`, and the basket says
 * "estimated from the dealer text" wherever it uses one.
 */

/** Shapes this understands, for the interface to show when it fails. */
export const UNDERSTOOD_SHAPES = [
  '1 LP: 6,00 €, 2-3 LP: 9,00 €, ab 4 LP: 12,00 €',
  '1 record 5 EUR, each additional 1 EUR',
  'Porto: 1-2 LPs 7,50 / 3-5 LPs 10,-',
  'Up to 15 records: 6 EUR',
]

const CURRENCIES: Record<string, string> = {
  '€': 'EUR',
  eur: 'EUR',
  euro: 'EUR',
  '£': 'GBP',
  gbp: 'GBP',
  $: 'USD',
  usd: 'USD',
  chf: 'CHF',
}

/**
 * A price with its currency. Handles "6,00 €", "€6.00", "7,-", "EUR 12".
 *
 * German writes 1.234,56 and English 1,234.56, so the decimal separator is
 * decided by which one comes last rather than assumed.
 */
const PRICE = String.raw`(?:(€|£|\$|EUR|GBP|USD|CHF)\s*)?(\d{1,4}(?:[.,]\d{1,3})*(?:[.,]-)?)\s*(€|£|\$|EUR|GBP|USD|CHF)?`

function toNumber(raw: string): number | null {
  // "7,-" and "7.-" are German shorthand for a round amount.
  const trimmed = raw.replace(/[.,]-$/, '')

  const lastComma = trimmed.lastIndexOf(',')
  const lastDot = trimmed.lastIndexOf('.')

  let normalised: string
  if (lastComma === -1 && lastDot === -1) {
    normalised = trimmed
  } else if (lastComma > lastDot) {
    // German: dots group, the comma decides.
    normalised = trimmed.replace(/\./g, '').replace(',', '.')
  } else {
    normalised = trimmed.replace(/,/g, '')
  }

  const value = Number(normalised)
  return Number.isFinite(value) && value >= 0 ? value : null
}

function toCurrency(...marks: (string | undefined)[]): string | null {
  for (const mark of marks) {
    if (!mark) continue
    const found = CURRENCIES[mark.toLowerCase()]
    if (found) return found
  }
  return null
}

/** "LP", "record", "Platte", "item", "disc" — the noun is noise, the number is not. */
const UNIT = String.raw`(?:x\s*)?(?:lps?|platten?|records?|items?|discs?|st(?:ü|ue)ck|ea)?`

/**
 * `2-3 LP: 9,00 €` and `1 LP 6 €` and `ab 4 Platten 12 EUR`.
 * The range may be open at the top: "ab 4", "4+", "4 or more", "ab 4 Stück"
 * — the German forms are what dealers write, not what this file speaks.
 *
 * A colon counts as a separator so a labelled table — "Porto: 1-2 LPs 7,- €"
 * — finds its first rule. It cannot start a spurious one inside a rule,
 * because what follows a rule's own colon is a price and a price is not a
 * count followed by another price.
 */
/**
 * A count, a range or an open end, a unit or two, a separator, a price.
 *
 * Grown on 2026-09-16 by the text of a British shop (tests/fixtures): "1st LP
 * - £12.00" is an ordinal, "8 or more LP discs £8.00" has two unit words, and
 * "4-7 discs - £5.50" puts a dash between the count and the price. The dash
 * before the price must be followed by a space, or it would eat a range.
 */
const RANGE_RULE = new RegExp(
  String.raw`(?:^|[,;/:\n·|(])\s*(?:ab\s+)?(\d{1,3})(?:st|nd|rd|th)?\s*(?:\s*(?:[-–—]|to|bis)\s*(\d{1,3})|\s*\+|\s*(?:or more|oder mehr|und mehr))?\s*${UNIT}\s*${UNIT}\s*(?:[:=]|[-–—]\s|\s)\s*\(?\s*${PRICE}`,
  'gi',
)

/**
 * `Up to 15 records: 6 EUR`, `bis 5 LPs 8 €`, `max. 3 Platten: 7,50`.
 *
 * A ceiling with no floor, which the range shape above cannot express: it
 * needs a number to start from, and this shape starts from one.
 */
const UP_TO_RULE = new RegExp(
  String.raw`(?:^|[,;/:\n·|(])\s*(?:up\s*to|bis(?:\s+zu)?|max\.?|maximal)\s*(\d{1,3})\s*${UNIT}\s*(?:[:=]|[-–—]\s|\s)\s*\(?\s*${PRICE}`,
  'gi',
)

/** `each additional 1,00 €`, `jede weitere 1 €`, `zzgl. 1 € je weitere LP`. */
/** The same step with the price first: "+ £1.50 PER ADDITIONAL LP" (2026-09-17). */
const ADDITIONAL_BEFORE_RULE = new RegExp(
  String.raw`\+?\s*${PRICE}\s*(?:per|each|for each|je)\s+(?:additional|extra|further|weitere[nrs]?)\s*${UNIT}`,
  'i',
)

const ADDITIONAL_RULE = new RegExp(
  String.raw`(?:each\s+(?:additional|extra)|jede[rs]?\s+weitere[nrs]?|per\s+additional)\s*${UNIT}\s*(?:[:=]|\s)?\s*${PRICE}`,
  'i',
)

/**
 * A matched rule as it is worth showing: without the separator it matched on,
 * and without the gaps that dropping an aside left behind.
 */
function tidy(whole: string): string {
  return whole
    .replace(/^[,;/:\n·|(]\s*/, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([:=])/g, '$1')
    .trim()
}

export interface ParsedShipping {
  tiers: ShippingTier[]
  /**
   * "Free delivery when you spend more than £75" (M34.3): the threshold in
   * the seller's currency, for the place the tiers were read for. A line
   * that names another place ("EU buyers: … £300") is not the one.
   */
  freeOver: { amount: number; currency: string } | null
  /** What the parser thought it recognised, for the interface to show. */
  matched: string[]
  /**
   * The shop bills by weight, not by record.
   *
   * Reported from a real shop on 2026-09-13: "1 bis 1999 Gramm: 14,00 €, 2000
   * bis 4999 Gramm: 24,50 €". There is no honest way to turn that into a table
   * per record — an LP with its sleeve and a mailer is somewhere between 250
   * and 500 grams depending on the pressing, the gatefold and the packaging,
   * and picking a number would be exactly the guess the rule at the top of
   * this file refuses to make. Somebody plans a purchase around it.
   *
   * So it is recognised and named instead of refused in silence: the screen
   * can say "this shop bills by weight" and put the shop's own words next to
   * the form, which is what turns an impossible parse into two minutes of
   * typing.
   */
  byWeight: boolean
  /**
   * The heading whose block the tiers were read from, verbatim — `Germany`,
   * `Europe`, `Rest of World`. `null` when the text had no country headings
   * and was read as one table.
   */
  section: string | null
}

/**
 * How far an "each additional" rule is extended.
 *
 * Twelve because a table has to end somewhere and nobody posts thirteen
 * records as one order — and because the alternative, an open-ended tier, would
 * claim the rule holds for fifty, which no dealer means.
 */
export const ADDITIONAL_UP_TO = 12

/**
 * Free postage above an order value, in the shapes sellers write it:
 * "FREE DELIVERY WHEN YOU SPEND MORE THAN £75", "free postage if you spend
 * £75", "versandkostenfrei ab 100 €", "gratis over €150".
 */
const FREE_OVER_RULE = new RegExp(
  String.raw`(?:free|kostenlos|kostenfrei|gratis|versandkostenfrei|portofrei)[^
]{0,60}?(?:over|above|from|more than|ab|über|spend(?:ing)?\s+(?:more than\s+|over\s+|at least\s+)?|orders?\s+(?:over|above|of))\s*${PRICE}`,
  'i',
)

/**
 * A table priced by grams rather than by records.
 *
 * "1 bis 1999 Gramm: 14,00 €" and "101 bis 500 Gramm: 16,50 €" — a real shop,
 * measured 2026-09-13. Two numbers, a weight unit between them and a price
 * after: enough to be sure, and narrow enough that "500g vinyl" in a listing
 * description does not trip it, because that carries no second number and no
 * price.
 *
 * Deliberately only ever a *label*. Converting grams to records needs a weight
 * per record, and there is no honest one — see `ParsedShipping.byWeight`.
 */
const WEIGHT_RULE = new RegExp(
  String.raw`\d[\d.,]*\s*(?:-|–|bis|to|until|up to)\s*\d[\d.,]*\s*(?:g|gr|gram|gramm|grams|gramme|kg)\b`,
  'i',
)

/** Or the open-ended top of such a table: "ab 5000 Gramm: 34,00 €". */
const WEIGHT_FROM_RULE = new RegExp(
  String.raw`(?:ab|from|over|above|\u00fcber)\s*\d[\d.,]*\s*(?:g|gr|gram|gramm|grams|gramme|kg)\b`,
  'i',
)

export function billsByWeight(text: string | null | undefined): boolean {
  if (!text) return false
  const clean = stripBbCode(text)
  return WEIGHT_RULE.test(clean) || WEIGHT_FROM_RULE.test(clean)
}

export function parseShippingText(
  text: string | null | undefined,
  country?: string,
): ParsedShipping {
  const empty: ParsedShipping = {
    tiers: [],
    matched: [],
    section: null,
    byWeight: false,
    freeOver: null,
  }
  if (!text || text.trim().length === 0) return empty

  const byWeight = billsByWeight(text)
  const sections = splitByPlace(stripBbCode(text))

  /*
   * A dealer who writes one table means it for everybody. A dealer who writes
   * "Germany:", "Europe:" and "Non-Europe:" means three different things, and
   * reading all three as one table is how somebody in Germany was quoted the
   * European rate. Where the text is sorted by destination, only the block for
   * *this* destination may be read — and if none of them is this destination,
   * the answer is nothing (the rule at the top of this file).
   */
  const sorted = sections.some((section) => section.places.length > 0)
  const section = sorted ? (country ? selectSection(sections, country) : null) : sections[0]
  if (!section) return { ...empty, byWeight }

  // Newlines and bullets are separators like commas; the rules key off those.
  const normalised = `,${stripAsides(section.text).replace(/[\r\n••]+/g, ',')}`

  const tiers: ShippingTier[] = []
  const matched: string[] = []

  for (const hit of normalised.matchAll(UP_TO_RULE)) {
    const [whole, to, currencyBefore, amount, currencyAfter] = hit
    const price = toNumber(amount ?? '')
    const currency = toCurrency(currencyBefore, currencyAfter)
    const maxItems = Number(to)
    if (price === null || !currency || !Number.isFinite(maxItems) || maxItems < 1) continue

    tiers.push({ minItems: 1, maxItems, price, currency, source: 'parsed' })
    matched.push(tidy(whole))
  }

  for (const hit of normalised.matchAll(RANGE_RULE)) {
    const [whole, from, to, currencyBefore, amount, currencyAfter] = hit
    const price = toNumber(amount ?? '')
    const currency = toCurrency(currencyBefore, currencyAfter)
    const minItems = Number(from)

    // No currency, no tier. A bare "1 LP: 6" could be six of anything, and
    // guessing euros because the dealer ships from Germany is exactly the kind
    // of assumption that produces a wrong number nobody can trace.
    if (price === null || !currency || !Number.isFinite(minItems) || minItems < 1) continue

    // `whole` still carries the separator it matched on, so the "ab" test
    // runs against the trimmed rule rather than against ", ab 4 LP: 12 €".
    const rule = tidy(whole)
    const openEnded = to === undefined && /\+|or more|oder mehr|und mehr|^ab\s/i.test(rule)
    const maxItems = to !== undefined ? Number(to) : openEnded ? null : minItems

    if (maxItems !== null && maxItems < minItems) continue

    tiers.push({ minItems, maxItems, price, currency, source: 'parsed' })
    matched.push(rule)
  }

  // "1 record 5 EUR, each additional 1 EUR" — the second half only means
  // something with a first tier to build on.
  const additional = ADDITIONAL_RULE.exec(normalised) ?? ADDITIONAL_BEFORE_RULE.exec(normalised)
  const base = sortTiers(tiers)[0]
  if (additional && base && base.maxItems !== null) {
    const step = toNumber(additional[2] ?? '')
    const currency = toCurrency(additional[1], additional[3]) ?? base.currency

    if (step !== null && currency === base.currency) {
      for (let items = base.maxItems + 1; items <= ADDITIONAL_UP_TO; items++) {
        const extra = items - base.maxItems
        tiers.push({
          minItems: items,
          maxItems: items,
          price: base.price + step * extra,
          currency,
          source: 'parsed',
        })
      }
      matched.push(additional[0].trim())
    }
  }

  return {
    tiers: dedupe(sortTiers(tiers)),
    matched,
    section: section.heading,
    byWeight,
    freeOver: freeOverFor(stripBbCode(text), section),
  }
}

// ---------------------------------------------------------------------------
// Dealer texts sorted by destination country.
//
// The common shape of a real shipping box is not one table but three, stacked
// under headings: what it costs at home, what it costs in Europe, what it
// costs everywhere else. Read as one table those rates interleave, and the
// cheapest-looking rule from the wrong continent wins.

/**
 * The free-over threshold for the section that was read.
 *
 * Sellers put these lines above the tables, one per destination: "UK
 * BUYERS: … £75", "EU BUYERS: … £300". A line counts when its own prefix
 * names the section's place, or when it names none and stands inside the
 * section. A line for another place is left alone.
 */
function freeOverFor(text: string, section: Section): ParsedShipping['freeOver'] {
  const inSection = new Set(section.text.split(/\r?\n/).map((line) => line.trim()))

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    const hit = FREE_OVER_RULE.exec(line)
    if (!hit) continue
    const amount = toNumber(hit[2] ?? '')
    const currency = toCurrency(hit[1], hit[3])
    if (amount === null || !currency) continue

    const colon = line.search(/[:：]/)
    const prefix = colon > 0 ? line.slice(0, colon) : ''
    const named = prefix
      ? headingPlaces(
          prefix.replace(/\b(?:buyers?|customers?|orders?|k\u00e4ufer|kunden)\b/gi, ''),
        )
      : []

    if (named.length > 0) {
      if (named.some((place) => section.places.some((own) => samePlace(place, own))))
        return { amount, currency }
      continue
    }
    if (inSection.has(line) || section.places.length === 0) return { amount, currency }
  }
  return null
}

/** A country and its region are the same place for a free-over line. */
function samePlace(a: Place, b: Place): boolean {
  if (a.kind === 'country' || b.kind === 'country') {
    return a.kind === 'country' && b.kind === 'country' && a.name === b.name
  }
  return a.kind === b.kind
}

interface Section {
  /** The heading verbatim, for the interface to show. `null` for the preamble. */
  heading: string | null
  places: Place[]
  text: string
}

type Place =
  | { kind: 'country'; name: string }
  | { kind: 'europe' }
  | { kind: 'world' }
  | { kind: 'outside-europe' }

/** Lowercase, unaccented, letters and single spaces — so `Österreich` compares. */
function fold(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .trim()
}

/** Spellings of the same place. English is the canonical side, as Discogs is. */
const COUNTRY_ALIASES: Record<string, string> = {
  deutschland: 'germany',
  brd: 'germany',
  osterreich: 'austria',
  oesterreich: 'austria',
  schweiz: 'switzerland',
  suisse: 'switzerland',
  svizzera: 'switzerland',
  niederlande: 'netherlands',
  holland: 'netherlands',
  frankreich: 'france',
  italien: 'italy',
  spanien: 'spain',
  belgien: 'belgium',
  danemark: 'denmark',
  schweden: 'sweden',
  norwegen: 'norway',
  finnland: 'finland',
  polen: 'poland',
  tschechien: 'czechia',
  'czech republic': 'czechia',
  griechenland: 'greece',
  irland: 'ireland',
  grossbritannien: 'united kingdom',
  'great britain': 'united kingdom',
  uk: 'united kingdom',
  england: 'united kingdom',
  usa: 'united states',
  'united states of america': 'united states',
  japan: 'japan',
}

/** Words that name a region rather than a country. */
const REGIONS: Record<string, Place> = {
  europe: { kind: 'europe' },
  europa: { kind: 'europe' },
  eu: { kind: 'europe' },
  'european union': { kind: 'europe' },
  'europaische union': { kind: 'europe' },
  'eu member': { kind: 'europe' },
  'eu lander': { kind: 'europe' },
  'rest of europe': { kind: 'europe' },
  'within europe': { kind: 'europe' },
  'innerhalb europas': { kind: 'europe' },
  'ubriges europa': { kind: 'europe' },
  'eu ausland': { kind: 'europe' },
  worldwide: { kind: 'world' },
  world: { kind: 'world' },
  'world wide': { kind: 'world' },
  weltweit: { kind: 'world' },
  welt: { kind: 'world' },
  international: { kind: 'world' },
  'rest of world': { kind: 'world' },
  'rest of the world': { kind: 'world' },
  'all other countries': { kind: 'world' },
  'other countries': { kind: 'world' },
  'ubrige lander': { kind: 'world' },
  'alle anderen lander': { kind: 'world' },
  'non europe': { kind: 'outside-europe' },
  'outside europe': { kind: 'outside-europe' },
  'ausserhalb europas': { kind: 'outside-europe' },
  'non eu': { kind: 'outside-europe' },
  overseas: { kind: 'outside-europe' },
  ubersee: { kind: 'outside-europe' },
}

/**
 * Where a `Europe:` heading applies. Canonical English names, because that is
 * what `shipsToCountry` holds and what Discogs itself uses.
 */
const EUROPE = new Set([
  'albania',
  'andorra',
  'austria',
  'belarus',
  'belgium',
  'bosnia and herzegovina',
  'bulgaria',
  'croatia',
  'cyprus',
  'czechia',
  'denmark',
  'estonia',
  'finland',
  'france',
  'germany',
  'greece',
  'hungary',
  'iceland',
  'ireland',
  'italy',
  'kosovo',
  'latvia',
  'liechtenstein',
  'lithuania',
  'luxembourg',
  'malta',
  'moldova',
  'monaco',
  'montenegro',
  'netherlands',
  'north macedonia',
  'norway',
  'poland',
  'portugal',
  'romania',
  'russia',
  'san marino',
  'serbia',
  'slovakia',
  'slovenia',
  'spain',
  'sweden',
  'switzerland',
  'ukraine',
  'united kingdom',
  'vatican city',
])

/** Destinations outside Europe common enough to be written as a heading. */
const OVERSEAS = new Set([
  'united states',
  'canada',
  'australia',
  'new zealand',
  'japan',
  'brazil',
  'mexico',
  'south africa',
  'china',
  'south korea',
  'israel',
  'singapore',
])

/** BBCode is what a dealer's editor leaves behind; it never carries meaning here. */
function stripBbCode(text: string): string {
  return text.replace(/\[\/?[a-z][a-z0-9]*(?:=[^\]]*)?\]/gi, ' ')
}

/**
 * Drops parentheses that hold no money.
 *
 * `Up to 15 records (DHL-Paket,1-2 days): 6 EUR` carries a comma and a range
 * inside an aside about the courier, and a comma is a rule separator here — so
 * the aside would otherwise be read as a rule of its own. Anything with a
 * currency in it stays, because then the parenthesis *is* the rule.
 */
/**
 * Parentheses go, unless what is inside is a price: "1 LP (5 €)" keeps its
 * price, "1-3 LP discs (over £5 value) - £4.00" loses the aside. Until
 * 2026-09-17 any aside with a currency mark survived, and that aside sat
 * between the count and the price and hid a whole tier.
 */
const PRICE_ONLY = new RegExp(
  String.raw`^\s*(?:ca\.?\s*|~\s*)?${PRICE}\s*(?:each|je|pro St(?:ü|ue)ck)?\s*$`,
  'i',
)

function stripAsides(text: string): string {
  return text.replace(/\(([^()]*)\)/g, (whole, inner: string) =>
    PRICE_ONLY.test(inner) ? whole : ' ',
  )
}

/**
 * A line that is nothing but a place name, with or without a colon.
 *
 * Only lines naming a place count. `Porto:` and `Shipping address Terms:` look
 * identical in shape and are not destinations — treating them as headings
 * would cut a perfectly readable table into pieces that match nothing.
 */
/**
 * The places a heading names — usually one, sometimes two: "USA/ REST OF THE
 * WORLD:" is both a country and the world, and a buyer from either is meant.
 *
 * Grown on 2026-09-17 by a British shop: "UK (INCLUDING NORTHERN IRELAND)"
 * carries an aside, "THE EUROPEAN UNION:" a leading article, and the third
 * block names two places with a slash.
 */
function headingPlaces(line: string): Place[] {
  const trimmed = line
    .trim()
    .replace(/[:：]\s*$/, '')
    .replace(/\([^)]*\)/g, ' ')
    .trim()
  if (trimmed.length === 0 || trimmed.length > 48) return []
  if (!/^[\p{L} .\-/&]+$/u.test(trimmed)) return []

  const places: Place[] = []
  for (const part of trimmed.split('/')) {
    const key = fold(part).replace(/^the /, '')
    if (!key) continue
    const region = REGIONS[key]
    if (region) {
      places.push(region)
      continue
    }
    const name = canonical(key)
    if (EUROPE.has(name) || OVERSEAS.has(name)) places.push({ kind: 'country', name })
  }
  return places
}

function canonical(folded: string): string {
  return COUNTRY_ALIASES[folded] ?? folded
}

function splitByPlace(text: string): Section[] {
  const sections: { heading: string | null; places: Place[]; lines: string[] }[] = [
    { heading: null, places: [], lines: [] },
  ]

  for (const line of text.split(/\r?\n/)) {
    const places = headingPlaces(line)
    if (places.length > 0)
      sections.push({ heading: line.trim().replace(/[:：]\s*$/, ''), places, lines: [] })
    else sections.at(-1)!.lines.push(line)
  }

  return sections
    .filter((section) => section.places.length > 0 || section.lines.some((line) => line.trim()))
    .map(({ heading, places, lines }) => ({ heading, places, text: lines.join('\n') }))
}

function selectSection(sections: Section[], country: string): Section | null {
  const want = canonical(fold(country))

  const named = sections.find((section) =>
    section.places.some((place) => place.kind === 'country' && place.name === want),
  )
  if (named) return named

  const region = EUROPE.has(want) ? 'europe' : 'outside-europe'
  const regional = sections.find((section) =>
    section.places.some((place) => place.kind === region),
  )
  if (regional) return regional

  return (
    sections.find((section) => section.places.some((place) => place.kind === 'world')) ?? null
  )
}

function dedupe(tiers: ShippingTier[]): ShippingTier[] {
  const out: ShippingTier[] = []
  for (const tier of tiers) {
    if (!out.some((kept) => kept.minItems === tier.minItems)) out.push(tier)
  }
  return out
}
