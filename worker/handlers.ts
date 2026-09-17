import { getMeta, getPreferences, getSyncState, setMeta, updatePreferences } from '~~/db/meta'
import { openFidelityDb } from '~~/db/open'
import type { DbStats, ParamsOf, RequestKind, ResultOf } from '#shared/protocol'
import type { BasketCandidate, BasketDig, BasketView } from '#shared/types'

import { currentIdentity, discogs, requestPersistence, signOut } from './auth'

import { forgetLookup } from './dig/detail'
import { affinityFactor } from './dig/fingerprint'
import { shelfSample } from './dealers/shelf'
import { allFeedback, clearFeedback, feedbackVerdicts, recordFeedback } from './feedback'

import { bestPerRelease, topFive } from './match/select'
import { computeTasteProfile } from './match/taste'
import { fail } from './fail'

/**
 * The shops, best first — what `dealer.list` answers and what `dealer.hide`
 * answers with once it is done.
 *
 * Ranked by how much of their stock is for you, which is the only ordering
 * that answers "where should I look first". Dealers that were never scanned
 * come last but are *not* left out: a shipping table entered by hand creates
 * one, and a shop you can compute postage for should not be invisible on the
 * screen about shops. Hidden ones are left out — that is what hiding is.
 */
const rankedDealers = async () => (await import('./dealers/list')).rankedDealers()

/**
 * Shops whose profile this session has already asked Discogs for (M34.4).
 *
 * The first open of a shop from before fires one `/users/{u}` in the
 * background. Where that fails — offline, a 401 on a stale token, a 429 —
 * nothing is written, and every further open fired it again. Once per
 * session is enough: the next start tries afresh.
 */
