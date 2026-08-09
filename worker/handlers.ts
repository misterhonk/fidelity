import { getMeta, getSyncState, setMeta } from '~~/db/meta'
import { openFidelityDb } from '~~/db/open'
import type { DbStats, ParamsOf, RequestKind, ResultOf } from '#shared/protocol'

import { currentIdentity, discogs, requestPersistence, signIn, signOut } from './auth'
import { findResumable, REACHABLE, resumeDig, runDig } from './dig/scan'
import { enrichTopMatches } from './dig/enrich'
import { affinityFactor } from './dig/fingerprint'
import { allFeedback, clearFeedback, feedbackVerdicts, recordFeedback } from './feedback'
import { buildHorizon, horizonStatus } from './horizon/build'
import { dealerSchema } from './discogs/inventory'
import { bestPerRelease, topFive } from './match/select'
import { computeTasteProfile } from './match/taste'
import { syncLibrary } from './sync/library'

/**
 * A handler gets its params and a way to report progress, and returns the
 * result. Cancellation arrives as an AbortSignal — the scan in M2 checks it
 * between pages, which is the only place a four-minute run can be interrupted
 * without leaving the cursor inconsistent.
 */
export type Handler<K extends RequestKind> = (
  params: ParamsOf<K>,
  ctx: { report: (progress: unknown) => void; signal: AbortSignal },
) => Promise<ResultOf<K>>

export type HandlerMap = { [K in RequestKind]: Handler<K> }

const STORES = [
  'meta',
  'collection',
  'wantlist',
  'horizon',
  'dealers',
  'digs',
  'matches',
  'basket',
  'feedback',
] as const

async function dbStats(): Promise<DbStats> {
  const db = await openFidelityDb()

  const counts: Record<string, number> = {}
  for (const store of STORES) {
    counts[store] = await db.count(store)
  }

  // Not available in every browser, and Safari lies about the quota. Report
  // what we get and null out the rest rather than inventing a number.
  let usageBytes: number | null = null
  let quotaBytes: number | null = null
  let persisted = false
  if (typeof navigator !== 'undefined' && navigator.storage) {
    const estimate = await navigator.storage.estimate?.()
    usageBytes = estimate?.usage ?? null
    quotaBytes = estimate?.quota ?? null
    persisted = (await navigator.storage.persisted?.()) ?? false
  }

  return { counts, usageBytes, quotaBytes, persisted }
}

