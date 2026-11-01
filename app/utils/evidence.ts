import { count, decimal, money } from '~/utils/money'

/** Evidence keys that count records: written as whole numbers, thousands separated. */
const COUNTS = new Set(['owned', 'total', 'inRun', 'numForSale'])

/** Evidence keys that are prices, in the evidence's own `currency`. */
const PRICES = new Set(['price', 'marketLowest'])

/** Years and catalogue numbers are names, not quantities: "1972", never "1,972". */
const AS_IS = new Set(['wantedYear', 'pressingYear', 'number'])

/**
 * The evidence behind a signal, rendered as a phrase for the release sheet.
 *
 * Only keys in `labels` are shown. Evidence also carries internal handles —
 * releaseId, masterId — and printing "releaseId: 10.147.986" at somebody is
 * worse than printing nothing: it looks like an answer and is not one.
 */
export function evidenceOf(
  evidence: Record<string, unknown>,
  labels: Record<string, string>,
): string {
  const parts: string[] = []
  for (const [key, value] of Object.entries(evidence)) {
    const label = labels[key]
    if (!label || value === null || value === undefined || value === '') continue

    let shown: string
    if (Array.isArray(value)) shown = value.slice(0, 3).join(', ')
    else if (typeof value !== 'number' || AS_IS.has(key)) shown = String(value)
    else if (COUNTS.has(key)) shown = count(value)
    else if (PRICES.has(key)) {
      const currency = typeof evidence.currency === 'string' ? evidence.currency : null
      shown = money(value, currency) ?? decimal(value, 2)
    } else shown = decimal(value, 2)
    parts.push(`${label}: ${shown}`)
  }
  return parts.join(' · ')
}
