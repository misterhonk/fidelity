import { getMeta, getPreferences, getSyncState, setMeta } from '~~/db/meta'
import { openFidelityDb } from '~~/db/open'
import type { DbStats, ParamsOf, RequestKind, ResultOf } from '#shared/protocol'
import type { BasketCandidate, BasketView } from '#shared/types'

import { currentIdentity, discogs, requestPersistence, signIn, signOut } from './auth'
import { findResumable, REACHABLE, resumeDig, runDig, takeNearMisses } from './dig/scan'
import { enrichTopMatches } from './dig/enrich'
import { forgetLookup } from './dig/detail'
import { affinityFactor } from './dig/fingerprint'
import { allFeedback, clearFeedback, feedbackVerdicts, recordFeedback } from './feedback'
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

    // The detail sheet's cached lookup counts what you own; the sync just
    // changed that.
    forgetLookup()

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

  /*
   * Building, revalidating and gap-filling all load on demand.
   *
   * None of them is needed to run a dig — the scan needs the *lookup*, which
   * is a different module — and a dig is what somebody waits for. Each is a
   * deliberate, visible operation with its own progress bar, so a chunk fetch
   * in front of it costs nothing anybody notices.
   */
  'horizon.status': async () => {
    const { horizonStatus } = await import('./horizon/build')
    return horizonStatus()
  },

  'horizon.build': async (_params, { report, signal }) => {
    const { buildHorizon } = await import('./horizon/build')
    const result = await buildHorizon({
      client: discogs(),
      report: (progress) => report(progress),
      signal,
    })
    // The detail sheet caches the lookup; a rebuild has just invalidated it.
    forgetLookup()
    return result
  },

  'horizon.revalidate': async (_params, { report, signal }) => {
    const { revalidateHorizon } = await import('./horizon/build')
    const { plan, ...result } = await revalidateHorizon({
      client: discogs(),
      report: (progress) => report(progress),
      signal,
    })
    if (result.expanded > 0) forgetLookup()
    return { ...result, stale: plan.stale, reason: plan.reason }
  },

  'credits.harvest': async ({ limit }, { report, signal }) => {
    const { harvestCredits } = await import('./horizon/credits')
    const harvest = await harvestCredits({
      client: discogs(),
      report: (progress) => report(progress),
      signal,
      limit,
    })
    // New people mean new candidates; the status screen has to see that.
    forgetLookup()
    return harvest
  },

  'credits.status': async () => {
    const { creditCandidates, MIN_RATING } = await import('./horizon/credits')
    const db = await openFidelityDb()
    const collection = await db.getAll('collection')
    const harvest = (await getMeta('credits')) ?? null

    return {
      favourites: collection.filter((item) => item.rating >= MIN_RATING).length,
      harvested: harvest?.harvestedReleaseIds.length ?? 0,
      harvestedAt: harvest?.harvestedAt ?? null,
      worthExpanding: creditCandidates(harvest, new Set()).length,
      people: (harvest?.people ?? []).slice(0, 20),
    }
  },

  'horizon.fillGaps': async (_params, { report, signal }) => {
    const misses = takeNearMisses()
    if (misses.length === 0) return { expanded: 0, requests: 0, titles: [] }

    const { buildHorizon } = await import('./horizon/build')
    // One request per master, and only the ones the dig actually pointed at.
    const result = await buildHorizon({
      client: discogs(),
      report: (progress) => report(progress),
      signal,
      only: misses.map((miss) => ({
        kind: 'master' as const,
        id: miss.masterId,
        name: miss.title,
        owned: 1,
      })),
      // These are gaps, not stale entries: expand even if something with the
      // same key was written moments ago.
      ttlMs: 0,
    })

    if (result.expanded > 0) forgetLookup()
    return {
      expanded: result.expanded,
      requests: result.requests,
      titles: misses.slice(0, result.expanded).map((miss) => miss.title),
    }
  },

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

  'watch.set': async ({ dealer, watching }) => {
    const { setWatching, watchedDealers } = await import('./watch/check')
    await setWatching(dealer, watching)
    return watchedDealers()
  },

  'watch.list': async () => {
    const { watchedDealers } = await import('./watch/check')
    return watchedDealers()
  },

  'watch.check': async ({ force }, { signal }) => {
    const { checkWatched } = await import('./watch/check')
    return checkWatched({ client: discogs(), force, signal })
  },

  'dealer.list': async () => {
    const db = await openFidelityDb()
    const dealers = await db.getAll('dealers')

    // Ranked by how much of their stock is for you, which is the only ordering
    // that answers "where should I look first". Dealers that were never
    // scanned come last but are *not* hidden: a shipping table entered by hand
    // creates one, and a shop you can compute postage for should not be
    // invisible on the screen about shops.
    return dealers.sort(
      (a, b) =>
        Number(b.lastScannedAt !== null) - Number(a.lastScannedAt !== null) ||
        (b.affinity ?? 0) - (a.affinity ?? 0) ||
        a.username.localeCompare(b.username),
    )
  },

  'dig.get': async ({ digId }) => loadDig(digId),

  /*
   * The basket and the detail sheet load on demand.
   *
   * Neither is needed to run a dig, and a dig is the thing somebody waits for.
   * Vite splits each dynamic import into its own chunk, so the worker that has
   * to be there before the first scan carries only what the scan needs
   * (docs/12 §2: route-splitting before any library surgery).
   */
  'dig.detail': async ({ digId, listingId }) => {
    const { matchDetail } = await import('./dig/detail')
    return matchDetail(digId, listingId)
  },

  'basket.add': async ({ digId, listingId }) => {
    const { addToBasket } = await import('./basket')
    const db = await openFidelityDb()
    const match = await db.get('matches', [digId, listingId])
    const dig = await db.get('digs', digId)
    if (!match || !dig) throw new Error('Treffer nicht gefunden.')

    await addToBasket(match, dig.dealer, Date.now())
    return basketView()
  },

  'basket.remove': async ({ listingId }) => {
    const { removeFromBasket } = await import('./basket')
    await removeFromBasket(listingId)
    return basketView()
  },

  'basket.clear': async () => {
    const { clearBasket } = await import('./basket')
    await clearBasket()
    return basketView()
  },

  'basket.get': () => basketView(),

  'basket.setShipping': async ({ dealer, tiers }) => {
    const { saveUserShipping } = await import('./basket/profiles')
    await saveUserShipping(dealer, tiers)
    return basketView()
  },

  'basket.plan': async ({ budget }) => {
    const view = await basketView()
    const dealer = view.summary?.dealer
    if (!dealer) return null

    const { planBasket } = await import('./basket/optimise')
    const db = await openFidelityDb()
    const tiers = (await db.get('dealers', dealer))?.shippingTiers ?? []
    // Everything this dealer has that you want, not only what is in the basket
    // — the plan's whole job is to say which set to buy.
    return planBasket(await candidatesFor(dealer), tiers, budget)
  },

  'dig.credits': async ({ digId }) => {
    const { creditGroups } = await import('./dig/credits')
    return creditGroups(digId)
  },

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
      basket: await db.count('basket'),
      collectionSyncedAt: syncState.collectionSyncedAt,
      wantlistSyncedAt: syncState.wantlistSyncedAt,
    }
  },
}

