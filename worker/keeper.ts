import { getSyncState } from '~~/db/meta'

import { isForegroundBusy } from './busy'
import type { DiscogsClient } from './discogs/client'

/**
 * The keeper: keeps the collection current while the app is open.
 *
 * Every piece of this already existed and was individually budgeted — the
 * library sync is a delta that usually costs one request, the watchlist checks
 * a shop at most once an hour, the horizon revalidation spends a day's ration
 * of about twenty and refuses to run twice in a day. What was missing was
 * anybody calling them.
 *
 * `library.sync` ran from the settings page and from the setup, and nowhere
 * else: somebody who bought a record, added it on Discogs and opened Fidelity
 * saw a collection that did not have it, for as long as it took them to find
 * Einstellungen → Abgleich. And `horizon.revalidate` was wired to the mounting
 * of the horizon panel — a settings subpage — so the "runs on opening" it was
 * designed around almost never happened.
 *
 * **What the keeper does not touch:**
 *
 * - Re-fetching marketplace data. Prices expire after six hours on purpose
 *   (rule 4), and asking after a basket costs one request per line. That is a
 *   decision — "do I want to buy this?" — not housekeeping. Enforcing the
 *   deadline is a different thing from refreshing it, and the keeper does the
 *   first: see step 0, which spends nothing and only ever removes.
 * - *Building* the horizon. That is minutes of requests. Refreshing yes,
 *   building no — nobody starts a quarter of an hour unasked.
 * - Harvesting credits. One request per favourite record, which for somebody
 *   with three hundred favourites is another quarter of an hour.
 *
 * And above all: it starts nothing while something else is running. The pacer
 * is a single lane (rule 3), and a keeper that puts forty requests into it
 * turns the next dig into an unexplained wait.
 */

/**
 * How old the collection may get before the keeper looks.
 *
 * Half an hour, because the delta is one request when nothing changed and the
 * whole point is that adding a record on Discogs shows up here without anybody
 * going looking for a button. Shorter would spend a request on every tab
 * switch for a collection that changes a few times a month.
 */
const LIBRARY_STALE_MS = 30 * 60 * 1000

export type KeeperJob = 'outbox' | 'library' | 'watch' | 'horizon'

export interface KeeperResult {
  /** What actually ran. Empty when nothing was due. */
  did: KeeperJob[]
  /** True when something else was running and the keeper stood aside. */
  deferred: boolean
  /** Records added to the library, if it ran. */
  stored: number
  /** Watched shops whose stock moved. */
  alerts: number
  /** Matches whose marketplace fields were stripped for being past six hours. */
  expired: number
  /** Queued changes that reached Discogs this round. */
  pushed: number
  /** Queued changes given up on. Their old value is back on the shelf. */
  givenUp: number
}

export async function runKeeper(options: {
  client: DiscogsClient
  username: string | null
  /**
   * "Now, however old it is."
   *
   * The one button that reaches all of this at once. It skips the staleness
   * clocks — not the busy check: a refresh somebody pressed still has no
   * business queueing in front of a dig they started thirty seconds ago.
   */
  force?: boolean
  now?: number
  signal?: AbortSignal
}): Promise<KeeperResult> {
  const { client, username, force = false, signal } = options
  const now = options.now ?? Date.now()
  const result: KeeperResult = {
    did: [],
    deferred: false,
    stored: 0,
    alerts: 0,
    expired: 0,
    pushed: 0,
    givenUp: 0,
  }

  /*
   * 0 — the six-hour deadline (rule 4).
   *
   * Above every other consideration in this function, and deliberately above
   * all three of the early returns below it, because none of them applies to a
   * deadline. It costs no request, so the pacer does not care. It touches only
   * digs already past `expiresAt`, so a running dig — six hours in the future
   * by construction — cannot be caught by it, and there is nothing to defer to.
   * And it must run for somebody signed *out*: whoever removed their token
   * still has yesterday's prices sitting on the device, and "I am not signed
   * in" was never an exemption from the terms we display them under.
   *
   * Until now this was the one rule enforced only at render time. Every screen
   * checks the age before showing a price — dig, in-store, the home summary,
   * the basket line by line, and the optimiser skips what has expired — so
   * nothing stale was ever displayed. But the data stayed on disk indefinitely,
   * while `expireDigs` sat next to it fully tested, described in its own
   * comment as running "at app start and hourly", and called by nothing except
   * its tests. A green test for code that never runs is worse than no test: it
   * reads like a guarantee.
   *
   * Now the comment is true. Hiding a price is the obligation; removing it is
   * the point.
   */
  try {
    const { expireDigs } = await import('~~/db/expire')
    result.expired = await expireDigs(undefined, now)
  } catch {
    // Storage that will not open is its own error elsewhere, and loudly. It is
    // not this function's job to be the second place that says so.
  }

  if (!username) return result
  if (isForegroundBusy()) return { ...result, deferred: true }

  /*
   * 1 — changes waiting to go out, and they go before the sync reads back.
   *
   * The order is the whole point, not a preference. `syncCollection` writes
   * Discogs' answer over the mirrored row; a rating tapped in a shop and not
   * yet sent would be replaced by the old one, and the collector would watch
   * their own change disappear with nothing to blame. Out first, then in.
   *
   * It also runs regardless of the staleness clock below: half an hour is a
   * fine wait for "did anything change over there", and a poor one for
   * "the thing I just did".
   */
  const { drainOutbox } = await import('./outbox')
  const drained = await drainOutbox(client, username)
  if (drained.sent > 0 || drained.givenUp > 0) result.did.push('outbox')
  result.pushed = drained.sent
  result.givenUp = drained.givenUp

  /*
   * 2 — the collection. Cheap, and it says the most: everything else in the
   * app is measured against what is on the shelf.
   */
  const syncState = await getSyncState()
  if (force || (syncState?.collectionSyncedAt ?? 0) < now - LIBRARY_STALE_MS) {
    try {
      const { syncLibrary } = await import('./sync/library')
      const summary = await syncLibrary({ client, username, signal })
      result.did.push('library')
      result.stored = summary.collection.stored + summary.wantlist.stored
    } catch {
      // A sync that fails changes nothing; the next tick tries again. It is not
      // worth an error on a screen nobody asked to refresh.
    }
  }

  /*
   * 2 — the watched shops. One request per shop, hourly at most, and
   * `watch.check` decides that for itself.
   */
  if (!isForegroundBusy()) {
    try {
      // No pre-filter here: `checkWatched` already skips shops that are not
      // watched and shops checked within the hour, and duplicating that would
      // give it two places to drift apart.
      const { checkWatched } = await import('./watch/check')
      const outcome = await checkWatched({ client, force, signal })
      if (outcome.checked > 0) {
        result.did.push('watch')
        result.alerts = outcome.alerts.length
      }
    } catch {
      // A shop that will not answer is not worth an error message.
    }
  }

  /*
   * 3 — the horizon, in daily rations. Last, because it costs the most of the
   * three and is the least urgent: an entry a day older is still correct.
   */
  if (!isForegroundBusy()) {
    try {
      const { revalidateHorizon } = await import('./horizon/build')
      const outcome = await revalidateHorizon({ client, signal })
      if (outcome.expanded > 0) result.did.push('horizon')
    } catch {
      // A stale horizon is still a horizon.
    }
  }

  return result
}
