import type { Match } from '#shared/types'

/**
 * What a stand's row may say at a record fair (#241).
 *
 * While the list is fresh: the listing's price. Past six hours: no price and
 * no condition (rule 4) — the catalogue facts, the reason and the link stay,
 * and the user's own max price takes the price's place, because that is the
 * number worth having in hand at the stand and it was never Discogs' data.
 * `expired` is checked here too, not only trusted to the worker's stripping.
 */
export function standRow(
  match: Pick<Match, 'expired' | 'price' | 'currency' | 'label' | 'catno' | 'year'>,
  maxPrice: number | null,
) {
  return {
    price: match.expired ? null : match.price,
    currency: match.expired ? null : match.currency,
    facts: [match.label, match.catno, match.year].filter(Boolean).join(' · '),
    maxPrice: match.expired ? maxPrice : null,
  }
}
