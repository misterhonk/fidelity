import { isHidden } from '~~/db/dealer'
import { openFidelityDb } from '~~/db/open'
import type { Stand } from '#shared/types'

/**
 * The stands at a record fair (docs/06 M19 #4).
 *
 * A fair is several shops in one afternoon, and the scans happen at home the
 * morning before. So the in-store screen needs the shops scanned in the last
 * day, not only the last one: the newest dig per shop, whether or not it has
 * passed its six hours — at a fair it usually has, and the finds and their
 * reasons stay while the prices go (rule 4, and the screen says so).
 *
 * A dig with no finds is not a stand: the list would be empty, and "do I own
 * this?" works without one. Hidden shops are not stands either.
 */
export const STAND_WINDOW_MS = 24 * 60 * 60 * 1000

export async function recentStands(now = Date.now()): Promise<Stand[]> {
  const db = await openFidelityDb()
  const [digs, dealers] = await Promise.all([db.getAll('digs'), db.getAll('dealers')])
  const byDealer = new Map(dealers.map((dealer) => [dealer.username, dealer]))

  const newest = new Map<string, (typeof digs)[number]>()
  for (const dig of digs) {
    if (dig.startedAt < now - STAND_WINDOW_MS) continue
    if (dig.matchCount === 0) continue
    const shop = byDealer.get(dig.dealer)
    if (shop && isHidden(shop)) continue
    const held = newest.get(dig.dealer)
    if (!held || dig.startedAt > held.startedAt) newest.set(dig.dealer, dig)
  }

  return [...newest.values()]
    .sort((a, b) => b.startedAt - a.startedAt)
    .map((dig) => {
      const shop = byDealer.get(dig.dealer)
      return {
        dealer: dig.dealer,
        displayName: shop?.displayName || dig.dealer,
        avatarUrl: shop?.avatarUrl,
        digId: dig.id,
        scannedAt: dig.startedAt,
        expiresAt: dig.expiresAt,
        matches: dig.matchCount,
        status: dig.status,
      }
    })
}
