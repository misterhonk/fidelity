import { getPreferences } from '~~/db/meta'
import { openFidelityDb } from '~~/db/open'
import { shippingFor } from '#shared/shipping'
import { passesOrigin, type OriginFilter } from '#shared/countries'
import type {
  Dig,
  Match,
  PlannedShop,
  PlannedShops,
  ShippingTier,
  WantlistItem,
  WantPlan,
} from '#shared/types'

/**
 * Your wants, across the shops you scanned (docs/06 M19 #9).
 *
 * The wish at the top of every list — "for my 24 wants: 3 shops, €41
 * postage, not 5 shops, €67" — and the one this app can only half grant:
 * there is no listings-by-release endpoint, so it can plan over the shops it
 * has scanned and over nothing else. The screen says so.
 *
 * What it adds over "each where it is cheapest" is the postage. A shop that
 * has two of your wants at a euro more each is cheaper than two shops at a
 * euro less, once the second parcel is counted — and the tier tables the
 * basket uses know exactly that.
 *
 * Rule 4 throughout: only digs inside their six hours, so every price is one
 * that may still be shown, and the plan carries the earliest expiry.
 */

/** Past this many shops the subsets are not enumerated; a greedy drop is used. */
export const MAX_EXACT_SHOPS = 12

export interface WantOffer {
  /** The wantlist entry this covers. */
  wantKey: number
  dealer: string
  listingId: number
  releaseId: number
  price: number
  currency: string
  exact: boolean
  title: string
  artist: string
  /** Discogs' 0–5 for the want. */
  want: number
}

export interface PlanShopInput {
  dealer: string
  displayName: string
  digId: string
  tiers: ShippingTier[]
  minOrderTotal: number
}

/**
 * What a set of shops costs, covering every want it can — or null when the
 * set leaves a want out or a postage table stops short of a parcel.
 */
export function evaluate(
  chosen: Set<string>,
  offers: WantOffer[],
  shops: Map<string, PlanShopInput>,
  wants: Set<number>,
): PlannedShops | null {
  const best = new Map<number, WantOffer>()
  for (const offer of offers) {
    if (!chosen.has(offer.dealer)) continue
    const held = best.get(offer.wantKey)
    if (!held || offer.price < held.price) best.set(offer.wantKey, offer)
  }
  for (const want of wants) if (!best.has(want)) return null

  const perShop = new Map<string, WantOffer[]>()
  for (const offer of best.values()) {
    const list = perShop.get(offer.dealer) ?? []
    list.push(offer)
    perShop.set(offer.dealer, list)
  }
  // A chosen shop that ends up with nothing is not part of the plan.
  const planned: PlannedShop[] = []
  for (const [dealer, items] of perShop) {
    const shop = shops.get(dealer)
    if (!shop) return null
    const postage = shippingFor(shop.tiers, items.length)?.price
    if (postage === undefined) return null
    const goods = items.reduce((sum, item) => sum + item.price, 0)
    planned.push({
      dealer,
      displayName: shop.displayName,
      digId: shop.digId,
      // The ones you want most first (M20 #1), then by name.
      items: items
        .sort(
          (a, b) =>
            b.want - a.want ||
            a.artist.localeCompare(b.artist) ||
            a.title.localeCompare(b.title),
        )
        .map((item) => ({
          wantedReleaseId: item.wantKey,
          listingId: item.listingId,
          releaseId: item.releaseId,
          title: item.title,
          artist: item.artist,
          price: item.price,
          exact: item.exact,
          want: item.want,
        })),
      goods,
      postage,
      minOrderTotal: shop.minOrderTotal,
      belowMinimum: goods < shop.minOrderTotal,
    })
  }
  planned.sort(
    (a, b) => b.items.length - a.items.length || a.displayName.localeCompare(b.displayName),
  )
  const goods = planned.reduce((sum, shop) => sum + shop.goods, 0)
  const postage = planned.reduce((sum, shop) => sum + shop.postage, 0)
  return { shops: planned, goods, postage, total: goods + postage }
}

/**
 * The cheapest set of shops that covers every want, and the plan it beats.
 *
 * Twelve shops or fewer are enumerated outright — four thousand subsets of a
 * few additions each is nothing. Past that, start from "each where it is
 * cheapest" and drop shops while the plan gets cheaper: not optimal, and
 * somebody who scanned thirteen shops in six hours is not who this is for.
 */
