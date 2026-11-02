import { openFidelityDb } from '~~/db/open'
import type { Match, WatchDigest } from '#shared/types'

import type { DiscogsClient } from '../discogs/client'
import { hasAnchor, runningRound } from '../dealers/round'
import type { runDig as RunDig } from '../dig/scan'
import { log } from '../log'

/** The start page shows a taste per shop, not the list; the shop page has the rest. */
export const DIGEST_FINDS = 3

export interface DigestOptions {
  client: DiscogsClient
  /** The shops whose total moved, from `watch.check`. */
  dealers: string[]
  signal?: AbortSignal
  now?: () => number
  /** Injected, so the pass can be tested without driving the scanner itself. */
  runDig?: typeof RunDig
}

/**
 * Since your last visit (#240): each watched shop that moved gets one
 * "only what is new" dig, and the start page shows what that dig found.
 *
 * The round's walk, for the shops the cheap check already flagged, so a shop
 * that did not move costs nothing. Sequential, through the one client (rule 3).
 * A shop never dug has no line to stop at and is left to the banner's
 * "moved" sentence rather than dug in full.
 */
export async function digestMoved({
  client,
  dealers,
  signal,
  now = Date.now,
  runDig,
}: DigestOptions): Promise<WatchDigest[]> {
  // A round walking the same shops would make this pass a second visit.
  if (dealers.length === 0 || runningRound()) return []

  const dig = runDig ?? (await import('../dig/scan')).runDig
  const db = await openFidelityDb()
  const digests: WatchDigest[] = []

  for (const username of dealers) {
    signal?.throwIfAborted()
    const dealer = await db.get('dealers', username)
    if (!dealer || dealer.watching !== true || dealer.hiddenAt || !hasAnchor(dealer)) continue

    try {
      const done = await dig({
        client,
        dealer: username,
        depth: 'neu',
        digId: `${now().toString(36).padStart(9, '0')}-${crypto.randomUUID().slice(0, 8)}`,
        signal,
        now,
      })
      const digId = done.discarded ? null : done.id
      digests.push({
        dealer: username,
        digId,
        expiresAt: done.expiresAt,
        finds: digId && done.matchCount > 0 ? await best(digId) : [],
      })
    } catch (error) {
      if (signal?.aborted) throw error
      // One shop that will not answer, or a dig already running, is not the pass failing.
      log.warn('[digest] could not visit', username, error)
    }
  }

  return digests
}

async function best(digId: string): Promise<Match[]> {
  const db = await openFidelityDb()
  const range = IDBKeyRange.bound([digId, -Infinity], [digId, Infinity])
  const finds: Match[] = []
  let cursor = await db
    .transaction('matches')
    .store.index('by-dig-score')
    .openCursor(range, 'prev')
  while (cursor && finds.length < DIGEST_FINDS) {
    finds.push(cursor.value)
    cursor = await cursor.continue()
  }
  return finds
}
