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
  String.raw`(?:^|[,;/:\n·|])\s*(?:ab\s+)?(\d{1,3})\s*(?:\s*[-–—]\s*(\d{1,3})|\s*\+|\s*(?:or more|oder mehr|und mehr))?\s*${UNIT}\s*(?:[:=]|\s)\s*${PRICE}`,
  'gi',
)

/** `each additional 1,00 €`, `jede weitere 1 €`, `zzgl. 1 € je weitere LP`. */
const ADDITIONAL_RULE = new RegExp(
  String.raw`(?:each\s+(?:additional|extra)|jede[rs]?\s+weitere[nrs]?|per\s+additional)\s*${UNIT}\s*(?:[:=]|\s)?\s*${PRICE}`,
  'i',
)

export interface ParsedShipping {
  tiers: ShippingTier[]
  /** What the parser thought it recognised, for the interface to show. */
  matched: string[]
}

/**
 * How far an "each additional" rule is extended.
 *
 * Twelve because a table has to end somewhere and nobody posts thirteen
 * records as one order — and because the alternative, an open-ended tier, would
 * claim the rule holds for fifty, which no dealer means.
 */
export const ADDITIONAL_UP_TO = 12

export function parseShippingText(text: string | null | undefined): ParsedShipping {
  const empty: ParsedShipping = { tiers: [], matched: [] }
  if (!text || text.trim().length === 0) return empty

  // Newlines and bullets are separators like commas; the rules key off those.
  const normalised = `,${text.replace(/[\r\n••]+/g, ',')}`

  const tiers: ShippingTier[] = []
  const matched: string[] = []

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
    const rule = whole.replace(/^[,;/:\n·|]\s*/, '').trim()
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

  return { tiers: dedupe(sortTiers(tiers)), matched }
}

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
