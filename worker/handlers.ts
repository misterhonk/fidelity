import { getMeta, getPreferences, getSyncState, setMeta, updatePreferences } from '~~/db/meta'
import { openFidelityDb } from '~~/db/open'
import type { DbStats, ParamsOf, RequestKind, ResultOf } from '#shared/protocol'
import type { BasketCandidate, BasketDig, BasketView } from '#shared/types'

import { currentIdentity, discogs, requestPersistence, signOut } from './auth'

import { forgetLookup } from './dig/detail'
import { affinityFactor } from './dig/fingerprint'
import { allFeedback, clearFeedback, feedbackVerdicts, recordFeedback } from './feedback'

import { bestPerRelease, topFive } from './match/select'
import { computeTasteProfile } from './match/taste'

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
  'covers',
] as const

/** The wire shape: a plain object, because a Map does not survive postMessage. */
function toCoverMap(
  entries: Map<number, { thumbUrl: string; coverUrl: string }>,
): Record<number, { thumbUrl: string; coverUrl: string }> {
  const map: Record<number, { thumbUrl: string; coverUrl: string }> = {}
  for (const [releaseId, { thumbUrl, coverUrl }] of entries) {
    map[releaseId] = { thumbUrl, coverUrl }
  }
  return map
}

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

/**
 * One import site per deferred module: each `await import(...)` costs its own
 * preload stub in the entry chunk, and the entry chunk is what the budget is
 * about.
 */
const vault = () => import('./vault/status')
const scan = () => import('./dig/scan')
const auth = () => import('./auth')
const library = () => import('./sync/library')
const inventory = () => import('./discogs/inventory')

