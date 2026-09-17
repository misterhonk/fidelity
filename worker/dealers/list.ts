import { getPreferences } from '~~/db/meta'
import { openFidelityDb } from '~~/db/open'
import { tiersForUnit } from '#shared/shipping'
import type { Dealer, DealerWithReasons, ListingPostage } from '#shared/types'

import { freshPostage } from '../basket/postage'
import { parseShippingText } from '../basket/parse-shipping'
import { shippingFor } from '../basket/shipping'
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

  // One read for the lot: what Discogs named for one record at each shop.
  const db = await openFidelityDb()
  const now = Date.now()
  const items = await db.getAll('basket')
  const named = new Map<string, ListingPostage | null>()
  for (const dealer of dealers) {
    named.set(
      dealer.username,
      freshPostage(
        items.filter((item) => item.dealer === dealer.username),
        now,
      ),
    )
  }
  const home = (await getPreferences()).shipsToCountry

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
      postageFrom: postageFromFor(dealer, named.get(dealer.username) ?? null, home),
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

/**
 * What one record costs to post from a shop, in order of trust: Discogs'
 * own figure off a fresh basket line, the table the user typed, a reading
 * of the shop's text for the home country. No hub and no bundled file here;
 * a list of forty shops is drawn from what is on the device.
 */
export function postageFromFor(
  dealer: Dealer,
  named: ListingPostage | null,
  home: string,
): DealerWithReasons['postageFrom'] {
  if (named) {
    return named.original
      ? { value: named.original.value, currency: named.original.currency, source: 'discogs' }
      : { value: named.value, currency: named.currency, source: 'discogs' }
  }
  const own = shippingFor(
    dealer.shippingTiers.filter((tier) => tier.source === 'user' || tier.source === 'order'),
    1,
  )
  if (own) return { value: own.price, currency: own.currency, source: own.source }

  const parsed = shippingFor(
    tiersForUnit(parseShippingText(dealer.shippingNote, home).tiers, 'record'),
    1,
  )
  return parsed ? { value: parsed.price, currency: parsed.currency, source: 'parsed' } : null
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
