import { openFidelityDb } from '~~/db/open'

/**
 * Which particular offers a dig saw for a record (M11).
 *
 * **Why this can exist at all.** The watcher asks
 * `/marketplace/stats/{id}` and gets a number: "three copies, cheapest €24".
 * Who is offering them, Discogs does not say — `/marketplace/listings?
 * release_id=…` answers 405, and there is no substitute (`docs/02`). Which is
 * why no shop appears on the watcher screen.
 *
 * With **one** exception, and it is this: a dig this device ran itself has
 * seen offers with their listing id. Those survive expiry — `db/expire.ts`
 * nulls the marketplace fields, and `listingId` and `digId` are ours. A single
 * offer can be fetched through `GET /marketplace/listings/{id}`, and `status`
 * says whether it is still to be had.
 *
 * That turns "one offer fewer" into "the copy at Plattenkiste is gone". Not
 * "sold" — a listing can also be withdrawn, and the API does not say which of
 * the two.
 */

/**
 * How many offers are looked up per report.
 *
 * Each costs a request, and the watcher runs over up to a hundred records.
 * Three is the point at which "looking something up" would become an
 * operation: the question is only asked when the count has fallen anyway, and
 * that is rare.
 */
export const MAX_CONFIRM = 3

export interface SeenOffer {
  listingId: number
  /** Where it was seen. The only shop this screen is allowed to name. */
  dealer: string
  /** When the dig ran — newest first; older is likelier to be gone. */
  at: number
}

/**
 * The offers from the digs that were kept, newest first.
 *
 * With no index over `releaseId`: the digs are capped at five
 * (`DIG_HISTORY_LIMIT`), and an index written on every scan costs more than a
 * walk that rarely happens.
 */
export async function seenOffers(releaseId: number): Promise<SeenOffer[]> {
  const db = await openFidelityDb()

  const whenAndWho = new Map<string, { at: number; dealer: string }>()
  for (const dig of await db.getAll('digs')) {
    whenAndWho.set(dig.id, { at: dig.startedAt, dealer: dig.dealer })
  }

  const found = new Map<number, SeenOffer>()
  for (const match of await db.getAll('matches')) {
    if (match.releaseId !== releaseId) continue

    const dig = whenAndWho.get(match.digId)
    if (!dig) continue

    /*
     * The same offer in two digs is one offer. The newer find is kept — it
     * carries the shop it was last seen under.
     */
    const known = found.get(match.listingId)
    if (known && known.at >= dig.at) continue

    found.set(match.listingId, { listingId: match.listingId, dealer: dig.dealer, at: dig.at })
  }

  return [...found.values()].sort((a, b) => b.at - a.at)
}