export const handlers: HandlerMap = {
  ping: async ({ echo }) => ({ pong: true, echo }),
  'db.stats': dbStats,

  'auth.signIn': async ({ token }) => (await auth()).signIn(token),
  'auth.identity': () => currentIdentity(),
  'auth.signOut': async () => {
    await signOut()
    return { signedOut: true as const }
  },

  'library.sync': async (_params, { report, signal }) => {
    const identity = await currentIdentity()
    if (!identity) throw new Error('Nicht angemeldet.')

    await requestPersistence()
    const { syncLibrary } = await library()
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

  'collection.gaps': async () => {
    const { collectionGaps } = await import('./collection/gaps')
    return collectionGaps()
  },

  'collection.wantlist': async () => {
    const { wantlistOverview } = await import('./collection/wantlist')
    return wantlistOverview(Date.now())
  },

  'dig.preflight': async ({ dealer }, { signal }) => {
    const { dealerSchema } = await inventory()
    const { REACHABLE, SCAN_PASSES, MAX_PAGES, PER_PAGE, anchorFor } = await scan()
    const known = await (await openFidelityDb()).get('dealers', dealer)
    const profile = await discogs().get(`/users/${encodeURIComponent(dealer)}`, dealerSchema, {
      signal,
    })
    const numForSale = profile.num_for_sale ?? 0
    const truncated = numForSale > REACHABLE

    return {
      dealer: profile.username,
      displayName: profile.username,
      numForSale,
      reachable: Math.min(numForSale, REACHABLE),
      truncated,
      /*
       * Only offered where it can help. Below 20.000 the ordinary two passes
       * already return everything, and thirteen more orderings would be
       * 1.100 requests spent to re-read the same shop.
       *
       * The number is a ceiling: the run stops as soon as an ordering turns up
       * nothing new, which on most shops happens long before the last pass.
       */
      deepRequests: truncated ? SCAN_PASSES.length * MAX_PAGES : null,
      deepReachable: truncated
        ? Math.min(numForSale, SCAN_PASSES.length * MAX_PAGES * PER_PAGE)
        : null,
      since: anchorFor(known),
      sellerRating: profile.seller_rating ?? null,
      location: profile.location ?? null,
    }
  },

  'dig.run': async ({ dealer, depth }, { report, signal }) =>
    (await scan()).runDig({
      client: discogs(),
      dealer,
      depth,
      // ULID-shaped enough for our purposes: time-sortable, collision-free
      // within one browser.
      digId: `${Date.now().toString(36).padStart(9, '0')}-${crypto.randomUUID().slice(0, 8)}`,
      report: (progress) => report(progress),
      signal,
    }),

  'basket.paste': async ({ input }, { report, signal }) => {
    const { addPastedListings, parseListingIds } = await import('./basket/listings')
    const preferences = await getPreferences()

    const result = await addPastedListings({
      client: discogs(),
      ids: parseListingIds(input),
      currency: preferences.currency,
      now: Date.now(),
      report: (progress) => report(progress),
      signal,
    })

    return { ...result, view: await basketView() }
  },

  'dig.resumable': async () => (await scan()).findResumable(),

  'dig.resume': async ({ digId }, { report, signal }) =>
    (await scan()).resumeDig({
      client: discogs(),
      digId,
      report: (progress) => report(progress),
      signal,
    }),

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
    const misses = (await scan()).takeNearMisses()
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

  // Runs only after a scan, so it has no business in the startup path either.
  'dig.enrich': async ({ digId }, { report, signal }) => {
    const { enrichTopMatches } = await import('./dig/enrich')
    return enrichTopMatches({
      client: discogs(),
      digId,
      taste: (await getMeta('tasteProfile')) ?? null,
      report: (progress) => report(progress),
      signal,
    })
  },

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

  'dealer.profile': async ({ dealer: username }, { signal }) => {
    const db = await openFidelityDb()
    let dealer = await db.get('dealers', username)
    if (!dealer) return null

    /*
     * Fetch the sign once, for shops from before.
     *
     * A dig picks the avatar up for free on its way past `/users/{name}`, but
     * every shop scanned before that existed has none — and waiting for the
     * next full dig means a wall of initials for people who already did the
     * work. One request, once per shop, the first time its profile is opened.
     *
     * `undefined` means never asked; `''` means asked and there was nothing.
     * Without that distinction a shop with no picture would cost a request
     * every single time somebody clicked it.
     */
    if (dealer.avatarUrl === undefined) {
      try {
        const { dealerSchema } = await inventory()
        const profile = await discogs().get(
          `/users/${encodeURIComponent(username)}`,
          dealerSchema,
          { signal },
        )
        dealer = { ...dealer, avatarUrl: profile.avatar_url ?? '' }
        await db.put('dealers', dealer)
      } catch {
        // A logo is decoration. Offline, rate-limited or gone — the screen
        // draws initials and nothing is written, so the next visit tries again.
      }
    }

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
  'dig.refresh': async ({ digId }, { report, signal }) => {
    const { refreshDig } = await import('./dig/refresh')
    const { currency } = await getPreferences()
    return refreshDig({
      client: discogs(),
      digId,
      currency,
      report: (progress) => report(progress),
      signal,
    })
  },

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

  'basket.fromMarked': async ({ listingIds }, { report, signal }) => {
    const { basketFromMarked } = await import('./dig/refresh')
    const { currency } = await getPreferences()
    const { added, sold } = await basketFromMarked({
      client: discogs(),
      listingIds,
      currency,
      report: (progress) => report(progress),
      signal,
    })
    return { view: await basketView(), added, sold }
  },

  /*
   * The vault. Loaded on demand like everything that is not a dig: crypto,
   * merge and targets are kilobytes nobody scanning a shop needs.
   *
   * One import site rather than three. Each `await import(...)` costs its own
   * preload stub in the entry chunk, and the entry chunk is the thing the
   * budget is about — three stubs for one module is three times the price of
   * the same deferral.
   */
  'vault.status': async () => (await vault()).vaultStatus(),

  'vault.setTarget': async ({ target }) => {
    await updatePreferences({ vaultTarget: target })
    return (await vault()).vaultStatus()
  },

  'vault.sync': async ({ passphrase }) => (await vault()).runVaultSync(passphrase),

  'vault.merge': async ({ passphrase, remote }) =>
    (await vault()).mergeIntoVault(passphrase, remote),

  'dealer.discover': async (_params, { report, signal }) => {
    const { discoverDealers } = await import('./dealers/discover')
    const identity = await currentIdentity()
    if (!identity) throw new Error('Nicht angemeldet.')

    const { importFriends } = await getPreferences()
    return discoverDealers({
      client: discogs(),
      username: identity.username,
      includeFriends: importFriends,
      report: (progress) => report(progress),
      signal,
    })
  },

  'dealer.remember': async ({ candidates }) => {
    const { rememberDealers } = await import('./dealers/discover')
    const added = await rememberDealers(candidates)
    const db = await openFidelityDb()
    return { added, dealers: await db.getAll('dealers') }
  },

  'collection.records': async (params) => {
    const { shelfView } = await import('./collection/records')
    return shelfView(params)
  },

  'collection.remove': async ({ releaseId }) => {
    const { removeRecord } = await import('./collection/remove')
    return removeRecord(releaseId)
  },

  'collection.add': async ({ digId, listingId }) => {
    const db = await openFidelityDb()
    const match = await db.get('matches', [digId, listingId])
    if (!match) return false
    const { addRecord } = await import('./collection/add')
    return addRecord(match)
  },

  'collection.fields': async ({ releaseId }) => {
    const [{ collectionFields }, { fieldValuesFor }] = await Promise.all([
      import('./collection/fields'),
      import('~~/db/fields'),
    ])
    const values = await fieldValuesFor(releaseId)
    /*
     * The definitions need a signed-in client; the values do not.
     * Somebody signed out still sees what they noted — losing sight of their
     * own notes because a token expired would be the app punishing them for
     * something that has nothing to do with the notes.
     */
    try {
      const identity = await currentIdentity()
      if (!identity) return { fields: [], values }
      return { fields: await collectionFields(discogs(), identity.username), values }
    } catch {
      return { fields: [], values }
    }
  },

  'collection.setField': async ({ releaseId, fieldId, value }) => {
    const { setFieldValue } = await import('./collection/fields')
    return setFieldValue(releaseId, fieldId, value)
  },

  'collection.rate': async ({ releaseId, rating }) => {
    const { rateRecord } = await import('./collection/rate')
    return rateRecord(releaseId, rating)
  },

  'collection.record': async ({ releaseId }) => {
    const { shelfRecord } = await import('./collection/records')
    return shelfRecord(releaseId)
  },

  'collection.shelf': async ({ query }) => {
    const { searchShelf } = await import('./collection/shelf')
    return searchShelf(query, Date.now())
  },

  'feedback.marked': async () => {
    const { markedOverview } = await import('./feedback')
    return markedOverview()
  },

  'feedback.verdict': async ({ listingId, verdict }) => {
    const { markedOverview, setVerdict } = await import('./feedback')
    await setVerdict(listingId, verdict)
    return markedOverview()
  },

  'feedback.forget': async ({ listingId }) => {
    const { clearFeedback, markedOverview } = await import('./feedback')
    await clearFeedback(listingId)
    return markedOverview()
  },

  'feedback.check': async (_params, { report, signal }) => {
    const { refreshMarked } = await import('./dig/refresh')
    const { currency } = await getPreferences()
    return refreshMarked({
      client: discogs(),
      currency,
      report: (progress) => report(progress),
      signal,
    })
  },

  'basket.refresh': async (_params, { report, signal }) => {
    const { refreshBasket } = await import('./dig/refresh')
    const { currency } = await getPreferences()
    await refreshBasket({
      client: discogs(),
      currency,
      report: (progress) => report(progress),
      signal,
    })
    return basketView()
  },

  'basket.setShipping': async ({ dealer, tiers }) => {
    const { saveUserShipping } = await import('./basket/profiles')
    await saveUserShipping(dealer, tiers)
    return basketView()
  },

  'basket.plan': async ({ dealer, budget }) => {
    const view = await basketView()
    if (!view.baskets.some((basket) => basket.dealer === dealer)) return null

    const { planBasket } = await import('./basket/optimise')
    const { resolveShipping } = await import('./basket/profiles')
    const db = await openFidelityDb()
    const row = await db.get('dealers', dealer)

    /*
     * The same postage the card above it shows, which means the same ladder of
     * sources — hand-entered, hub, repository, parsed. Reading `shippingTiers`
     * straight off the dealer looked equivalent and was not: it holds only the
     * hand-entered table, so for every shop nobody has typed one for, the plan
     * had no tiers, every total came out null, and the screen blamed the
     * budget for a postage table it had simply not asked for.
     */
    const preferences = await getPreferences()
    const shipping = row
      ? await resolveShipping(row, preferences.shipsToCountry)
      : { tiers: [], source: null, matched: [] }

    // Everything this dealer has that you want, not only what is in the basket
    // — the plan's whole job is to say which set to buy.
    const { candidates } = await candidatesFor(dealer, Date.now())
    return planBasket(candidates, shipping.tiers, budget, row?.minOrderTotal ?? 0)
  },

  'dig.credits': async ({ digId }) => {
    const { creditGroups } = await import('./dig/credits')
    return creditGroups(digId)
  },

  'data.exportDig': async ({ digId }) => {
    const { exportDig } = await import('./export')
    return exportDig(digId, Date.now())
  },

  'data.exportAll': async () => {
    const { exportEverything } = await import('./export')
    return exportEverything(Date.now())
  },

  'data.deleteAll': async () => {
    // Same operation as signing out, under the name that says what it does.
    await signOut()
    return { deleted: true as const }
  },

  'preferences.get': () => getPreferences(),

  'preferences.set': ({ ...patch }) => updatePreferences(patch),

  'hub.discover': async () => {
    /*
     * Genau die Adresse, an der `hub/compose.yml` ihn aufstellt.
     *
     * Both spellings, because a hub bound to 127.0.0.1 does not answer to
     * `localhost` on a machine where that resolves to ::1 first — and the
     * failure looks identical to "there is no hub".
     */
    const tried = ['http://localhost:8787', 'http://127.0.0.1:8787']

    /*
     * Vorhergesagt, nicht erkannt.
     *
     * A blocked request and a refused connection are the same TypeError to
     * JavaScript. But the block is knowable in advance: an https page asking
     * for http is mixed content, which WebKit refuses outright (measured
     * 2026-08-10). Saying so is the difference between "run the hub over
     * https" and a fruitless hunt for a service that is running fine.
     */
    const blockedByMixedContent = self.location?.protocol === 'https:'

    for (const base of tried) {
      try {
        const response = await fetch(`${base}/v1/health`, {
          // Short: a machine that is not listening refuses instantly, and the
          // only thing a longer wait buys is a longer wait.
          signal: AbortSignal.timeout(1500),
        })
        if (!response.ok) continue
        const body = (await response.json()) as { ok?: boolean }
        if (body.ok === true) return { url: base, blockedByMixedContent: false, tried }
      } catch {
        // Refused, blocked or too slow — all three mean "not this one".
      }
    }

    return { url: null, blockedByMixedContent, tried }
  },

  'hub.check': async ({ url, secret }) => {
    const base = url.trim().replace(/\/+$/, '')
    if (!base) throw new Error('hub: no url given')

    // Deliberately a plain fetch rather than the hub client: this is the one
    // place a failure has to be *reported* instead of swallowed.
    let response: Response
    try {
      response = await fetch(`${base}/v1/health`, {
        headers: secret ? { 'x-hub-secret': secret } : {},
        signal: AbortSignal.timeout(5000),
      })
    } catch {
      /*
       * „Failed to fetch" ist keine Antwort.
       *
       * That string is what the browser says and it reached the screen
       * untouched. It covers four different situations and names none of them,
       * so the sentence below names the ones somebody can actually act on —
       * including the mixed-content case, which is not a fault in the hub at
       * all and which every iPhone hits (measured 2026-08-10).
       */
      const mixed = self.location?.protocol === 'https:' && base.startsWith('http://')
      // A code, not a sentence: `HubSettings` writes the words, in whatever
      // language the person reading them has chosen.
      throw Object.assign(new Error(mixed ? 'hub: mixed content' : 'hub: no answer'), {
        code: mixed ? ('hub-mixed-content' as const) : ('hub-unreachable' as const),
      })
    }
    if (!response.ok) {
      throw Object.assign(new Error(`hub: HTTP ${response.status}`), {
        code: 'hub-http-error' as const,
        status: response.status,
      })
    }

    const body = (await response.json()) as {
      ok?: boolean
      horizon?: number
      shipping?: number
      secured?: boolean
    }
    if (body.ok !== true) throw new Error('Das ist kein Fidelity-Hub.')

    return {
      ok: true,
      horizon: body.horizon ?? 0,
      shipping: body.shipping ?? 0,
      secured: body.secured ?? false,
    }
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

  /*
   * Its own module and a dynamic import: the start screen is the first thing
   * anybody sees, and the code that assembles it has no business sitting in
   * the worker's entry chunk beside the scanner.
   */
  'home.overview': async () => (await import('./home')).homeOverview(),

  /*
   * The one handler that works without a token, and the only one that may:
   * everything it reads is public (docs/02, measured). Its own module and a
   * dynamic import, because somebody who is signed in never runs it and it has
   * no business in the worker's entry chunk.
   */
  'demo.run': async ({ listingIds }, { report, signal }) => {
    const { runDemo } = await import('./demo')
    return runDemo({
      client: discogs(),
      listingIds,
      report: (progress) => report(progress),
      signal,
    })
  },

  'keeper.tick': async ({ force }, { signal }) => {
    const { runKeeper } = await import('./keeper')
    return runKeeper({
      client: discogs(),
      username: (await currentIdentity())?.username ?? null,
      force,
      signal,
    })
  },

  /*
   * Cover. Zwei Wege, weil sie zwei verschiedene Dinge kosten.
   *
   * `known` reads the store and answers offline; `fetch` spends requests. A
   * screen calls the first on every render and the second only for what is
   * actually on it — see worker/covers.ts for why the marketplace leaves this
   * to us at all.
   */
  'covers.known': async ({ releaseIds }) => {
    const { readCovers } = await import('~~/db/covers')
    return toCoverMap(await readCovers(releaseIds))
  },

  'covers.fetch': async ({ releaseIds, limit }, { report, signal }) => {
    const { fetchCovers } = await import('./covers')
    const { readCovers } = await import('~~/db/covers')

    await fetchCovers({
      client: discogs(),
      releaseIds,
      limit,
      report: (progress) => report(progress),
      signal,
    })

    return toCoverMap(await readCovers(releaseIds))
  },

  'library.summary': async () => {
    const db = await openFidelityDb()
    const syncState = await getSyncState()
    return {
      collection: await db.count('collection'),
      wantlist: await db.count('wantlist'),
      dealers: await db.count('dealers'),
      basket: await db.count('basket'),
      // Counted rather than stored: a verdict can be taken back, and a number
      // that drifts from the list it describes is worse than no number.
      marked: (await db.getAll('feedback')).filter((entry) => entry.verdict === 'interesting')
        .length,
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
  const [{ basketListingIds, basketSummaries }, { suggestCandidates }] = await Promise.all([
    import('./basket'),
    import('./basket/optimise'),
  ])

  const now = Date.now()
  const preferences = await getPreferences()
  const summaries = await basketSummaries(now, preferences.shipsToCountry)
  const listingIds = await basketListingIds()
  const inBasket = new Set(listingIds)

  /*
   * Candidates are per shop, because postage is. Filling up at one seller says
   * nothing about what would ride along at another — and suggesting a record
   * from the wrong shop is the one mistake that would cost real money.
   */
  const baskets = await Promise.all(
    summaries.map(async (summary) => {
      const { candidates, dig } = await candidatesFor(summary.dealer, now)
      return {
        ...summary,
        /*
         * Which dig the suggestions came out of, so an empty list can say
         * why. Three silences look identical on screen and mean different
         * things: a shop nobody has walked, a dig whose prices have aged past
         * the six-hour rule, and a shop that simply has nothing else for you.
         * Only the last one is an answer.
         */
        dig,
        candidates: suggestCandidates(
          candidates,
          inBasket,
          preferences.targetPrice,
          undefined,
          summary.missingToMinimum,
        ),
      }
    }),
  )

  return { baskets, listingIds }
}

/** The scored records this dealer still has, newest dig first. */
async function candidatesFor(
  dealer: string,
  now: number,
): Promise<{ candidates: BasketCandidate[]; dig: BasketDig | null }> {
  const { toCandidate } = await import('./basket/optimise')
  const db = await openFidelityDb()
  const newest = (await db.getAll('digs'))
    .filter((entry) => entry.dealer === dealer)
    .sort((a, b) => b.id.localeCompare(a.id))[0]
  if (!newest) return { candidates: [], dig: null }

  const dig = { at: newest.startedAt, expired: newest.expiresAt <= now }

  const matches = await db
    .transaction('matches')
    .store.index('by-dig-score')
    .getAll(IDBKeyRange.bound([newest.id, -Infinity], [newest.id, Infinity]))

  return {
    dig,
    candidates: matches
      .map(toCandidate)
      .filter((item): item is BasketCandidate => item !== null),
  }
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
