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
 * "geschätzt aus dem Händlertext" wherever it uses one.
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
 * The range may be open at the top: "ab 4", "4+", "4 or more", "ab 4 Stück".
 *
 * A colon counts as a separator so a labelled table — "Porto: 1-2 LPs 7,- €"
 * — finds its first rule. It cannot start a spurious one inside a rule,
 * because what follows a rule's own colon is a price and a price is not a
 * count followed by another price.
 */
const RANGE_RULE = new RegExp(
  String.raw`(?:^|[,;/:\n·|(])\s*(?:ab\s+)?(\d{1,3})\s*(?:\s*(?:[-–—]|to|bis)\s*(\d{1,3})|\s*\+|\s*(?:or more|oder mehr|und mehr))?\s*${UNIT}\s*(?:[:=]|\s)\s*\(?\s*${PRICE}`,
  'gi',
)

/**
 * `Up to 15 records: 6 EUR`, `bis 5 LPs 8 €`, `max. 3 Platten: 7,50`.
 *
 * A ceiling with no floor, which the range shape above cannot express: it
 * needs a number to start from, and this shape starts from one.
 */
const UP_TO_RULE = new RegExp(
  String.raw`(?:^|[,;/:\n·|(])\s*(?:up\s+to|bis(?:\s+zu)?|max\.?|maximal)\s*(\d{1,3})\s*${UNIT}\s*(?:[:=]|\s)\s*\(?\s*${PRICE}`,
  'gi',
)

/** `each additional 1,00 €`, `jede weitere 1 €`, `zzgl. 1 € je weitere LP`. */
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
  /** What the parser thought it recognised, for the interface to show. */
  matched: string[]
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

export function parseShippingText(
  text: string | null | undefined,
  country?: string,
): ParsedShipping {
  const empty: ParsedShipping = { tiers: [], matched: [], section: null }
  if (!text || text.trim().length === 0) return empty

  const sections = splitByPlace(stripBbCode(text))

  /*
   * A dealer who writes one table means it for everybody. A dealer who writes
   * "Germany:", "Europe:" and "Non-Europe:" means three different things, and
   * reading all three as one table is how somebody in Germany was quoted the
   * European rate. Where the text is sorted by destination, only the block for
   * *this* destination may be read — and if none of them is this destination,
   * the answer is nothing (the rule at the top of this file).
   */
  const sorted = sections.some((section) => section.place !== null)
  const section = sorted ? (country ? selectSection(sections, country) : null) : sections[0]
  if (!section) return empty

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
  const additional = ADDITIONAL_RULE.exec(normalised)
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

  return { tiers: dedupe(sortTiers(tiers)), matched, section: section.heading }
}

// ---------------------------------------------------------------------------
// Nach Zielland sortierte Händlertexte.
//
// The common shape of a real shipping box is not one table but three, stacked
// under headings: what it costs at home, what it costs in Europe, what it
// costs everywhere else. Read as one table those rates interleave, and the
// cheapest-looking rule from the wrong continent wins.

interface Section {
  /** The heading verbatim, for the interface to show. `null` for the preamble. */
  heading: string | null
  place: Place | null
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
function stripAsides(text: string): string {
  return text.replace(/\(([^()]*)\)/g, (whole, inner: string) =>
    /[€£$]|\b(?:eur|gbp|usd|chf)\b/i.test(inner) ? whole : ' ',
  )
}

/**
 * A line that is nothing but a place name, with or without a colon.
 *
 * Only lines naming a place count. `Porto:` and `Shipping address Terms:` look
 * identical in shape and are not destinations — treating them as headings
 * would cut a perfectly readable table into pieces that match nothing.
 */
function headingPlace(line: string): Place | null {
  const trimmed = line.trim().replace(/[:：]\s*$/, '')
  if (trimmed.length === 0 || trimmed.length > 40) return null
  if (!/^[\p{L} .\-/&]+$/u.test(trimmed)) return null

  const key = fold(trimmed)
  const region = REGIONS[key]
  if (region) return region

  const name = canonical(key)
  return EUROPE.has(name) || OVERSEAS.has(name) ? { kind: 'country', name } : null
}

function canonical(folded: string): string {
  return COUNTRY_ALIASES[folded] ?? folded
}

function splitByPlace(text: string): Section[] {
  const sections: { heading: string | null; place: Place | null; lines: string[] }[] = [
    { heading: null, place: null, lines: [] },
  ]

  for (const line of text.split(/\r?\n/)) {
    const place = headingPlace(line)
    if (place)
      sections.push({ heading: line.trim().replace(/[:：]\s*$/, ''), place, lines: [] })
    else sections.at(-1)!.lines.push(line)
  }

  return sections
    .filter((section) => section.place !== null || section.lines.some((line) => line.trim()))
    .map(({ heading, place, lines }) => ({ heading, place, text: lines.join('\n') }))
}

/**
 * The block that covers this destination, or nothing.
 *
 * Nothing is a real answer: a dealer who lists Germany, Europe and Non-Europe
 * has said nothing about Japan, and the screen saying "Versand unbekannt –
 * trag ihn ein" is worth more than a number taken from the wrong continent.
 */
function selectSection(sections: Section[], country: string): Section | null {
  const want = canonical(fold(country))

  const named = sections.find(
    (section) => section.place?.kind === 'country' && section.place.name === want,
  )
  if (named) return named

  const region = EUROPE.has(want) ? 'europe' : 'outside-europe'
  const regional = sections.find((section) => section.place?.kind === region)
  if (regional) return regional

  return sections.find((section) => section.place?.kind === 'world') ?? null
}

// ---------------------------------------------------------------------------

/**
 * Two rules covering the same count is a table the parser misread. The first
 * one wins rather than the cheaper: picking the cheaper would bias every
 * ambiguous table towards an optimistic number.
 */
function dedupe(tiers: ShippingTier[]): ShippingTier[] {
  const out: ShippingTier[] = []
  for (const tier of tiers) {
    if (!out.some((kept) => kept.minItems === tier.minItems)) out.push(tier)
  }
  return out
}
