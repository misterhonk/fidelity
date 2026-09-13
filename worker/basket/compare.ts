import { rankOf } from '#shared/format'
import { shippingFor } from '#shared/shipping'
import { openFidelityDb } from '~~/db/open'
import { getPreferences } from '~~/db/meta'
import type { BasketItem, Dealer, StockRow } from '#shared/types'

import { resolveShipping } from './profiles'

/**
 * The same basket, at the other shops.
 *
 * Asked for by a tester: five records clicked together at one shop for €100 —
 * is there a shop that has the same five for €80? What if another has four of
 * them, but far cheaper? What if another has them in better condition?
 *
 * **The constraint that shapes all of it:** there is no legal way to ask
 * Discogs who else sells release X. `/marketplace/search` is undocumented
 * (rule 5) and the sell pages are not ours to read. The only direction left is
 * the inverse — look inside the inventories of the shops you already know —
 * and that is the direction Fidelity already walks: a dig writes **every**
 * listing it reads into `stock`, not only the matches. So this whole
 * comparison is a join over data that is already on the device, and it costs
 * not one request.
 *
 * **Six hours, and that is the same rule rather than a workaround.** Stock
 * rows go with their dig when it expires (rule 4, `db/expire.ts`), so the
 * shops that can be compared are exactly the shops whose prices may be shown.
 * A screen that said "nowhere cheaper" on the strength of a dig from Tuesday
 * would be quoting a price it is not allowed to quote.
 *
 * And the sentence the interface has to carry: this compares **the shops you
 * know**, never "the market". An empty answer means "not cheaper at your four
 * shops", and reading it as "not cheaper anywhere" is the same mistake as an
 * acquittal without a horizon.
 */

export interface CompareLine {
  releaseId: number
  listingId: number
  title: string | null
  artist: string | null
  price: number
  currency: string
  condition: string | null
  /** Against the copy in the basket: -1 better, 0 the same, 1 worse, null unknown. */
  grade: -1 | 0 | 1 | null
}

export interface CompareOffer {
  dealer: string
  displayName: string
  avatarUrl?: string
  lines: CompareLine[]
  /** How many of the basket's records this shop has. */
  covered: number
  subtotal: number
  /** The money these numbers are in. Never converted — see `priceAt`. */
  currency: string
  /** Null where the shop has no postage table — then no total may be claimed. */
  shipping: number | null
  total: number | null
  /**
   * What the records this shop does *not* have still cost where they are, with
   * their own postage.
   *
   * The whole point of the partial case. Four of five at another shop is only
   * a saving once the fifth has been paid for a second time — a second parcel,
   * a second postage tier — and a comparison that left that out would
   * recommend a split that costs more.
   */
  rest: {
    items: number
    subtotal: number
    shipping: number | null
    total: number | null
  } | null
  /** The basket however it ends up split, or null where a postage table is missing. */
  combined: number | null
  /** Combined against the baseline. Negative is cheaper. */
  delta: number | null
  better: number
  worse: number
  /** When the dig that saw this stock ran. Six hours old at most, by rule. */
  seenAt: number
}

export interface CompareCandidate {
  dealer: string
  displayName: string
  avatarUrl?: string
  /** How much of this basket's labels the shop is known to stock, 0–1. */
  overlap: number
  lastScannedAt: number | null
}

export interface CompareResult {
  dealer: string
  /** What the basket costs where it stands. Null when a price has aged out. */
  baseline: {
    items: number
    subtotal: number
    shipping: number | null
    total: number | null
    currency: string | null
  }
  offers: CompareOffer[]
  /** Shops with fresh stock that were looked through — the honest denominator. */
  looked: number
  /** Shops known but with nothing fresh to compare, best fit first. */
  candidates: CompareCandidate[]
}

/** How many shops to suggest looking at. More than a handful is a list, not advice. */
const MAX_CANDIDATES = 5

