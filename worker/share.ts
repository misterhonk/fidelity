import { seal, open } from './vault/crypto'
import { createHubClient } from './hub/client'
import { getPreferences } from '~~/db/meta'
import type { DigWithMatches } from '#shared/protocol'
import type { SharedDig } from '#shared/types'
import { fail } from './fail'

/**
 * Sending a find list without putting it anywhere somebody can read it.
 *
 * The hub carries a sealed envelope under a random id. The key sits in the `#`
 * fragment of the link — and **no** browser sends a fragment to a server.
 * Whoever has the link can read; whoever has the hub's database has a string.
 *
 * **Why the hub at all.** A find list of a hundred matches does not fit in an
 * address, and there is nothing else both sides can reach. Under rule 8 no
 * feature hangs off the hub — this one is the exception that proves it:
 * without a hub the button is not there, and everything else carries on.
 */

/** The snapshot's version, so that an old link is not silently misread by a
 *  newer client. */
const SHARE_VERSION = 1

/**
 * How many matches travel along.
 *
 * The list is sorted by score; anyone reading past a hundred is not reading
 * any more, they are scrolling. The total travels with it so that the snapshot
 * does not claim that was all of them.
 */
const MAX_SHARED_MATCHES = 100

/** 128 bits as hex — id and key have the same shape and both come from
 *  `crypto.getRandomValues`, not from `Math.random`. */
function randomHex(bytes: number): string {
  return [...crypto.getRandomValues(new Uint8Array(bytes))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export interface ShareCreated {
  id: string
  /** Belongs in the `#` fragment and nowhere else. */
  key: string
  /** When it expires — the dig's clock, not the sharing's. */
  expiresAt: number
  matches: number
}

/**
 * Takes what the screen has loaded anyway.
 *
 * Deliberately not `digId`: `loadDig()` applies `bestPerRelease()` and folds
 * duplicate copies away. Fetching the same list from the database again here
 * would mean making that selection a second time — and the second version
 * would be the one nobody maintains. What is shared is what is on the screen.
 */
export async function createShare(loaded: DigWithMatches): Promise<ShareCreated> {
  const preferences = await getPreferences()
  const hub = createHubClient({
    baseUrl: preferences.hubUrl,
    secret: preferences.hubSecret,
    accessKey: preferences.accessKey,
  })
  if (!hub) throw fail('no-hub', 'no hub configured')

  const dig = loaded.dig

  /*
   * What has expired is not shared.
   *
   * Six hours after the scan, prices and conditions may not be shown any more
   * (rule 4). Sharing an expired dig would mean showing somebody else exactly
   * that — and getting round the lock on one's own screen by opening a second
   * one.
   */
  if (Date.now() >= dig.expiresAt) throw fail('dig-expired', 'dig expired')

  const snapshot: SharedDig = {
    version: SHARE_VERSION,
    dealer: dig.dealer,
    scannedAt: dig.startedAt,
    expiresAt: dig.expiresAt,
    coverage: dig.coverage,
    listingsTotal: dig.listingsTotal,
    matchesTotal: loaded.matches.length,
    matches: loaded.matches.slice(0, MAX_SHARED_MATCHES),
  }

  const id = randomHex(16)
  const key = randomHex(16)
  const sealed = await seal(snapshot, key)

  await hub.shareWrite(id, sealed, dig.expiresAt)
  return { id, key, expiresAt: dig.expiresAt, matches: snapshot.matches.length }
}

/**
 * And the other side: opening a link.
 *
 * Runs **with no token and no sign-in**. Whoever receives the link may never
 * have opened Fidelity, and sending them to the setup first would be the worst
 * possible way to introduce an app.
 */
export async function readShare(
  hubUrl: string,
  id: string,
  key: string,
): Promise<SharedDig | null> {
  /*
   * Built without a secret, on purpose.
   *
   * The recipient has none. Even if they happened to have one stored for some
   * *other* hub, it would have no business here — a secret does not go to a
   * server just because a link points at it.
   */
  const hub = createHubClient({ baseUrl: hubUrl, secret: null })
  if (!hub) return null

  const found = await hub.shareRead(id)
  if (!found) return null

  const snapshot = await open<SharedDig>(found.sealed, key)

  /*
   * The expiry is checked again here, and this time it is not dead code: the
   * server has its own clock, the device has another, and what may be shown is
   * decided by the one somebody is sitting in front of.
   */
  if (Date.now() >= snapshot.expiresAt) return null
  if (snapshot.version > SHARE_VERSION) return null

  return snapshot
}
