import { getMeta, setMeta } from '~~/db/meta'
import { openFidelityDb } from '~~/db/open'
import type { Dealer, RoundProgress, RoundStop, RoundSummary } from '#shared/types'

import type { DiscogsClient } from '../discogs/client'
import type { runDig as RunDig } from '../dig/scan'
import { fail } from '../fail'
import { log } from '../log'

/**
 * Not twice within ten minutes (M36). Martin's screen showed three check-in
 * runs of the same shop in one minute: two tabs, or two taps, and nothing
 * said no. A round is a request per watched shop; the shops do not restock
 * in ten minutes.
 */
export const ROUND_COOLDOWN_MS = 10 * 60 * 1000

/**
 * The round: every watched shop, asked what is new since the last visit.
 *
 * Jens, on 0.70.1: "do I understand this right — the app remembers shops I
 * entered, so I can build a kind of favourite-shop list and scan it weekly for
 * new items?" Almost. The shops were remembered and could be watched, but
 * watching only asks `num_for_sale` — one request that says "something moved
 * here", never what. To find out, you tapped each shop and started a dig by
 * hand, one at a time.
 *
 * This is that walk, done in one go. Not automatically and not weekly: there
 * is no server and a browser does not run while it is closed (ADR-007, and the
 * keeper's own comment says the same). A button is the honest version of
 * "weekly" — it runs when somebody is there to read the answer.
 *
 * **What makes it affordable** is that every stop is an incremental dig. A
 * shop that has been dug once carries the date of its newest listing, so the
 * visit walks newest-first and stops at the first record it has seen before:
 * one page instead of two hundred. Ten shops are ten to twenty requests and
 * about half a minute, against forty minutes for ten full digs.
 *
 * **What it does not do:** enrich. The style and market-price pass is a
 * hundred requests per shop and would turn a half-minute sweep into an hour.
 * A find from the round carries the same signals every dig carries; opening it
 * and refreshing is a decision, the way it is everywhere else.
 */

/** A shop never dug has no line to stop at, so there is nothing to be new since. */
export const NEVER_DUG = 'never-dug' as const

/**
 * What this worker is walking right now, for a screen that was not there when
 * it started.
 *
 * The third of these after `runningDig` and `runningHorizon`, and for the same
 * reason both of those exist: the run lives in the worker and outlives the
 * page. A round is minutes long and a page left in the middle of one has to be
 * able to find its way back to it.
 */
let current: RoundProgress | null = null

export function runningRound(): RoundProgress | null {
  return current
}

/** The shops a round would visit, and what it would cost. Spends nothing. */
export async function planRound(): Promise<{
  shops: number
  reachable: number
  neverDug: number
  requests: number
}> {
  const watched = await watchedDealers()
  const reachable = watched.filter(hasAnchor)

  return {
    shops: watched.length,
    reachable: reachable.length,
    neverDug: watched.length - reachable.length,
    // One page each is the normal case; two is the shop that had a busy week.
    requests: reachable.length * 2,
  }
}

async function watchedDealers(): Promise<Dealer[]> {
  const db = await openFidelityDb()
  return (await db.getAll('dealers'))
    .filter((dealer) => dealer.watching === true && !dealer.hiddenAt)
    .sort((a, b) => a.username.localeCompare(b.username))
}

/**
 * Whether "only what is new" has something to attach to.
 *
 * The same two fields `anchorFor` reads in the scanner, asked here without a
 * request so the plan can say how many shops are reachable before anybody
 * presses anything. A shop dug before `newestListedAt` existed still has
 * `lastScannedAt`, which is what the scanner falls back to.
 */
function hasAnchor(dealer: Dealer): boolean {
  return Boolean(dealer.newestListedAt) || dealer.lastScannedAt !== null
}

export interface RoundOptions {
  client: DiscogsClient
  report?: (progress: RoundProgress) => void
  signal?: AbortSignal
  now?: () => number
  /** Injected, so the round can be tested without driving the scanner itself. */
  runDig?: typeof RunDig
}