export function optimise(
  offers: WantOffer[],
  shops: Map<string, PlanShopInput>,
): { best: PlannedShops | null; naive: PlannedShops | null } {
  const usable = offers.filter((offer) => shops.has(offer.dealer))
  const wants = new Set(usable.map((offer) => offer.wantKey))
  if (wants.size === 0) return { best: null, naive: null }

  // Each want from wherever it is cheapest: the set of those shops.
  const cheapest = new Map<number, WantOffer>()
  for (const offer of usable) {
    const held = cheapest.get(offer.wantKey)
    if (!held || offer.price < held.price) cheapest.set(offer.wantKey, offer)
  }
  const naiveSet = new Set([...cheapest.values()].map((offer) => offer.dealer))
  const naive = evaluate(naiveSet, usable, shops, wants)

  const dealers = [...new Set(usable.map((offer) => offer.dealer))]
  let best: PlannedShops | null = naive

  const better = (plan: PlannedShops | null, than: PlannedShops | null) =>
    plan !== null &&
    (than === null ||
      plan.total < than.total ||
      (plan.total === than.total && plan.shops.length < than.shops.length))

  if (dealers.length <= MAX_EXACT_SHOPS) {
    for (let mask = 1; mask < 1 << dealers.length; mask++) {
      const set = new Set(dealers.filter((_, index) => mask & (1 << index)))
      const plan = evaluate(set, usable, shops, wants)
      if (better(plan, best)) best = plan
    }
  } else {
    let current = new Set(naiveSet)
    let improved = true
    while (improved) {
      improved = false
      for (const dealer of [...current]) {
        const without = new Set(current)
        without.delete(dealer)
        const plan = evaluate(without, usable, shops, wants)
        if (better(plan, best)) {
          best = plan
          current = without
          improved = true
        }
      }
    }
  }

  return { best, naive }
}

/**
 * The offers a dig left behind for the wantlist.
 *
 * Exact first: a listing whose release is on the wantlist. Then another
 * pressing of a wanted album, through the master the signal carries — but
 * only for wants no shop has the exact pressing of, because a note like "only
 * the German press" is what the wantlist is for, and a cheap wrong pressing
 * must not win a plan by price.
 */
export function offersFrom(
  matches: Match[],
  digs: Dig[],
  wantlist: WantlistItem[],
): WantOffer[] {
  const dealerOf = new Map(digs.map((dig) => [dig.id, dig.dealer]))
  const wantedReleases = new Set(wantlist.map((item) => item.releaseId))
  const wantOf = new Map(wantlist.map((item) => [item.releaseId, item.want ?? 0]))
  const wantsByMaster = new Map<number, number[]>()
  for (const item of wantlist) {
    if (item.masterId > 0) {
      wantsByMaster.set(item.masterId, [
        ...(wantsByMaster.get(item.masterId) ?? []),
        item.releaseId,
      ])
    }
  }

  const exact: WantOffer[] = []
  const pressing: WantOffer[] = []
  for (const match of matches) {
    const dealer = dealerOf.get(match.digId)
    if (!dealer || match.expired || match.price === null || !match.currency) continue
    const base = {
      dealer,
      listingId: match.listingId,
      releaseId: match.releaseId,
      price: match.price,
      currency: match.currency,
      title: match.title ?? '',
      artist: match.artist ?? '',
    }
    if (wantedReleases.has(match.releaseId)) {
      exact.push({
        ...base,
        wantKey: match.releaseId,
        exact: true,
        want: wantOf.get(match.releaseId) ?? 0,
      })
      continue
    }
    for (const signal of match.signals) {
      if (signal.type !== 'WANTLIST_PRESSING') continue
      for (const wantKey of wantsByMaster.get(Number(signal.evidence.masterId ?? 0)) ?? []) {
        pressing.push({ ...base, wantKey, exact: false, want: wantOf.get(wantKey) ?? 0 })
      }
    }
  }

  const exactWants = new Set(exact.map((offer) => offer.wantKey))
  const all = [...exact, ...pressing.filter((offer) => !exactWants.has(offer.wantKey))]

  // One offer per want and shop: the cheapest listing there.
  const perShop = new Map<string, WantOffer>()
  for (const offer of all) {
    const key = `${offer.wantKey}|${offer.dealer}|${offer.currency}`
    const held = perShop.get(key)
    if (!held || offer.price < held.price) perShop.set(key, offer)
  }
  return [...perShop.values()]
}

