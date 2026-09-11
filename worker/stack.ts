import { isHidden } from '~~/db/dealer'
import { openFidelityDb } from '~~/db/open'
import type { StackShop } from '#shared/types'

/**
 * The stack: the same finds, only one after another.
 *
 * This module supplies **the top row only** — which shops have a fresh dig and
 * how far somebody has got in each. The cards themselves come from `dig.get`,
 * which has existed all along: the same dig, the same selection, the same
 * order. A second query for the same matches would be a second place where
 * "what do we show first" gets decided.
 *
 * **Costs not one Discogs request.** Everything here is already in IndexedDB,
 * because the dig ran long ago. That is why a swipe stack is possible in this
 * app at all: at 1.2 s a request, a feed that loaded as you swiped would be
 * unusable.
 */

/**
 * How far somebody has got lives on the dig.
 *
 * A store of its own would be a second row per dig that had to keep step with
 * the first — and that would be orphaned the moment a dig is cleared away. As
 * a field, the progress disappears with the dig it belongs to.
 *
 * The field is optional: digs written before the stack do not have it, and
 * "not there" reads as "nothing seen yet" — which is true.
 */
export async function stackOverview(now = Date.now()): Promise<StackShop[]> {
  const db = await openFidelityDb()
  const [digs, dealers] = await Promise.all([db.getAll('digs'), db.getAll('dealers')])

  const byDealer = new Map(dealers.map((dealer) => [dealer.username, dealer]))
  const newest = new Map<string, (typeof digs)[number]>()

  for (const dig of digs) {
    // Expired digs have no business here: the stack shows prices, and after
    // six hours those may not be shown any more (rule 4).
    if (dig.expiresAt <= now) continue
    // Nor does a shop somebody asked never to see again.
    const shop = byDealer.get(dig.dealer)
    if (shop && isHidden(shop)) continue
    const held = newest.get(dig.dealer)
    if (!held || dig.startedAt > held.startedAt) newest.set(dig.dealer, dig)
  }

  const shops: StackShop[] = []
  for (const dig of newest.values()) {
    const count = await db
      .transaction('matches')
      .store.index('by-dig-score')
      .count(IDBKeyRange.bound([dig.id, -Infinity], [dig.id, Infinity]))

    if (count === 0) continue

    const dealer = byDealer.get(dig.dealer)
    shops.push({
      dealer: dig.dealer,
      displayName: dealer?.displayName || dig.dealer,
      avatarUrl: dealer?.avatarUrl,
      digId: dig.id,
      scannedAt: dig.startedAt,
      expiresAt: dig.expiresAt,
      matches: count,
      seen: Math.min(dig.stackSeen ?? 0, count),
    })
  }

  /*
   * Unseen first, newest after that.
   *
   * That is the ring: wherever something is still waiting stands at the front.
   * Sorting purely by date would mean a shop you have been through hiding one
   * where thirty finds are still waiting.
   */
  return shops.sort((a, b) => {
    const openA = a.matches - a.seen > 0
    const openB = b.matches - b.seen > 0
    if (openA !== openB) return openA ? -1 : 1
    return b.scannedAt - a.scannedAt
  })
}

/**
 * Remembers how far the stack has got.
 *
 * **Forwards only.** Anyone swiping back for another look has seen the cards
 * all the same; lowering the counter would switch the ring back on and press a
 * claim onto the screen that is not true.
 */
export async function stackSeen(digId: string, seen: number): Promise<void> {
  const db = await openFidelityDb()
  const dig = await db.get('digs', digId)
  if (!dig) return

  const next = Math.max(dig.stackSeen ?? 0, Math.max(0, Math.floor(seen)))
  if (next === (dig.stackSeen ?? 0)) return

  await db.put('digs', { ...dig, stackSeen: next })
}
