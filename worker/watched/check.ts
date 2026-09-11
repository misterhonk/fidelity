import { openFidelityDb } from '~~/db/open'
import { marketStatsSchema } from '../dig/enrich'
import { addPoint, judge, type WatchNews } from './judge'
import { MAX_CONFIRM, seenOffers } from './offers'
import { FOR_SALE, listingSchema } from '../dig/refresh'
import type { DiscogsClient } from '../discogs/client'
import type { WatchedRelease } from '#shared/types'

/**
 * Looking up the watched records (M11).
 *
 * One request per record through `/marketplace/stats/{id}` — **possible
 * without a token**, but through the same pacer as everything else (rule 3).
 * With a token, fifty records are a minute.
 *
 * **Why not the whole collection:** five hundred records would be ten minutes,
 * every day, and therefore exactly the shape rule 2 forbids. The ceiling is
 * not a blemish but the design — you watch what you would sell, and what you
 * are really after.
 */

/**
 * How many records may be watched at all.
 *
 * At 1.2 s a request that is two minutes per pass. Past that, "looking
 * something up" becomes an operation you plan — and a watcher you plan no
 * longer runs in the background.
 */
export const MAX_WATCHED = 100

/** More often than once a day, nothing changes in a record's market. */
const MIN_GAP_MS = 20 * 60 * 60 * 1000

export interface WatchedCheck {
  checked: number
  requests: number
  news: { releaseId: number; artist: string; title: string; news: WatchNews }[]
}

export interface CheckProgress {
  done: number
  total: number
}

export async function checkWatched(
  client: DiscogsClient,
  options: {
    now?: () => number
    force?: boolean
    signal?: AbortSignal
    report?: (progress: CheckProgress) => void
  } = {},
): Promise<WatchedCheck> {
  const { now = Date.now, force = false, signal, report } = options
  const db = await openFidelityDb()
  const all = await db.getAll('watched')

  const at = now()
  const due = force
    ? all
    : all.filter((row) => row.checkedAt === null || at - row.checkedAt >= MIN_GAP_MS)

  const result: WatchedCheck = { checked: 0, requests: 0, news: [] }

  for (const [index, row] of due.entries()) {
    signal?.throwIfAborted()
    report?.({ done: index, total: due.length })

    let stats
    try {
      stats = await client.get(`/marketplace/stats/${row.releaseId}`, marketStatsSchema, {
        signal,
      })
      result.requests += 1
    } catch (cause) {
      if (signal?.aborted) throw cause
      /*
       * A record that is unreachable right now is no reason to abort the pass:
       * the other ninety-nine do not depend on it, and the next pass catches
       * it up.
       */
      continue
    }

    const point = {
      at,
      // `blocked_from_sale` means "Discogs does not trade it" — that is not a
      // price of zero but no price at all.
      lowestPrice: stats.blocked_from_sale ? null : (stats.lowest_price?.value ?? null),
      currency: stats.lowest_price?.currency ?? null,
      numForSale: stats.num_for_sale ?? 0,
    }

    const updated: WatchedRelease = {
      ...row,
      points: addPoint(row.points, point),
      checkedAt: at,
    }

    let news = judge(updated, at)

    /*
     * "One offer fewer" is the honest statement about the number — but not the
     * best one available.
     *
     * Where a dig on this device has seen particular offers of this record, it
     * is possible to check whether *those* still stand. That costs a request
     * per offer, hence only here: the question is asked only when the number
     * has actually fallen, and that is rare. If no answer comes, it stays at
     * `fewer` — less well informed, but not wrong.
     */
    if (news?.kind === 'fewer') {
      const gone = await confirmGone(client, row, {
        signal,
        report: () => (result.requests += 1),
      })
      if (gone) {
        updated.goneOffers = [...(row.goneOffers ?? []), gone.listingId]
        news = {
          kind: 'gone',
          dealer: gone.dealer,
          listingId: gone.listingId,
          from: news.from,
          to: news.to,
        }
      }
    }

    if (news) {
      result.news.push({
        releaseId: row.releaseId,
        artist: row.artist,
        title: row.title,
        news,
      })
      updated.notifiedAt = at
    }

    await db.put('watched', updated)
    result.checked += 1
  }

  report?.({ done: due.length, total: due.length })
  return result
}

/**
 * Checking whether one of the offers we saw ourselves has gone.
 *
 * `MAX_CONFIRM` of them at most, newest first, and ones already known to be
 * gone are skipped — otherwise the same copy costs a request on every pass and
 * reports itself again.
 *
 * Returns the first that is no longer `For Sale`. An error is not a result:
 * then it stays at the number, and the next pass looks again.
 */
async function confirmGone(
  client: DiscogsClient,
  row: WatchedRelease,
  options: { signal?: AbortSignal; report: () => void },
): Promise<{ listingId: number; dealer: string } | null> {
  const bekannt = new Set(row.goneOffers ?? [])
  const offers = (await seenOffers(row.releaseId))
    .filter((offer) => !bekannt.has(offer.listingId))
    .slice(0, MAX_CONFIRM)

  for (const offer of offers) {
    options.signal?.throwIfAborted()
    try {
      const listing = await client.get(
        `/marketplace/listings/${offer.listingId}`,
        listingSchema,
        { signal: options.signal },
      )
      options.report()
      if (listing.status !== FOR_SALE)
        return { listingId: offer.listingId, dealer: offer.dealer }
    } catch (cause) {
      if (options.signal?.aborted) throw cause
      /*
       * A 404 here would mean "the listing no longer exists" and would be an
       * answer — but in a browser it arrives without a CORS header and is
       * indistinguishable from a network error (`docs/02`). So claim nothing.
       */
      return null
    }
  }

  return null
}

/** Eine Platte in die Beobachtung nehmen. */
export async function watchRelease(
  entry: Omit<WatchedRelease, 'points' | 'checkedAt' | 'notifiedAt' | 'since'>,
  now = Date.now(),
): Promise<{ watched: boolean; full: boolean }> {
  const db = await openFidelityDb()
  const existing = await db.get('watched', entry.releaseId)

  if (existing) {
    // Already there — then this is a change of threshold and not a second
    // entry. The history stays; it belongs to the record.
    await db.put('watched', { ...existing, ...entry })
    return { watched: true, full: false }
  }

  const count = await db.count('watched')
  if (count >= MAX_WATCHED) return { watched: false, full: true }

  await db.put('watched', {
    ...entry,
    since: now,
    points: [],
    checkedAt: null,
    notifiedAt: null,
  })
  return { watched: true, full: false }
}

export async function unwatchRelease(releaseId: number): Promise<void> {
  await openFidelityDb().then((db) => db.delete('watched', releaseId))
}

export async function listWatched(): Promise<WatchedRelease[]> {
  const db = await openFidelityDb()
  const all = await db.getAll('watched')
  // Zuletzt dazugekommene zuerst — was man gerade beobachtet, interessiert am
  // meisten.
  return all.sort((a, b) => b.since - a.since)
}
