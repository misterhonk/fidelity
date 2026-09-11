import { openFidelityDb } from '~~/db/open'

import type { StockRow } from '#shared/types'

/**
 * A shop's inventory, filtered by one bar.
 *
 * The numbers under "labels in stock" and "decades" were dead information
 * until now: you could see that fatplastics carries 13 records on Kompakt, and
 * could reach none of them. That matters most for a label you own nothing by —
 * where there is by definition no match to lead you there.
 *
 * **Read through an index, not through a walk.** A large shop has twenty
 * thousand rows; fetching all of them to show twenty would be noticeable on a
 * phone. `by-dig-label` and `by-dig-decade` turn it into a range read, and the
 * slice comes through a cursor.
 */

/** How many rows a page holds when nobody says otherwise. */
export const STOCK_PAGE = 50

export interface StockQuery {
  dealer: string
  /** Exactly the spelling from the bar. */
  label?: string | null
  /** `1990` for the nineties. */
  decade?: number | null
  offset?: number
  limit?: number
}

export interface StockPage {
  rows: StockRow[]
  /** How many there are altogether — for "20 of 213" and for paging. */
  total: number
  /**
   * When the dig these rows come from ran.
   *
   * Zero means: there is no fresh one. The inventory is marketplace data and
   * lives six hours (rule 4); after that it is deleted, not stale. The screen
   * has to be able to say the difference between "the shop has none of it" and
   * "we do not know right now".
   */
  scannedAt: number | null
}

export async function dealerStock({
  dealer,
  label = null,
  decade = null,
  offset = 0,
  limit = STOCK_PAGE,
}: StockQuery): Promise<StockPage> {
  const db = await openFidelityDb()

  /*
   * The newest dig that is still allowed to live.
   *
   * Dig ids are ULIDs, so lexicographic order is chronological order. An
   * expired one does not count: its rows are gone, and an empty result from it
   * would wrongly mean "the shop does not carry that".
   */
  const now = Date.now()
  const fresh = (await db.getAll('digs'))
    .filter((dig) => dig.dealer === dealer && dig.status !== 'expired' && dig.expiresAt > now)
    .sort((a, b) => b.id.localeCompare(a.id))[0]

  if (!fresh) return { rows: [], total: 0, scannedAt: null }

  const store = db.transaction('stock').store
  const [index, value] =
    decade !== null
      ? ([store.index('by-dig-decade'), decade] as const)
      : ([store.index('by-dig-label'), label] as const)

  // `IDBKeyRange.only` on the compound key: the same dig, exactly this value.
  // Without the dig at the front, two shops would bleed into each other.
  const range = IDBKeyRange.only([fresh.id, value])
  const total = await index.count(range)

  const rows: StockRow[] = []
  let cursor = await index.openCursor(range)
  // `advance(0)` throws, so the jump only happens where there is something to
  // skip.
  if (cursor && offset > 0) cursor = await cursor.advance(offset)

  while (cursor && rows.length < limit) {
    rows.push(cursor.value)
    cursor = await cursor.continue()
  }

  /*
   * Most expensive first is the wrong order for an inventory list — somebody
   * going through a label wants it in sequence. By year, and within a year by
   * title: that is how a discography stands on any shelf.
   */
  rows.sort(
    (a, b) => (a.year ?? 0) - (b.year ?? 0) || (a.title ?? '').localeCompare(b.title ?? ''),
  )

  return { rows, total, scannedAt: fresh.startedAt }
}