export async function compareBasket(dealer: string, now = Date.now()): Promise<CompareResult> {
  const db = await openFidelityDb()
  const preferences = await getPreferences()
  const country = preferences.shipsToCountry

  const items = (await db.getAll('basket')).filter(
    (item) => item.dealer === dealer && !item.soldAt,
  )
  const here = await db.get('dealers', dealer)

  const baseline = await priceAt(
    here ?? null,
    items.map((item) => item.price),
    items[0]?.currency ?? null,
    country,
  )

  const empty: CompareResult = {
    dealer,
    baseline: { items: items.length, currency: items[0]?.currency ?? null, ...baseline },
    offers: [],
    looked: 0,
    candidates: [],
  }
  if (items.length === 0) return empty

  /*
   * Which digs are still allowed to speak. Their own shop is left out — a
   * basket compared against the shop it came from would find itself.
   */
  const fresh = new Map<string, { dealer: string; at: number }>()
  for (const dig of await db.getAll('digs')) {
    if (dig.status === 'expired' || dig.expiresAt <= now || dig.dealer === dealer) continue
    const existing = fresh.get(dig.id)
    if (!existing) fresh.set(dig.id, { dealer: dig.dealer, at: dig.startedAt })
  }

  /*
   * One range read per record, rather than a walk over every row of every dig.
   * Five reads against a hundred thousand rows is the difference the `by-release`
   * index exists for.
   */
  const byDealer = new Map<string, CompareLine[]>()
  const seenAt = new Map<string, number>()

  for (const item of items) {
    const rows = await db
      .transaction('stock')
      .store.index('by-release')
      .getAll(IDBKeyRange.only(item.releaseId))

    /*
     * The cheapest copy per shop, not every copy.
     *
     * A shop with three pressings of the same record would otherwise appear to
     * have three of your five. The comparison is about the basket, and a
     * basket holds one of each.
     */
    const best = new Map<string, StockRow>()
    for (const row of rows) {
      const dig = fresh.get(row.digId)
      if (!dig || row.price === null || row.currency !== item.currency) continue

      const held = best.get(dig.dealer)
      if (!held || (held.price ?? Infinity) > row.price) best.set(dig.dealer, row)
      seenAt.set(dig.dealer, Math.max(seenAt.get(dig.dealer) ?? 0, dig.at))
    }

    const mine = rows.find((row) => row.listingId === item.listingId)

    for (const [shop, row] of best) {
      const lines = byDealer.get(shop) ?? []
      lines.push({
        releaseId: item.releaseId,
        listingId: row.listingId,
        title: row.title ?? item.title,
        artist: row.artist,
        price: row.price!,
        currency: row.currency!,
        condition: row.condition,
        grade: compareGrades(mine?.condition ?? null, row.condition),
      })
      byDealer.set(shop, lines)
    }
  }

  const offers: CompareOffer[] = []
  for (const [shop, lines] of byDealer) {
    const row = await db.get('dealers', shop)
    const subtotal = lines.reduce((sum, line) => sum + line.price, 0)
    const shipping = (
      await priceAt(
        row ?? null,
        lines.map((l) => l.price),
        lines[0]!.currency,
        country,
      )
    ).shipping

    /*
     * The records this shop has not got, still where they are — with their own
     * postage, because they travel in a second parcel.
     */
    const missing = items.filter(
      (item) => !lines.some((line) => line.releaseId === item.releaseId),
    )
    const rest =
      missing.length === 0
        ? null
        : {
            items: missing.length,
            ...(await priceAt(
              here ?? null,
              missing.map((item) => item.price),
              missing[0]?.currency ?? null,
              country,
            )),
          }

    const total = shipping === null ? null : subtotal + shipping
    const combined =
      total === null
        ? null
        : rest === null
          ? total
          : rest.total === null
            ? null
            : total + rest.total

    offers.push({
      dealer: shop,
      displayName: row?.displayName || shop,
      avatarUrl: row?.avatarUrl,
      lines,
      covered: lines.length,
      subtotal,
      currency: lines[0]!.currency,
      shipping,
      total,
      rest,
      combined,
      delta: combined === null || baseline.total === null ? null : combined - baseline.total,
      better: lines.filter((line) => line.grade === -1).length,
      worse: lines.filter((line) => line.grade === 1).length,
      seenAt: seenAt.get(shop) ?? now,
    })
  }

  /*
   * Cheapest first, and a shop whose total cannot be worked out last rather
   * than nowhere: "has four of them, postage unknown" is still worth seeing.
   */
  offers.sort(
    (a, b) =>
      (a.delta ?? Infinity) - (b.delta ?? Infinity) ||
      b.covered - a.covered ||
      a.subtotal - b.subtotal,
  )

  return {
    dealer,
    baseline: { items: items.length, currency: items[0]?.currency ?? null, ...baseline },
    offers,
    looked: new Set([...fresh.values()].map((dig) => dig.dealer)).size,
    candidates: await candidatesFor(items, new Set([dealer, ...byDealer.keys()])),
  }
}

