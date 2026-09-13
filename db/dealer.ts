import { countryIn } from '#shared/countries'
import type { Dealer } from '#shared/types'

/**
 * A dealer row with nothing in it yet.
 *
 * Two callers create one: a scan, which then fills in what it learned, and a
 * hand-typed postage table for a shop that has never been scanned. Both need
 * the same shape, and defining it once is what stops the next field from being
 * added in one place and forgotten in the other — which is precisely how
 * scanning a shop came to stop watching it.
 */
/** Whether a shop was hidden — absent on old rows, which is "no". */
export function isHidden(dealer: Pick<Dealer, 'hiddenAt'>): boolean {
  return typeof dealer.hiddenAt === 'number'
}

export function blankDealer(username: string): Dealer {
  return {
    username,
    displayName: username,
    shipsFrom: '',
    sellerRating: 0,
    ratingCount: 0,
    numForSale: 0,
    minOrderTotal: 0,
    shippingNote: '',
    lastScannedAt: null,
    newestListedAt: null,
    affinity: null,
    fingerprint: null,
    shippingTiers: [],
  }
}

/**
 * A dealer row whose `shipsFrom` holds the wrong field, put right (v14).
 *
 * A listing's `ships_from` is an English country name (docs/02). A user
 * profile's `location` is a free-text box, and that is what the import and the
 * hand-entered shop were writing here — `fatplastics` carried "Schillergäßchen
 * 5, 07745 Jena, Thuringia, Germany - phone: ++49-3641-35.38.00". The origin
 * filter compared that against "Germany" and hid every shop under every
 * filter.
 *
 * Returns the row unchanged where there is nothing to do, so the migration can
 * compare and skip. Nothing is lost: a line that names no country keeps its
 * place in `location` and only stops being mistaken for one.
 */
export function repairShipsFrom(dealer: Dealer): Dealer {
  const written = (dealer.shipsFrom ?? '').trim()
  if (written.length === 0) return dealer

  const country = countryIn(written)
  if (country === written) return dealer

  return { ...dealer, shipsFrom: country ?? '', location: dealer.location ?? written }
}
