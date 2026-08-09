import { getMeta } from '~~/db/meta'
import { openFidelityDb } from '~~/db/open'
import type { Match } from '#shared/types'

/**
 * Taking your data with you (docs/06 M8).
 *
 * Two rules hold this file up, and both are about what must *not* be in a file
 * that can be attached to an email.
 *
 * **The token never leaves.** CLAUDE.md rule 6 says it does not leave
 * IndexedDB, and a JSON file on a desktop is very much outside IndexedDB.
 *
 * **Marketplace data never leaves.** Prices, conditions, dealer stock — docs/09
 * §1.3 calls those Restricted Data and forbids passing them to third parties,
 * and an export file is the most third-party-shaped thing in the app. What is
 * exported instead is what Discogs' own terms leave alone: the scores, signals
 * and sentences this app derived on this device (docs/09 §1.1).
 *
 * The consequence is worth stating plainly rather than hiding: a shared dig
 * says *which records* scored well and *why*, not what they cost. That is the
 * interesting half anyway — the price is on Discogs, one click away, and
 * current rather than six hours stale.
 */

export const EXPORT_VERSION = 1

/** What survives into a file: our own reasoning, never the marketplace. */
interface ExportedMatch {
  listingId: number
  releaseId: number
  score: number
  signals: Match['signals']
  reason: string
  discogsUrl: string
}

export interface DigExport {
  kind: 'fidelity-dig'
  version: number
  exportedAt: number
  dealer: string
  scannedAt: number
  listingsScanned: number
  listingsTotal: number
  coverage: number
  matches: ExportedMatch[]
  note: string
}

const NOTE =
  'Enthält bewusst keine Preise, Zustände oder anderen Marktplatzdaten – die dürfen ' +
  'laut Discogs-API-Bedingungen nicht weitergegeben werden. Die Links führen zum ' +
  'jeweiligen Angebot, wo der aktuelle Preis steht.'

function strip(match: Match): ExportedMatch {
  return {
    listingId: match.listingId,
    releaseId: match.releaseId,
    score: match.score,
    signals: match.signals,
    reason: match.reason,
    // The deep link is the point: it carries the price without us copying it.
    discogsUrl: `https://www.discogs.com/sell/item/${match.listingId}`,
  }
}

export async function exportDig(digId: string, now: number): Promise<DigExport | null> {
  const db = await openFidelityDb()
  const dig = await db.get('digs', digId)
  if (!dig) return null

  const matches = await db
    .transaction('matches')
    .store.index('by-dig-score')
    .getAll(IDBKeyRange.bound([digId, -Infinity], [digId, Infinity]))

  return {
    kind: 'fidelity-dig',
    version: EXPORT_VERSION,
    exportedAt: now,
    dealer: dig.dealer,
    scannedAt: dig.startedAt,
    listingsScanned: dig.listingsScanned,
    listingsTotal: dig.listingsTotal,
    coverage: dig.coverage,
    matches: matches.sort((a, b) => b.score - a.score).map(strip),
    note: NOTE,
  }
}

export interface FullExport {
  kind: 'fidelity-backup'
  version: number
  exportedAt: number
  identity: { username: string } | null
  collection: unknown[]
  wantlist: unknown[]
  preferences: unknown
  tasteProfile: unknown
  credits: unknown
  dealers: unknown[]
  digs: unknown[]
  matches: ExportedMatch[]
  feedback: unknown[]
  basket: unknown[]
  note: string
}

/**
 * Everything, for taking to another browser.
 *
 * The horizon is deliberately *not* in here. It is a few hundred thousand
 * release ids in TypedArrays that JSON would inflate roughly tenfold, and it
 * is entirely reproducible from the API — a backup should hold what cannot be
 * fetched again, not what merely takes a while.
 */
export async function exportEverything(now: number): Promise<FullExport> {
  const db = await openFidelityDb()

  const [collection, wantlist, dealers, digs, feedback, basket, matches] = await Promise.all([
    db.getAll('collection'),
    db.getAll('wantlist'),
    db.getAll('dealers'),
    db.getAll('digs'),
    db.getAll('feedback'),
    db.getAll('basket'),
    db.getAll('matches'),
  ])

  const identity = await getMeta('identity')

  return {
    kind: 'fidelity-backup',
    version: EXPORT_VERSION,
    exportedAt: now,
    // The username, not the token. A token in a file is a credential in a file.
    identity: identity ? { username: identity.username } : null,
    collection,
    wantlist,
    preferences: await getMeta('preferences'),
    tasteProfile: await getMeta('tasteProfile'),
    credits: await getMeta('credits'),
    dealers,
    digs,
    matches: matches.map(strip),
    feedback,
    basket,
    note:
      'Ohne Token und ohne Marktplatzdaten. Der Horizont fehlt bewusst – er ist ' +
      'jederzeit neu aufbaubar und würde als JSON ein Vielfaches wiegen.',
  }
}
