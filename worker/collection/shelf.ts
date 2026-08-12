import { openFidelityDb } from '~~/db/open'
import type { ShelfHit, ShelfResult } from '#shared/types'

import { norm, tokens } from '../match/normalize'
import { distinctReleases } from '~~/db/collection'

/**
 * "Habe ich die schon?"
 *
 * The one question somebody standing in a shop with a record in their hand
 * wants answered, and until now the in-store screen could only answer it for
 * records the last dig happened to find — which is to say, for one online
 * dealer's stock, and never for the crate in front of you.
 *
 * Everything needed is already on the device: the collection and the wantlist
 * were synced in M1. No requests, no network, no rate limit — which matters,
 * because record shops are basements and basements have no signal.
 *
 * Deliberately not the trigram cascade the matcher uses. That exists because
 * inventory artists arrive as free text with no ids and have to be guessed at;
 * here a person is typing, watching, and can add a letter. Every token has to
 * appear, which is what somebody typing "portis dum" expects, and a fuzzy hit
 * that says "du hast die schon" about a different record would be worse than
 * no answer at all.
 */

/** Enough to be useful, short enough to read on a phone at arm's length. */
export const SHELF_LIMIT = 12

/** Below this a query matches half the collection and helps nobody. */
export const MIN_QUERY_LENGTH = 2

export async function searchShelf(query: string, now: number): Promise<ShelfResult> {
  const needles = tokens(norm(query)).filter((token) => token.length > 0)
  if (needles.length === 0 || query.trim().length < MIN_QUERY_LENGTH) {
    return { hits: [], collection: 0, wantlist: 0 }
  }

  const db = await openFidelityDb()
  const [collection, wantlist, chunks] = await Promise.all([
    distinctReleases(),
    db.getAll('wantlist'),
    db.getAll('horizon'),
  ])

  // How many pressings the horizon knows of each wanted album — the number
  // that decides whether the copy in your hand is the one you meant.
  const pressings = new Map<number, number>()
  for (const chunk of chunks) {
    if (chunk.kind === 'master') pressings.set(chunk.entityId, chunk.releaseIds.length)
  }

  const hits: ShelfHit[] = []

  for (const item of wantlist) {
    if (!matches(item, needles)) continue
    hits.push({
      source: 'wantlist',
      releaseId: item.releaseId,
      title: item.title,
      artist: item.artistNames[0] ?? '',
      year: item.year,
      formats: item.formats,
      rating: 0,
      pressings: item.masterId > 0 ? (pressings.get(item.masterId) ?? null) : null,
      waitingDays: waitingDays(item.addedAt, now),
    })
  }

  for (const item of collection) {
    if (!matches(item, needles)) continue
    hits.push({
      source: 'collection',
      releaseId: item.releaseId,
      title: item.title,
      artist: item.artistNames[0] ?? '',
      year: item.year,
      formats: item.formats,
      rating: item.rating,
      pressings: null,
      waitingDays: null,
    })
  }

  return {
    /*
     * Wanted before owned.
     *
     * Both answers matter — one says buy, the other says put it back — but the
     * wantlist is the rarer and the more urgent of the two, and a phone screen
     * shows three rows.
     */
    hits: hits.slice(0, SHELF_LIMIT),
    collection: hits.filter((hit) => hit.source === 'collection').length,
    wantlist: hits.filter((hit) => hit.source === 'wantlist').length,
  }
}

/** Every token has to appear somewhere in artist or title. */
function matches(item: { title: string; artistNorms: string[] }, needles: string[]): boolean {
  const haystack = `${item.artistNorms.join(' ')} ${norm(item.title)}`
  return needles.every((needle) => haystack.includes(needle))
}

function waitingDays(addedAt: string, now: number): number | null {
  const added = Date.parse(addedAt)
  if (!Number.isFinite(added)) return null
  return Math.max(0, Math.floor((now - added) / 86_400_000))
}
