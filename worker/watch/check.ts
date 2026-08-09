import { openFidelityDb } from '~~/db/open'
import type { Dealer, WatchAlert } from '#shared/types'

import type { DiscogsClient } from '../discogs/client'
import { dealerSchema } from '../discogs/inventory'

/**
 * Watching a dealer without a server.
 *
 * There is no nightly job, because there is no night — a browser does not run
 * while it is closed. So the check happens when the app is opened, which is
 * also the only moment somebody is around to care about the answer.
 *
 * What makes it affordable is the cheap change detector from docs/06 M6:
 * `GET /users/{dealer}` returns `num_for_sale` in **one** request. A full
 * rescan is a hundred. So the check asks the cheap question, and only a shop
 * whose number actually moved is worth the expensive one.
 *
 * ⚠️ The delta is not a count of new listings, and the interface never claims
 * it is. A dealer who sells five records and lists five more moves by zero.
 * What it does say truthfully: this shop changed, go and look.
 */

/**
 * Not checked more often than this, however often the app is opened.
 *
 * Six hours rather than a day: a dig's own data expires on that clock anyway,
 * so anything more frequent would be re-checking shops whose results are still
 * fresh, and anything less would make "seit deinem letzten Besuch" mean less
 * than a visit.
 */
export const MIN_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

export interface CheckOptions {
  client: DiscogsClient
  now?: number
  signal?: AbortSignal
  /** Ignore the interval. What the "jetzt prüfen" button uses. */
  force?: boolean
}

export interface CheckResult {
  alerts: WatchAlert[]
  checked: number
  requests: number
  /** Shops watched but skipped because they were checked recently. */
  skipped: number
}

export async function checkWatched({
  client,
  now = Date.now(),
  signal,
  force = false,
}: CheckOptions): Promise<CheckResult> {
  const db = await openFidelityDb()
  const watched = (await db.getAll('dealers')).filter((dealer) => dealer.watching === true)

  const alerts: WatchAlert[] = []
  let checked = 0
  let requests = 0
  let skipped = 0

  for (const dealer of watched) {
    signal?.throwIfAborted()

    const due = force || now - (dealer.watchCheckedAt ?? 0) >= MIN_CHECK_INTERVAL_MS
    if (!due) {
      skipped += 1
      continue
    }

    let numForSale: number
    try {
      const profile = await client.get(
        `/users/${encodeURIComponent(dealer.username)}`,
        dealerSchema,
        { signal },
      )
      numForSale = profile.num_for_sale ?? 0
    } catch (error) {
      if (signal?.aborted) throw error
      // One shop that will not answer is not the check failing. Its watermark
      // is left alone so the next start tries again.
      continue
    }

    requests += 1
    checked += 1

    const before = dealer.watchNumForSale
    const updated: Dealer = {
      ...dealer,
      watchNumForSale: numForSale,
      watchCheckedAt: now,
    }
    await db.put('dealers', updated)

    // The first check has nothing to compare against and says so by staying
    // quiet — an alert on the first sighting would be every shop, every time.
    if (before === null || before === undefined) continue
    if (numForSale <= before) continue

    alerts.push({ dealer: dealer.username, newListings: numForSale - before, seenAt: now })
  }

  return {
    alerts: alerts.sort((a, b) => b.newListings - a.newListings),
    checked,
    requests,
    skipped,
  }
}

/** Adds or removes a dealer from the watchlist. */
export async function setWatching(username: string, watching: boolean): Promise<Dealer | null> {
  const db = await openFidelityDb()
  const dealer = await db.get('dealers', username)
  if (!dealer) return null

  const updated: Dealer = {
    ...dealer,
    watching,
    // Starting to watch takes the current count as the baseline, so the first
    // check compares against the shop as it was when you asked.
    //
    // Unless there is no count: a dealer row created by hand — entering a
    // shipping table for a shop never scanned — has numForSale 0, and using
    // that would make the first check report the shop's entire stock as new.
    // null instead, which routes it through "the first check stays quiet".
    watchNumForSale: watching ? (dealer.watchNumForSale ?? baselineOf(dealer)) : null,
    watchCheckedAt: watching ? (dealer.watchCheckedAt ?? null) : null,
  }
  await db.put('dealers', updated)
  return updated
}

function baselineOf(dealer: Dealer): number | null {
  return dealer.numForSale > 0 ? dealer.numForSale : null
}

export async function watchedDealers(): Promise<Dealer[]> {
  const db = await openFidelityDb()
  return (await db.getAll('dealers'))
    .filter((dealer) => dealer.watching === true)
    .sort((a, b) => (b.affinity ?? 0) - (a.affinity ?? 0))
}
