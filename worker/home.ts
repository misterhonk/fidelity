import { openFidelityDb } from '~~/db/open'
import { getSyncState } from '~~/db/meta'

import type { FidelityDB } from '~~/db/schema'
import type { HomeCover, HomeFind, HomeOverview, HomeShop } from '#shared/protocol'
import type { IDBPDatabase } from 'idb'

/**
 * Alles für die Startseite, in einer Nachricht.
 *
 * The screen shows five things at once — the last dig, the newest records, the
 * newest wishes, the shops, the counts — and every one of them is a read on
 * this device. Assembling them here rather than firing five requests from the
 * page keeps the arithmetic off the main thread (CLAUDE.md) and, more to the
 * point, keeps the whole screen from arriving in five separate flickers.
 *
 * **Nothing here touches Discogs.** Opening the app must not spend a request:
 * the budget is 60 a minute and it belongs to the dig somebody is about to
 * start, not to a dashboard they glanced at.
 */

/** How many covers a rail shows before "alle ansehen" is the better answer. */
const RAIL = 12

/** Shops on the shelf. More than this and it stops being a shortlist. */
const SHOPS = 6

/**
 * The newest N of a store, without materialising all of it.
 *
 * `addedAt` is an ISO 8601 string from Discogs — it sorts lexicographically,
 * which is the reason it was stored in that form. There is no index on it, so
 * this is a full cursor walk either way; what it avoids is holding a copy of a
 * five-thousand-record collection in memory to sort it and then throw away all
 * but twelve.
 */
async function newest(
  db: IDBPDatabase<FidelityDB>,
  store: 'collection' | 'wantlist',
  limit: number,
): Promise<HomeCover[]> {
  const top: HomeCover[] = []

  for await (const cursor of db.transaction(store).store) {
    const item = cursor.value

    // Cheapest possible rejection: once the list is full, anything older than
    // its last entry cannot belong in it.
    if (top.length === limit && item.addedAt <= top[top.length - 1]!.addedAt) continue

    const entry: HomeCover = {
      releaseId: item.releaseId,
      title: item.title,
      artist: item.artistNames[0] ?? '',
      year: item.year,
      thumbUrl: item.thumbUrl,
      coverUrl: item.coverUrl,
      addedAt: item.addedAt,
    }

    const at = top.findIndex((existing) => entry.addedAt > existing.addedAt)
    top.splice(at === -1 ? top.length : at, 0, entry)
    if (top.length > limit) top.pop()
  }

  return top
}

export async function homeOverview(): Promise<HomeOverview> {
  const db = await openFidelityDb()
  const syncState = await getSyncState()

  const [digs, dealers, feedback, shelf, wanted] = await Promise.all([
    db.getAll('digs'),
    db.getAll('dealers'),
    db.getAll('feedback'),
    newest(db, 'collection', RAIL),
    newest(db, 'wantlist', RAIL),
  ])

  /*
   * The newest dig that found something, and only then the newest of all.
   *
   * Dig ids are time-ordered by construction. Taking the newest outright was
   * right until "nur das Neue" existed: that visit costs one request and
   * frequently turns up nothing, which is a perfectly good answer — but it
   * would then hide a shop's real find list behind an empty rail. The heading
   * names the shop and how long ago, so an older dig here says what it is.
   */
  const byNewest = digs.sort((a, b) => b.id.localeCompare(a.id))
  const latest = byNewest.find((dig) => dig.matchCount > 0) ?? byNewest[0] ?? null

  let finds: HomeFind[] = []
  if (latest) {
    /*
     * Only the top of the list. A dig can hold thousands of matches and the
     * rail shows twelve — sending the rest across postMessage would be the
     * most expensive thing the start screen does, for nothing anybody sees.
     */
    const scored = await db.getAllFromIndex(
      'matches',
      'by-dig-score',
      IDBKeyRange.bound([latest.id, -Infinity], [latest.id, Infinity]),
    )

    finds = scored
      .reverse()
      .slice(0, RAIL)
      .map((match) => ({
        digId: match.digId,
        listingId: match.listingId,
        releaseId: match.releaseId,
        score: match.score,
        signals: match.signals,
        title: match.title,
        artist: match.artist,
        thumbUrl: match.thumbUrl,
        price: match.price,
        currency: match.currency,
        expired: match.expired,
      }))
  }

  const shops: HomeShop[] = dealers
    .slice()
    // Affinity first — that is the whole point of measuring it. A shop that
    // has never been scored sorts below one that has, rather than above it.
    .sort((a, b) => (b.affinity ?? -1) - (a.affinity ?? -1))
    .slice(0, SHOPS)
    .map((dealer) => ({
      username: dealer.username,
      displayName: dealer.displayName || dealer.username,
      affinity: dealer.affinity,
      numForSale: dealer.numForSale,
      lastScannedAt: dealer.lastScannedAt,
    }))

  return {
    library: {
      collection: await db.count('collection'),
      wantlist: await db.count('wantlist'),
      dealers: dealers.length,
      basket: await db.count('basket'),
      marked: feedback.filter((entry) => entry.verdict === 'interesting').length,
      collectionSyncedAt: syncState.collectionSyncedAt,
      wantlistSyncedAt: syncState.wantlistSyncedAt,
    },
    dig: latest
      ? {
          id: latest.id,
          dealer: latest.dealer,
          startedAt: latest.startedAt,
          expiresAt: latest.expiresAt,
          matches: latest.matchCount,
          complete: latest.status === 'done',
          scanned: latest.listingsScanned,
          listingsTotal: latest.listingsTotal,
        }
      : null,
    finds,
    shelf,
    wanted,
    shops,
  }
}