export const handlers: HandlerMap = {
  ping: async ({ echo }) => ({ pong: true, echo }),
  'db.stats': dbStats,

  'auth.signIn': ({ token }) => signIn(token),
  'auth.identity': () => currentIdentity(),
  'auth.signOut': async () => {
    await signOut()
    return { signedOut: true as const }
  },

  'library.sync': async (_params, { report, signal }) => {
    const identity = await currentIdentity()
    if (!identity) throw new Error('Nicht angemeldet.')

    await requestPersistence()
    const result = await syncLibrary({
      client: discogs(),
      username: identity.username,
      report: (progress) => report(progress),
      signal,
    })

    // Recomputed here rather than during a dig: a dig has a two-minute budget
    // and this is not part of it.
    const db = await openFidelityDb()
    await setMeta(
      'tasteProfile',
      computeTasteProfile(await db.getAll('collection'), Date.now()),
    )

    return result
  },

  'taste.profile': async () => (await getMeta('tasteProfile')) ?? null,

  'dig.preflight': async ({ dealer }, { signal }) => {
    const profile = await discogs().get(`/users/${encodeURIComponent(dealer)}`, dealerSchema, {
      signal,
    })
    const numForSale = profile.num_for_sale ?? 0
    return {
      dealer: profile.username,
      displayName: profile.username,
      numForSale,
      reachable: Math.min(numForSale, REACHABLE),
      truncated: numForSale > REACHABLE,
      sellerRating: profile.seller_rating ?? null,
      location: profile.location ?? null,
    }
  },

  'dig.run': async ({ dealer }, { report, signal }) =>
    runDig({
      client: discogs(),
      dealer,
      // ULID-shaped enough for our purposes: time-sortable, collision-free
      // within one browser.
      digId: `${Date.now().toString(36).padStart(9, '0')}-${crypto.randomUUID().slice(0, 8)}`,
      report: (progress) => report(progress),
      signal,
    }),

  'dig.resumable': () => findResumable(),

  'dig.resume': ({ digId }, { report, signal }) =>
    resumeDig({ client: discogs(), digId, report: (progress) => report(progress), signal }),

  'horizon.status': () => horizonStatus(),

  'horizon.build': (_params, { report, signal }) =>
    buildHorizon({ client: discogs(), report: (progress) => report(progress), signal }),

  'dig.enrich': async ({ digId }, { report, signal }) =>
    enrichTopMatches({
      client: discogs(),
      digId,
      taste: (await getMeta('tasteProfile')) ?? null,
      report: (progress) => report(progress),
      signal,
    }),

  'feedback.set': async ({ match, verdict }) => {
    await recordFeedback(match, verdict, Date.now())
    return feedbackVerdicts()
  },

  'feedback.clear': async ({ listingId }) => {
    await clearFeedback(listingId)
    return feedbackVerdicts()
  },

  'feedback.verdicts': () => feedbackVerdicts(),

  'feedback.export': () => allFeedback(),

  'dealer.profile': async ({ dealer: username }) => {
    const db = await openFidelityDb()
    const dealer = await db.get('dealers', username)
    if (!dealer) return null

    const all = await db.getAll('dealers')
    const others = all.filter((other) => other.username !== username)

    const rate = dealer.affinity ?? 0
    const median = dealer.fingerprint?.medianPrice ?? 0
    const otherMedians = others
      .map((other) => other.fingerprint?.medianPrice ?? 0)
      .filter((value) => value > 0)

    return {
      dealer,
      rate,
      // Computed on read, both of them, because they move the moment another
      // shop is scanned. Storing them would mean every shop's numbers going
      // stale the next time you dig somewhere else.
      factor: affinityFactor(
        rate,
        others.filter((other) => other.affinity !== null).map((other) => other.affinity!),
      ),
      priceFactor: median > 0 ? affinityFactor(median, otherMedians) : null,
      scannedDealers: all.length,
    }
  },

  'dealer.list': async () => {
    const db = await openFidelityDb()
    const dealers = await db.getAll('dealers')

    // Ranked by how much of their stock is for you, which is the only ordering
    // that answers "where should I look first".
    return dealers
      .filter((dealer) => dealer.lastScannedAt !== null)
      .sort((a, b) => (b.affinity ?? 0) - (a.affinity ?? 0))
  },

  'dig.get': async ({ digId }) => loadDig(digId),

  'dig.list': async () => {
    const db = await openFidelityDb()
    // The id is a sortable timestamp prefix, so this needs no index.
    return (await db.getAll('digs')).sort((a, b) => b.id.localeCompare(a.id))
  },

  'dig.latest': async () => {
    const db = await openFidelityDb()
    const digs = await db.getAll('digs')
    const newest = digs.sort((a, b) => b.id.localeCompare(a.id))[0]
    return newest ? loadDig(newest.id) : null
  },

  'library.summary': async () => {
    const db = await openFidelityDb()
    const syncState = await getSyncState()
    return {
      collection: await db.count('collection'),
      wantlist: await db.count('wantlist'),
      dealers: await db.count('dealers'),
      collectionSyncedAt: syncState.collectionSyncedAt,
      wantlistSyncedAt: syncState.wantlistSyncedAt,
    }
  },
}

/** A dig plus its matches, strongest first. */
async function loadDig(digId: string) {
  const db = await openFidelityDb()
  const dig = await db.get('digs', digId)
  if (!dig) return null

  const stored = await db
    .transaction('matches')
    .store.index('by-dig-score')
    .getAll(IDBKeyRange.bound([digId, -Infinity], [digId, Infinity]))

  // Selection happens here rather than in the template: what gets shown first
  // is a product decision, and the main thread only renders.
  const { matches, folded } = bestPerRelease(stored)
  return { dig, matches, topFive: topFive(matches), folded }
}