/** What a set of prices costs at one shop, postage included where it is known. */
async function priceAt(
  dealer: Dealer | null,
  prices: number[],
  currency: string | null,
  country: string,
): Promise<{ subtotal: number; shipping: number | null; total: number | null }> {
  const subtotal = prices.reduce((sum, price) => sum + price, 0)
  if (prices.length === 0 || !currency || !dealer) {
    return { subtotal, shipping: null, total: null }
  }

  const resolved = await resolveShipping(dealer, country)
  const tier = shippingFor(resolved.tiers, prices.length)
  // Currencies are compared, never converted — the same rule the basket and
  // S10 follow, and for the same reason.
  const shipping = tier && (!tier.currency || tier.currency === currency) ? tier.price : null

  return { subtotal, shipping, total: shipping === null ? null : subtotal + shipping }
}

/** -1 the other copy is better, 0 the same, 1 worse, null when one is ungraded. */
function compareGrades(mine: string | null, theirs: string | null): -1 | 0 | 1 | null {
  const a = rankOf(mine)
  const b = rankOf(theirs)
  if (a === null || b === null) return null
  return b < a ? -1 : b > a ? 1 : 0
}

/**
 * Where to look next, when the fresh shops turned nothing up.
 *
 * Not a list of shops — a list of shops whose stock looks like this basket.
 * Every dig leaves a fingerprint behind (`DealerFingerprint`), and the labels
 * in it are derived rather than marketplace content, so they outlive the
 * six-hour window and can still rank a shop whose prices are long gone.
 *
 * It ranks; it does not fetch. Digging one of these is a couple of minutes of
 * somebody's rate limit and stays their decision.
 */
async function candidatesFor(
  items: BasketItem[],
  exclude: Set<string>,
): Promise<CompareCandidate[]> {
  const db = await openFidelityDb()

  /*
   * The basket's labels, via the stock rows of the shop it came from. A label
   * is the sharpest cheap signal there is for "this shop sells this sort of
   * thing" — sharper than style, which half of Discogs leaves blank.
   */
  const wanted = new Set<string>()
  for (const item of items) {
    const rows = await db
      .transaction('stock')
      .store.index('by-release')
      .getAll(IDBKeyRange.only(item.releaseId))
    for (const row of rows) if (row.label) wanted.add(row.label)
  }
  if (wanted.size === 0) return []

  const candidates: CompareCandidate[] = []
  for (const dealer of await db.getAll('dealers')) {
    if (exclude.has(dealer.username) || dealer.hiddenAt) continue
    const labels = dealer.fingerprint?.labelDist
    if (!labels) continue

    let hits = 0
    for (const label of wanted) if (labels[label]) hits += 1
    if (hits === 0) continue

    candidates.push({
      dealer: dealer.username,
      displayName: dealer.displayName || dealer.username,
      avatarUrl: dealer.avatarUrl,
      overlap: hits / wanted.size,
      lastScannedAt: dealer.lastScannedAt,
    })
  }

  return candidates.sort((a, b) => b.overlap - a.overlap).slice(0, MAX_CANDIDATES)
}
