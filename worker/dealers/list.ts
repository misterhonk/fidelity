import type { DealerWithReasons } from '#shared/types'

import { affinityFactor } from '../dig/fingerprint'

import { visibleDealers } from './hide'
import { withReasons } from './reasons'

/**
 * The shops, best first — with the reasons each one is on the list and the
 * verdict pair beside it (M34.4).
 *
 * The pair says what the profile's two sentences say, in two plate words on
 * the row: how the hit rate stands against the median of your other shops,
 * and where the median price sits among them. Same thresholds as the
 * profile, so a row and its profile never disagree.
 */
export async function rankedDealers(): Promise<DealerWithReasons[]> {
  const dealers = await withReasons(await visibleDealers())

  const rates = dealers.filter((d) => d.affinity !== null).map((d) => d.affinity!)
  const medians = dealers
    .map((d) => d.fingerprint?.medianPrice ?? 0)
    .filter((value) => value > 0)

  const rows = dealers.map((dealer) => {
    const others = (list: number[], mine: number) => {
      const at = list.indexOf(mine)
      return at < 0 ? list : [...list.slice(0, at), ...list.slice(at + 1)]
    }
    const rate = dealer.affinity
    const median = dealer.fingerprint?.medianPrice ?? 0
    return {
      ...dealer,
      fit: rate === null ? null : fitOf(affinityFactor(rate, others(rates, rate))),
      priceBand: median > 0 ? bandOf(affinityFactor(median, others(medians, median))) : null,
    }
  })

  /*
   * Dug shops first, then by hit rate, then by name. A shop known only by
   * name has no rate and would otherwise sort as "worse than every dug one".
   */
  return rows.sort(
    (a, b) =>
      Number(b.lastScannedAt !== null) - Number(a.lastScannedAt !== null) ||
      (b.affinity ?? 0) - (a.affinity ?? 0) ||
      a.username.localeCompare(b.username),
  )
}

/** The profile's thresholds (app/pages/dealers.vue `verdict`). */
export function fitOf(factor: number | null): DealerWithReasons['fit'] {
  if (factor === null) return null
  if (factor >= 1.5) return 'above'
  if (factor >= 0.8) return 'same'
  return 'below'
}

/** The profile's thresholds (`pricePosition`). */
export function bandOf(factor: number | null): DealerWithReasons['priceBand'] {
  if (factor === null) return null
  if (factor >= 1.25) return 'high'
  if (factor <= 0.8) return 'low'
  return 'middle'
}