/**
 * Everything the basket screen needs, in one message.
 *
 * Assembled here rather than in three calls because every mutation changes all
 * of it: adding a record moves the total, the postage tier, the advice and
 * which candidates are still worth suggesting.
 */
async function basketView(): Promise<BasketView> {
  const [{ basketListingIds, basketSummary }, { suggestCandidates }] = await Promise.all([
    import('./basket'),
    import('./basket/optimise'),
  ])

  const preferences = await getPreferences()
  const summary = await basketSummary(Date.now(), preferences.shipsToCountry)
  const listingIds = await basketListingIds()

  const candidates = summary
    ? suggestCandidates(
        await candidatesFor(summary.dealer),
        new Set(listingIds),
        preferences.targetPrice,
      )
    : []

  return { summary, listingIds, candidates }
}

/** The scored records this dealer still has, newest dig first. */
async function candidatesFor(dealer: string): Promise<BasketCandidate[]> {
  const { toCandidate } = await import('./basket/optimise')
  const db = await openFidelityDb()
  const dig = (await db.getAll('digs'))
    .filter((entry) => entry.dealer === dealer)
    .sort((a, b) => b.id.localeCompare(a.id))[0]
  if (!dig) return []

  const matches = await db
    .transaction('matches')
    .store.index('by-dig-score')
    .getAll(IDBKeyRange.bound([dig.id, -Infinity], [dig.id, Infinity]))

  return matches.map(toCandidate).filter((item): item is BasketCandidate => item !== null)
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