export async function wantlistPlan(now: number, from: OriginFilter = 'any'): Promise<WantPlan> {
  const db = await openFidelityDb()
  const [wantlist, digs, matches, dealers, preferences] = await Promise.all([
    db.getAll('wantlist'),
    db.getAll('digs'),
    db.getAll('matches'),
    db.getAll('dealers'),
    getPreferences(),
  ])
  const dealerRows = new Map(dealers.map((row) => [row.username, row]))
  const home = preferences.shipsToCountry

  // Rule 4: only digs still inside their six hours carry prices anyone may see.
  // The newest per shop, so a shop scanned twice today is one shop.
  const fresh = new Map<string, Dig>()
  for (const dig of digs) {
    if (dig.expiresAt <= now || dig.matchCount === 0) continue
    const held = fresh.get(dig.dealer)
    if (!held || dig.startedAt > held.startedAt) fresh.set(dig.dealer, dig)
  }
  // "Only from Germany / the EU" (M20 #2): shops elsewhere, or with no origin
  // on record, drop out of the plan and are counted, not hidden.
  const allFresh = [...fresh.values()]
  const freshDigs = allFresh.filter((dig) =>
    passesOrigin(dealerRows.get(dig.dealer)?.shipsFrom, from, home),
  )
  const originLeftOut = allFresh.length - freshDigs.length
  const freshIds = new Set(freshDigs.map((dig) => dig.id))

  const offers = offersFrom(
    matches.filter((match) => freshIds.has(match.digId)),
    freshDigs,
    wantlist,
  )

  const empty: WantPlan = {
    wanted: wantlist.length,
    available: 0,
    currency: null,
    otherCurrencies: 0,
    unknownPostage: [],
    onlyWithoutPostage: 0,
    best: null,
    naive: null,
    expiresAt: null,
    shopsScanned: allFresh.length,
    home,
    originLeftOut,
  }
  if (offers.length === 0) return empty

  // One currency, the one most offers carry. Nothing here converts.
  const byCurrency = new Map<string, number>()
  for (const offer of offers)
    byCurrency.set(offer.currency, (byCurrency.get(offer.currency) ?? 0) + 1)
  const currency = [...byCurrency.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )[0]![0]
  const inCurrency = offers.filter((offer) => offer.currency === currency)

  const { resolveShipping } = await import('../basket/profiles')
  const { shipsToCountry } = preferences

  const shops = new Map<string, PlanShopInput>()
  const unknownPostage: string[] = []
  for (const dig of freshDigs) {
    if (!inCurrency.some((offer) => offer.dealer === dig.dealer)) continue
    const row = dealerRows.get(dig.dealer)
    const resolved = row ? await resolveShipping(row, shipsToCountry) : { tiers: [] }
    const tiers = resolved.tiers.filter((tier) => tier.currency === currency)
    const displayName = row?.displayName || dig.dealer
    if (tiers.length === 0) {
      unknownPostage.push(displayName)
      continue
    }
    shops.set(dig.dealer, {
      dealer: dig.dealer,
      displayName,
      digId: dig.id,
      tiers,
      minOrderTotal: row?.minOrderTotal ?? 0,
    })
  }

  const { best, naive } = optimise(inCurrency, shops)
  const plannable = new Set(inCurrency.filter((o) => shops.has(o.dealer)).map((o) => o.wantKey))
  const used = new Set(best?.shops.map((shop) => shop.dealer) ?? [])

  return {
    ...empty,
    available: new Set(offers.map((offer) => offer.wantKey)).size,
    currency,
    otherCurrencies: offers.length - inCurrency.length,
    unknownPostage: unknownPostage.sort((a, b) => a.localeCompare(b)),
    onlyWithoutPostage: new Set(inCurrency.map((o) => o.wantKey)).size - plannable.size,
    best,
    naive,
    expiresAt: freshDigs
      .filter((dig) => used.has(dig.dealer))
      .reduce<number | null>(
        (min, dig) => (min === null || dig.expiresAt < min ? dig.expiresAt : min),
        null,
      ),
  }
}
