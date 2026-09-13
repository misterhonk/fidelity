import { openFidelityDb } from '~~/db/open'
import type { Dealer, DealerReason, DealerWithReasons } from '#shared/types'

/**
 * Why each shop is on the list (M30).
 *
 * Reported as a question: nine shops in a Discogs friends list, one of them
 * on this screen, and nothing anywhere saying which of the two lists a row
 * came from. A row without a reason is a row nobody trusts — and the reason
 * is also what turns this from a log of what happened to be dug into a list
 * worth reading.
 *
 * Three reasons are derived from what is on the device and three are stored,
 * because nothing afterwards can tell a shop imported from an order from one
 * imported from the friends list.
 *
 * **`wantlist` is not among them, and that is not an omission.** "Shops that
 * offer something on my wantlist" needs a listings-by-release endpoint;
 * Discogs has none that may be used (rule 5). Where a dig has found such a
 * record its shop is here as `dug` and the find list names the record. The
 * ones nobody has dug cannot be found at all, and a screen that implied
 * otherwise would be promising a search that does not exist.
 */
export async function withReasons(dealers: Dealer[]): Promise<DealerWithReasons[]> {
  const db = await openFidelityDb()

  // One read for the lot rather than one per shop: a basket holds a handful of
  // lines and this runs on every visit to two different screens.
  const inBasket = new Set(
    (await db.getAll('basket')).filter((item) => !item.soldAt).map((item) => item.dealer),
  )

  return dealers.map((dealer) => ({ ...dealer, reasons: reasonsFor(dealer, inBasket) }))
}

export function reasonsFor(dealer: Dealer, inBasket: Set<string>): DealerReason[] {
  const reasons: DealerReason[] = []

  /*
   * Dug first, because it is the strongest thing that can be said about a
   * shop: everything else on the screen — the hit rate, the labels, the
   * postage, the comparison — exists only for a shop that has been walked.
   */
  if (dealer.lastScannedAt !== null) reasons.push('dug')
  if (inBasket.has(dealer.username)) reasons.push('basket')
  if (dealer.watching === true) reasons.push('watched')

  /*
   * And how it first arrived. `dig` adds nothing that the first line has not
   * already said, so it is left off rather than repeated — and a row from
   * before this field existed has no `addedBy` at all, which reads the same.
   */
  if (dealer.addedBy && dealer.addedBy !== 'dig') reasons.push(dealer.addedBy)

  return reasons
}
