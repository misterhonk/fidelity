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
 * **Was der Kurator nicht anfasst:**
 *
 * - Marktplatzdaten. Preise verfallen nach sechs Stunden, und zwar absichtlich
 *   (rule 4). Einen Korb nachzufragen kostet eine Anfrage pro Zeile und ist
 *   eine Entscheidung — „will ich das kaufen?" — keine Hausarbeit.
 * - Den Horizont *aufbauen*. Das sind Minuten. Auffrischen ja, bauen nein: was
 *   minutes, nobody starts unasked.
 * - Harvesting credits. One request per favourite record, and for somebody with
 *   dreihundert Favoriten ist das eine Viertelstunde.
 *
 * And above all: it starts nothing while something else is running. The pacer
 * ist eine Spur (rule 3), und ein Kurator, der vierzig Anfragen davor legt,
 * turns the next dig into an unexplained wait.
 */

/**
 * Wie alt die Sammlung sein darf, bevor nachgesehen wird.
 *
 * Half an hour, because the delta is one request when nothing changed and the
 * whole point is that adding a record on Discogs shows up here without anybody
 * going looking for a button. Shorter would spend a request on every tab
 * switch for a collection that changes a few times a month.
 */
const LIBRARY_STALE_MS = 30 * 60 * 1000

export type KeeperJob = 'library' | 'watch' | 'horizon'

export interface KeeperResult {
  /** What actually ran. Empty when nothing was due. */
  did: KeeperJob[]
  /** True when something else was running and the keeper stood aside. */
  deferred: boolean
  /** Records added to the library, if it ran. */
  stored: number
  /** Watched shops whose stock moved. */
  alerts: number
}

export async function runKeeper(options: {
  client: DiscogsClient
  username: string | null
  /**
   * „Jetzt, egal wie alt es ist."
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
  const result: KeeperResult = { did: [], deferred: false, stored: 0, alerts: 0 }

  if (!username) return result
  if (isForegroundBusy()) return { ...result, deferred: true }

  /*
   * 1 — die Sammlung. Zuerst, weil sie am billigsten ist und am meisten sagt:
   * alles andere in der App wird daran gemessen, was im Regal steht.
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
   * das entscheidet `watch.check` selbst.
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
   * 3 — der Horizont, in Tagesrationen. Zuletzt, weil er von den dreien am
   * meisten kostet und am wenigsten dringend ist: ein Eintrag, der einen Tag
   * older is still correct.
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