const askedProfile = new Set<string>()

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
  'valueHistory',
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
  let dataBytes: number | null = null
  let coverEntries: number | null = null
  let persisted = false
  if (typeof navigator !== 'undefined' && navigator.storage) {
    const estimate = await navigator.storage.estimate?.()
    usageBytes = estimate?.usage ?? null
    quotaBytes = estimate?.quota ?? null
    // Chrome only, and not in the standard: what IndexedDB takes on its own.
    const details = (estimate as { usageDetails?: { indexedDB?: number } } | undefined)
      ?.usageDetails
    dataBytes = details?.indexedDB ?? null
    persisted = (await navigator.storage.persisted?.()) ?? false
  }
  if (typeof caches !== 'undefined') {
    try {
      coverEntries = (await caches.has('fidelity-covers'))
        ? (await (await caches.open('fidelity-covers')).keys()).length
        : 0
    } catch {
      coverEntries = null
    }
  }

  return { counts, usageBytes, quotaBytes, dataBytes, coverEntries, persisted }
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
  'auth.renew': async ({ token }) => (await auth()).renewToken(token),
  'auth.signOut': async () => {
    await signOut()
    return { signedOut: true as const }
  },

  'library.sync': async (_params, { report, signal }) => {
    const identity = await currentIdentity()
    if (!identity) throw fail('not-signed-in', 'not signed in')

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

  'wantlist.plan': async ({ from }) => {
    const { wantlistPlan } = await import('./collection/wantplan')
    return wantlistPlan(Date.now(), from)
  },

  'collection.review': async ({ year }) => {
    const { collectionReview } = await import('./collection/review')
    return collectionReview(year)
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
      hadForSale: known?.numForSale ?? null,
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
    const { parseCartText } = await import('./basket/parse-cart')
    const { noteCart } = await import('./basket/cart')
    const preferences = await getPreferences()
    const now = Date.now()

    // The cart page first: no request, and its postage figures are what the
    // basket view below adds up with.
    const cart = await noteCart(parseCartText(input), now)

    const result = await addPastedListings({
      client: discogs(),
      ids: parseListingIds(input),
      currency: preferences.currency,
      now,
      report: (progress) => report(progress),
      signal,
    })

    return { ...result, cart, view: await basketView() }
  },

  'dig.resumable': async () => (await scan()).findResumable(),
  'dig.running': async () => (await scan()).runningDig(),

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

  /*
   * Shops other people have dug (ADR-014). No Discogs request at all — it
   * talks to the hub, or to nobody.
   */
  'shops.suggest': async (_params, { signal }) =>
    (await import('./dealers/suggest')).suggestShops(Date.now(), signal),

  /*
   * The same basket at the other shops (M29). No request: it reads the stock
   * rows the digs already wrote, and only the ones still inside six hours.
   */
  'compare.basket': async ({ dealer }) =>
    (await import('./basket/compare')).compareBasket(dealer),

  /*
   * The radar (M29): bands somebody has an eye on and owns nothing by.
   *
   * Its own module and a dynamic import — the entry chunk is for the scan.
   */
  'followed.list': async () => (await import('./followed')).listFollowed(),
  'followed.search': async ({ query }, { signal }) =>
    (await import('./followed')).searchArtists(discogs(), query, signal),
  'followed.add': async ({ artistId, name }) => {
    const { follow } = await import('./followed')
    const list = await follow(artistId, name)
    // The detail sheet caches the lookup, and the radar changes what a match
    // means — the same invalidation a rebuilt horizon does.
    forgetLookup()
    return list
  },
  'followed.remove': async ({ artistId }) => {
    const { unfollow } = await import('./followed')
    const list = await unfollow(artistId)
    forgetLookup()
    return list
  },

  /*
   * The round: every watched shop in one go (`worker/dealers/round.ts`).
   *
   * Its own module and a dynamic import, like every other minutes-long job
   * here — the entry chunk has no business carrying it.
   */
  'round.plan': async () => (await import('./dealers/round')).planRound(),
  'round.last': async () => (await import('./dealers/round')).lastRound(),
  'round.running': async () => (await import('./dealers/round')).runningRound(),
  'round.run': async (_params, { report, signal }) => {
    const { runRound } = await import('./dealers/round')
    return runRound({
      client: discogs(),
      report: (progress) => report(progress),
      signal,
    })
  },

  /*
   * Who is expanding, and how far — for a panel that was not there when it
   * started. Costs nothing: module state in this worker, no database, no
   * request.
   */
  'horizon.running': async () => {
    const { runningHorizon } = await import('./horizon/running')
    return runningHorizon()
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
      // It passes `only` like the revalidation and is not one: without this
      // the panel would show "refreshing" for the pass after a dig.
      job: 'gaps',
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
    const dealer = await db.get('dealers', username)
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
    if (
      (dealer.avatarUrl === undefined || dealer.registeredAt === undefined) &&
      !askedProfile.has(username)
    ) {
      askedProfile.add(username)
      /*
       * Started, not awaited. The profile is a screen; the logo is decoration
       * on it — and until 2026-09-13 the screen waited for the decoration.
       * Behind a 429 that wait is the client's own backoff, up to a minute,
       * and the browser tests that open a shop's profile fell over on CI,
       * whose shared addresses Discogs limits first. The first open starts
       * the request; the sign is on the list from the next open on.
       */
      void (async () => {
        try {
          const { dealerSchema, trustOf } = await inventory()
          const profile = await discogs().get(
            `/users/${encodeURIComponent(username)}`,
            dealerSchema,
            { signal },
          )
          const fresh = await db.get('dealers', username)
          if (fresh)
            await db.put('dealers', {
              ...fresh,
              avatarUrl: profile.avatar_url || fresh.avatarUrl || '',
              ...trustOf(profile, fresh),
            })
        } catch {
          // A logo is decoration. Offline, rate-limited or gone — the screen
          // draws initials and nothing is written, so the next visit tries again.
        }
      })()
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
      shelf: await shelfSample(db, dealer),
      postageNamed: (await import('./basket/postage')).freshPostage(
        (await db.getAll('basket')).filter((item) => item.dealer === username),
        Date.now(),
      ),
    }
  },

  /**
   * What this device has asked Discogs for, and what it was spared (M31.9).
   *
   * The ceiling comes from the pacer's own constants rather than from Discogs:
   * with a token the app paces itself to fifty a minute, without one to
   * twenty-five — ten under each of Discogs' two limits, on purpose.
   */
  'limit.now': async () => {
    const { ledger } = await import('./discogs/ledger')
    const { MIN_REQUEST_INTERVAL_MS, ANONYMOUS_REQUEST_INTERVAL_MS } =
      await import('./discogs/pacer')
    const identity = await currentIdentity()
    const gap = identity ? MIN_REQUEST_INTERVAL_MS : ANONYMOUS_REQUEST_INTERVAL_MS

    return { ...ledger(), ceiling: Math.round(60_000 / gap) }
  },

  'watch.set': async ({ dealer, watching }) => {
    const { setWatching, watchedDealers } = await import('./watch/check')
    await setWatching(dealer, watching)

    /*
     * The hub is told the new list right away, and nobody waits for it.
     *
     * A shop added to the watchlist but not to the hub is a shop that will
     * never send a notification, and the difference would show up weeks later
     * as "it just doesn't work". Not awaited because the button that started
     * this must not sit still for a hub that is slow — the call has its own
     * two-second limit and swallows everything (rule 8).
     */
    const { syncPush } = await import('./watch/push')
    void syncPush()

    return watchedDealers()
  },

  'release.detail': async ({ releaseId, refresh }) => {
    const { releaseDetail } = await import('./collection/detail')
    return releaseDetail(discogs(), releaseId, { refresh })
  },

  'watch.pushKey': async () => {
    const { pushKey } = await import('./watch/push')
    return pushKey()
  },

  'watch.pushOn': async ({ registration }) => {
    const { enablePush } = await import('./watch/push')
    return enablePush(registration)
  },

  'watch.pushOff': async () => {
    const { disablePush } = await import('./watch/push')
    await disablePush()
    return true
  },

  'watch.list': async () => {
    const { watchedDealers } = await import('./watch/check')
    return watchedDealers()
  },

  'watch.check': async ({ force }, { signal }) => {
    const { checkWatched } = await import('./watch/check')
    return checkWatched({ client: discogs(), force, signal })
  },

  'dealer.stock': async (params) => {
    const { dealerStock } = await import('./dealers/stock')
    return dealerStock(params)
  },

  'dealer.list': async () => rankedDealers(),

  'dealer.overview': async () => {
    const [{ hiddenDealers }, round] = await Promise.all([
      import('./dealers/hide'),
      import('./dealers/round'),
    ])
    const [dealers, hidden, preferences, plan, lastRound, running] = await Promise.all([
      rankedDealers(),
      hiddenDealers(),
      getPreferences(),
      round.planRound(),
      round.lastRound(),
      round.runningRound(),
    ])
    return { dealers, hidden, home: preferences.shipsToCountry, plan, lastRound, running }
  },

  /*
   * A shop entered by hand (M30).
   *
   * Reported plainly: "I want to enter dealers myself, so they are there for
   * future digs." Until now a shop reached this list by being dug or by being
   * imported from a discovery run — so somebody who knows where they want to
   * look before they have looked had nowhere to put it.
   *
   * One request. `/users/{name}` says whether the shop exists and how big it
   * is, and refusing to write a row without that would be the difference
   * between a shop and a typo sitting in the list for ever.
   */
  'dealer.add': async ({ dealer }, { signal }) => {
    const { addDealerByHand } = await import('./dealers/add')
    await addDealerByHand(discogs(), dealer, signal)
    return rankedDealers()
  },

  'dealer.hide': async ({ dealer, hidden }) => {
    const { setHidden, hiddenDealers } = await import('./dealers/hide')
    const before = await (await openFidelityDb()).get('dealers', dealer)
    await setHidden(dealer, hidden)

    // Hiding a watched shop unwatches it, and the hub keeps a copy of that
    // list — told the same way `watch.set` tells it, and not waited for.
    if (hidden && before?.watching) {
      const { syncPush } = await import('./watch/push')
      void syncPush()
    }

    return { visible: await rankedDealers(), hidden: await hiddenDealers() }
  },

  'dealer.hidden': async () => (await import('./dealers/hide')).hiddenDealers(),

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

  'dig.refreshOne': async ({ digId, listingId }, { signal }) => {
    const { refreshListing } = await import('./dig/refresh')
    const { currency } = await getPreferences()
    return refreshListing({ client: discogs(), digId, listingId, currency, signal })
  },

  /*
   * Sharing — the one handler that has to manage without a token.
   *
   * `share.read` runs at somebody who may never have set Fidelity up: no
   * collection, no token, no hub entered. So the hub address comes from the
   * link rather than from the settings, and nothing here asks for an identity.
   */
  'grading.forDealer': async ({ dealer }) => {
    const { gradingFor } = await import('./grading')
    return gradingFor(dealer)
  },

  'grading.awaiting': async () => {
    const { awaitingArrival } = await import('./grading')
    return awaitingArrival()
  },

  'grading.record': async ({ listingId, arrived }) => {
    const { recordArrival } = await import('./grading')
    await recordArrival(listingId, arrived)
    return true as const
  },

  'orders.import': async ({ orderId }) => {
    const { importOrder } = await import('./orders')
    return importOrder(discogs(), orderId)
  },

  'identify.barcode': async ({ barcode }, { signal }) => {
    const { identify } = await import('./identify')
    const { catalogueSource } = await import('./catalogue/client')
    return identify(discogs(), barcode, signal, await catalogueSource())
  },

  'identify.runout': async ({ runout }, { signal }) => {
    const { identifyByRunout } = await import('./identify')
    const { catalogueSource } = await import('./catalogue/client')
    return identifyByRunout(discogs(), runout, signal, await catalogueSource())
  },

  'taste.compared': async () => {
    const { compareWithCatalogue } = await import('./collection/compared')
    const { catalogueSource } = await import('./catalogue/client')
    return compareWithCatalogue(
      (await getMeta('tasteProfile')) ?? null,
      await catalogueSource(),
    )
  },

  'pressing.family': async ({ releaseId }, { signal }) => {
    const { pressingFamily } = await import('./pressing-family')
    return pressingFamily(discogs(), releaseId, { signal })
  },

  'places.overview': async () => {
    const { placesOverview } = await import('./places')
    return placesOverview()
  },

  'places.create': async ({ name, parentId }) => {
    const { createPlace } = await import('./places')
    return createPlace(name, parentId)
  },

  'places.createUnit': async (params) => {
    const { createUnit } = await import('./places')
    return createUnit(params)
  },

  'places.rule': async ({ id, rule }) => {
    const { setRule } = await import('./place-rules')
    return setRule(id, rule)
  },

  'places.pin': async ({ placeId, instanceId }) => {
    const { pinCompartment } = await import('./place-rules')
    return pinCompartment(placeId, instanceId)
  },

  'places.unpin': async ({ placeId }) => {
    const { unpinCompartment } = await import('./place-rules')
    return unpinCompartment(placeId)
  },

  'places.dealing': async ({ id, dealing }) => {
    const { setDealing } = await import('./place-rules')
    return setDealing(id, dealing)
  },

  'places.plan': async ({ unitId, includeUnplaced }) => {
    const { planUnit } = await import('./place-rules')
    return planUnit(unitId, includeUnplaced)
  },

  'places.apply': async ({ unitId, includeUnplaced }) => {
    const { applyUnitPlan } = await import('./place-rules')
    return applyUnitPlan(unitId, includeUnplaced)
  },

  'places.propose': async ({ instanceId }) => {
    const { proposePlace } = await import('./place-rules')
    return proposePlace(instanceId)
  },

  'places.finish': async ({ id, finish }) => {
    const { setFinish } = await import('./places')
    return setFinish(id, finish)
  },

  'places.rename': async ({ id, name }) => {
    const { renamePlace } = await import('./places')
    return renamePlace(id, name)
  },

  'places.remove': async ({ id }) => {
    const { removePlace } = await import('./places')
    await removePlace(id)
    return true as const
  },

  'places.assign': async ({ instanceId, placeId }) => {
    const { placeRecord } = await import('./places')
    await placeRecord(instanceId, placeId)
    return true as const
  },

  'places.assignMany': async ({ instanceIds, placeId }) => {
    const { placeRecords } = await import('./places')
    return placeRecords(instanceIds, placeId)
  },

  'places.of': async ({ instanceId }) => {
    const { placeOf } = await import('./places')
    return placeOf(instanceId)
  },

  'places.contents': async ({ placeId }) => {
    const { placeContents } = await import('./places')
    return placeContents(placeId)
  },

  'places.moveAll': async ({ from, to }) => {
    const { moveAll } = await import('./places')
    return moveAll(from, to)
  },

  'places.move': async ({ id, parentId }) => {
    const { movePlace } = await import('./places')
    return movePlace(id, parentId)
  },

  'watched.list': async () => {
    const { listWatched } = await import('./watched/check')
    return listWatched()
  },

  'watched.add': async (entry) => {
    const { watchRelease } = await import('./watched/check')
    return watchRelease(entry)
  },

  'watched.remove': async ({ releaseId }) => {
    const { unwatchRelease } = await import('./watched/check')
    await unwatchRelease(releaseId)
    return true as const
  },

  'watched.check': async ({ force }, { signal, report }) => {
    const { checkWatched } = await import('./watched/check')
    return checkWatched(discogs(), { force, signal, report })
  },

  'stack.overview': async () => {
    const { stackOverview } = await import('./stack')
    return stackOverview()
  },

  'stack.seen': async ({ digId, seen }) => {
    const { stackSeen } = await import('./stack')
    await stackSeen(digId, seen)
    return true as const
  },

  'share.create': async ({ digId }) => {
    const loaded = await loadDig(digId)
    if (!loaded) throw fail('dig-gone', 'no such dig')

    const { createShare } = await import('./share')
    return createShare(loaded)
  },

  'share.read': async ({ hubUrl, id, key }) => {
    const { readShare } = await import('./share')
    return readShare(hubUrl, id, key)
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
    if (!match || !dig) throw fail('match-gone', 'no such match')

    await addToBasket(match, dig.dealer, Date.now())
    return basketView()
  },

  'basket.remove': async ({ listingId }) => {
    const { removeFromBasket } = await import('./basket')
    await removeFromBasket(listingId)
    return basketView()
  },

  'basket.handedOver': async ({ listingId, at }) => {
    const { markHandedOver } = await import('./basket')
    await markHandedOver(listingId, at)
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
    if (!identity) throw fail('not-signed-in', 'not signed in')

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
    return { added, dealers: await rankedDealers() }
  },

  'collection.records': async (params) => {
    const { shelfView } = await import('./collection/records')
    return shelfView(params)
  },

  'wantlist.add': async ({ digId, listingId }) => {
    const db = await openFidelityDb()
    const match = await db.get('matches', [digId, listingId])
    if (!match) return false
    const { wantRecord } = await import('./collection/want')
    return wantRecord(match)
  },

  'wantlist.note': async ({ releaseId, note, want }) => {
    const { noteWant } = await import('./collection/want')
    return noteWant(releaseId, note, want)
  },

  'wantlist.remove': async ({ releaseId }) => {
    const { unwantRecord } = await import('./collection/want')
    return unwantRecord(releaseId)
  },

  'wantlist.removeMany': async ({ releaseIds }) => {
    const { unwantRecords } = await import('./collection/want')
    return unwantRecords(releaseIds)
  },

  'wantlist.restore': async ({ records }) => {
    const { rewantRecords } = await import('./collection/want')
    return rewantRecords(records)
  },

  'outbox.flush': async () => {
    const identity = await currentIdentity()
    if (!identity) return { sent: 0, givenUp: 0, waiting: 0 }
    const { drainOutbox } = await import('./outbox')
    return drainOutbox(discogs(), identity.username)
  },

  'collection.readFullyAt': async () => {
    const { getSyncState } = await import('~~/db/meta')
    return (await getSyncState()).collectionReadFullyAt
  },

  'collection.folders': async () => {
    const { knownFolders } = await import('./collection/folders')
    return knownFolders()
  },

  'collection.move': async ({ instanceId, folderId }) => {
    const { moveToFolder } = await import('./collection/folders')
    return moveToFolder(instanceId, folderId)
  },

  'collection.remove': async ({ instanceId }) => {
    const { removeRecord } = await import('./collection/remove')
    return removeRecord(instanceId)
  },

  'collection.add': async ({ digId, listingId }) => {
    const db = await openFidelityDb()
    const match = await db.get('matches', [digId, listingId])
    if (!match) return false
    const { addRecord } = await import('./collection/add')
    return addRecord(match)
  },

  'collection.value': async () => {
    const { getMeta } = await import('~~/db/meta')
    return (await getMeta('collectionValue')) ?? null
  },

  'collection.valueHistory': async () => (await import('./collection/value')).valueHistory(),

  'collection.fields': async ({ instanceId }) => {
    const [{ collectionFields }, { fieldValuesFor }] = await Promise.all([
      import('./collection/fields'),
      import('~~/db/fields'),
    ])
    const values = await fieldValuesFor(instanceId)
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

  'collection.setField': async ({ instanceId, fieldId, value }) => {
    const { setFieldValue } = await import('./collection/fields')
    return setFieldValue(instanceId, fieldId, value)
  },

  'collection.rate': async ({ instanceId, rating }) => {
    const { rateRecord } = await import('./collection/rate')
    return rateRecord(instanceId, rating)
  },

  'collection.record': async ({ instanceId }) => {
    const { shelfRecord } = await import('./collection/records')
    return shelfRecord(instanceId)
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

  'basket.readOff': async ({ dealer, items, price, currency }) => {
    const { readOffShipping } = await import('./basket/profiles')
    await readOffShipping(dealer, items, price, currency)
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

  'basket.landed': async ({ dealer }) => {
    const { resolveShipping } = await import('./basket/profiles')
    const db = await openFidelityDb()
    const row = await db.get('dealers', dealer)
    const preferences = await getPreferences()
    // The same ladder as the basket card and the plan above — see the note there.
    const shipping = row
      ? await resolveShipping(row, preferences.shipsToCountry)
      : { tiers: [], source: null, matched: [] }
    // Sold lines are shown in the basket but no longer counted, here as there.
    const lines = (await db.getAll('basket')).filter(
      (item) => item.dealer === dealer && !item.soldAt,
    )
    return {
      dealer,
      tiers: shipping.tiers,
      source: shipping.source,
      section: shipping.section ?? null,
      inBasket: lines.length,
      listingIds: lines.map((item) => item.listingId),
      currency: shipping.tiers[0]?.currency ?? null,
    }
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

  'data.exportCsv': async ({ what }) => {
    const { collectionCsv, wantlistCsv } = await import('./csv')
    return what === 'collection' ? collectionCsv() : wantlistCsv()
  },

  'data.importAll': async ({ file }) => {
    const { importEverything } = await import('./import')
    return importEverything(file)
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
     * Here first, then on this machine.
     *
     * `/hub` on the app's own domain is where `.github/workflows/hub.yml` puts
     * one, and same origin is the only arrangement that cannot fail for a
     * reason outside the hub itself: no CORS, no mixed content, no second
     * certificate — and it is the only one that still works on a phone that
     * is nowhere near the machine at home.
     *
     * The bare origin comes second, for a hub sitting at the root of a domain
     * whose app lives under a path.
     *
     * A static host answers an unknown path with the app's own HTML and a 200.
     * That is not a special case here: `response.json()` throws on it, and a
     * throw means "not this one" like any other.
     *
     * Then localhost, in both spellings — a hub bound to 127.0.0.1 does not
     * answer to `localhost` on a machine where that resolves to ::1 first, and
     * the failure looks identical to "there is no hub".
     */
    const here = self.location?.origin
    const tried = [
      ...(here ? [`${here}/hub`, here] : []),
      'http://localhost:8787',
      'http://127.0.0.1:8787',
    ]

    /*
     * Predicted, not detected.
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
        const body = (await response.json()) as { ok?: boolean; secured?: boolean }
        if (body.ok === true) {
          return {
            url: base,
            // Assumed secured when the hub does not say: an unsecured guess
            // would have the app save an address it cannot use, and then fail
            // silently forever (rule 8).
            secured: body.secured !== false,
            blockedByMixedContent: false,
            tried,
          }
        }
      } catch {
        // Refused, blocked or too slow — all three mean "not this one".
      }
    }

    return { url: null, secured: false, blockedByMixedContent, tried }
  },

  'catalogue.discover': async () => {
    const { discoverCatalogue } = await import('./catalogue/probe')
    return discoverCatalogue()
  },

  'catalogue.check': async ({ url }) => {
    const { checkCatalogue } = await import('./catalogue/probe')
    return checkCatalogue(url)
  },

  'hub.check': async ({ url, secret, accessKey }) => {
    const base = url.trim().replace(/\/+$/, '')
    if (!base) throw fail('no-hub', 'hub: no url given')

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
       * "Failed to fetch" is not an answer.
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
      throw mixed
        ? fail('hub-mixed-content', 'hub: mixed content')
        : fail('hub-unreachable', 'hub: no answer')
    }
    if (!response.ok) {
      throw Object.assign(fail('hub-http-error', `hub: HTTP ${response.status}`), {
        status: response.status,
      })
    }

    const body = (await response.json()) as {
      ok?: boolean
      horizon?: number
      shipping?: number
      secured?: boolean
      doors?: ('secret' | 'key')[]
    }
    if (body.ok !== true) throw fail('not-a-hub', 'not a fidelity hub')
    const doors = Array.isArray(body.doors) ? body.doors : []

    /*
     * The secret, tried at a door that is actually locked.
     *
     * Health is open on purpose so a monitor needs no word — which means it
     * answers "reachable" to a wrong word just the same. On 2026-09-12 a phone
     * showed "reachable · secured with a secret" while every horizon request
     * it made came back 401. So the check knocks once more where the secret
     * matters: the cover route answers 200 with an empty map to the right
     * word and 401 to a wrong one.
     */
    let secretState: 'ok' | 'wrong' | 'missing' | 'unchecked' = 'unchecked'
    if (body.secured) {
      if (!secret) {
        secretState = 'missing'
      } else {
        try {
          const door = await fetch(`${base}/v1/covers?ids=1`, {
            headers: { 'x-hub-secret': secret },
            signal: AbortSignal.timeout(5000),
          })
          secretState = door.status === 401 ? 'wrong' : door.ok ? 'ok' : 'unchecked'
        } catch {
          secretState = 'unchecked'
        }
      }
    }

    // And the key, at the same door, when the hub has that door (M22).
    let keyState: 'ok' | 'wrong' | 'missing' | 'unchecked' = 'unchecked'
    if (doors.includes('key')) {
      if (!accessKey) {
        keyState = 'missing'
      } else {
        try {
          const door = await fetch(`${base}/v1/covers?ids=1`, {
            headers: { 'x-fidelity-key': accessKey },
            signal: AbortSignal.timeout(5000),
          })
          keyState = door.status === 401 ? 'wrong' : door.ok ? 'ok' : 'unchecked'
        } catch {
          keyState = 'unchecked'
        }
      }
    }

    return {
      ok: true,
      secret: secretState,
      key: keyState,
      doors,
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

  'dig.stands': async () => (await import('./stands')).recentStands(),

  /*
   * The newest dig — except the one being scanned this second.
   *
   * A running dig is a record in the database like any other, and it is the
   * newest one there is: the scanner writes it before the first page and
   * updates it after every page. So a screen asking for "the latest dig" while
   * a scan ran was handed a row that says `0 Treffer · 0 von 5.551 gescannt`,
   * and rendered the acquittal for it — "nothing here for you at this shop" —
   * directly under a progress bar reading `443 von 5.551 · 45 Treffer`.
   * Reported with exactly that screenshot on 2026-09-13.
   *
   * The bar is the truth while a scan runs, and it has its own place on the
   * screen. This hands back the last dig that is *finished with*, which is the
   * only thing a result list can honestly show.
   */
  'dig.latest': async () => {
    const db = await openFidelityDb()
    const live = (await scan()).runningDig()
    const digs = (await db.getAll('digs')).filter((dig) => dig.id !== live?.digId)
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

  'keeper.tick': async ({ force, eager }, { report, signal }) => {
    const { runKeeper } = await import('./keeper')
    return runKeeper({
      client: discogs(),
      username: (await currentIdentity())?.username ?? null,
      force,
      eager,
      signal,
      report,
    })
  },

  /*
   * Covers. Two routes, because they cost two different things.
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