export async function runRound({
  client,
  report,
  signal,
  now = Date.now,
  runDig,
}: RoundOptions): Promise<RoundSummary> {
  const dig = runDig ?? (await import('../dig/scan')).runDig

  if (current) throw fail('round-running', 'a round is already walking')
  const previous = await lastRound()
  if (previous && now() - (previous.finishedAt ?? previous.startedAt) < ROUND_COOLDOWN_MS)
    throw fail('round-recent', 'the last round finished minutes ago')

  const watched = await watchedDealers()

  const stops: RoundStop[] = []
  let requests = 0

  const emit = (dealer: string | null) => {
    const progress: RoundProgress = {
      done: stops.length,
      total: watched.length,
      dealer,
      found: stops.reduce((sum, stop) => sum + stop.matches, 0),
    }
    current = progress
    report?.(progress)
  }

  current = { done: 0, total: watched.length, dealer: null, found: 0 }
  emit(null)

  try {
    for (const dealer of watched) {
      signal?.throwIfAborted()
      emit(dealer.username)

      if (!hasAnchor(dealer)) {
        stops.push(blankStop(dealer, NEVER_DUG))
        emit(dealer.username)
        continue
      }

      try {
        const done = await dig({
          client,
          dealer: dealer.username,
          depth: 'neu',
          digId: `${now().toString(36).padStart(9, '0')}-${crypto.randomUUID().slice(0, 8)}`,
          signal,
          now,
        })
        requests += done.apiRequests
        // A check-in that saw nothing left no dig behind (M36).
        stops.push(
          await stopFor(
            dealer,
            done.discarded ? null : done.id,
            done.listingsTotal,
            done.matchCount,
          ),
        )
      } catch (error) {
        // Cancellation is the round ending, not a shop failing.
        if (signal?.aborted) throw error

        /*
         * One shop failing is not the round failing — the same rule the
         * horizon build follows, and for the same reason: a shop that has
         * gone away, a listing page that answered 403, a name that has been
         * renamed since the last dig. The next shop is still worth asking.
         */
        const code = (error as { code?: string } | null)?.code
        log.warn('[round] could not visit', dealer.username, error)
        stops.push(blankStop(dealer, code === 'no-anchor' ? NEVER_DUG : 'failed'))
      }

      emit(dealer.username)
    }
  } finally {
    current = null
  }

  const summary: RoundSummary = {
    startedAt: now(),
    finishedAt: now(),
    requests,
    stops,
  }

  /*
   * Kept, because the digs behind it are not.
   *
   * Five digs are kept (docs/03 §5) and a round over ten shops therefore loses
   * the first five find lists to the pruning before it is even finished. The
   * summary is what survives: which shop had something and what the best of it
   * was, in a single small row. Opening a shop whose dig is gone digs it again
   * — one page, because the anchor moved with the round.
   */
  await setMeta('lastRound', summary)
  return summary
}

export async function lastRound(): Promise<RoundSummary | null> {
  return (await getMeta('lastRound')) ?? null
}

function blankStop(dealer: Dealer, status: RoundStop['status']): RoundStop {
  return {
    dealer: dealer.username,
    displayName: dealer.displayName || dealer.username,
    digId: null,
    newListings: 0,
    matches: 0,
    best: null,
    status,
  }
}

/**
 * One shop's line in the summary, with the best find named.
 *
 * The name rather than a reference, for the reason above: the dig it came from
 * may be pruned by the time anybody reads this, and "3 finds" with nothing
 * attached is a number nobody can act on.
 */
async function stopFor(
  dealer: Dealer,
  digId: string | null,
  newListings: number,
  matches: number,
): Promise<RoundStop> {
  const db = await openFidelityDb()
  const best = matches > 0 && digId ? await bestMatch(db, digId) : null

  return {
    dealer: dealer.username,
    displayName: dealer.displayName || dealer.username,
    digId,
    newListings,
    matches,
    best,
    status: matches > 0 ? 'found' : 'nothing',
  }
}

async function bestMatch(
  db: Awaited<ReturnType<typeof openFidelityDb>>,
  digId: string,
): Promise<RoundStop['best']> {
  // The [digId, score] index, read from the top — the same range the dig view
  // uses, so "best" means here what it means on the find list.
  const range = IDBKeyRange.bound([digId, -Infinity], [digId, Infinity])
  const cursor = await db
    .transaction('matches')
    .store.index('by-dig-score')
    .openCursor(range, 'prev')

  const match = cursor?.value
  if (!match) return null

  /*
   * An inventory row can arrive without an artist — `toListing` already
   * defaults it to an empty string, and a title is not guaranteed either. The
   * summary is read months later with the dig long pruned, so the fallback is
   * here rather than in the sentence that renders it.
   */
  return {
    artist: match.artist ?? '',
    title: match.title ?? '',
    score: match.score,
  }
}
