import { getPreferences } from '~~/db/meta'
import { openFidelityDb } from '~~/db/open'
import type { BasketCandidate, BasketDig, BasketView } from '#shared/types'

import { discogs } from '../auth'
import { fail } from '../fail'
import type { HandlerMap } from '../handlers'

/**
 * The basket's handlers, out of the worker's entry chunk (#299).
 *
 * The basket is a screen somebody opens after a dig, never before the first
 * answer, so worker/handlers.ts loads this module the first time a
 * `basket.*` message arrives. Requests still go through the one client from
 * `discogs()` (rule 3).
 */
export const handlers = {
  'basket.paste': async ({ input }, { report, signal }) => {
    const { addPastedListings, parseListingIds } = await import('./listings')
    const { parseCartText } = await import('./parse-cart')
    const { noteCart } = await import('./cart')
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

  'basket.add': async ({ digId, listingId }) => {
    const { addToBasket } = await import('./index')
    const db = await openFidelityDb()
    const match = await db.get('matches', [digId, listingId])
    const dig = await db.get('digs', digId)
    if (!match || !dig) throw fail('match-gone', 'no such match')

    await addToBasket(match, dig.dealer, Date.now(), dig.expiresAt)
    return basketView()
  },

  'basket.remove': async ({ listingId }) => {
    const { removeFromBasket } = await import('./index')
    await removeFromBasket(listingId)
    return basketView()
  },

  'basket.restore': async ({ listingId }) => {
    const { restoreToBasket } = await import('./index')
    await restoreToBasket(listingId)
    return basketView()
  },

  'basket.handedOver': async ({ listingId, at }) => {
    const { markHandedOver } = await import('./index')
    await markHandedOver(listingId, at)
    return basketView()
  },

  'basket.clear': async () => {
    const { clearBasket } = await import('./index')
    await clearBasket()
    return basketView()
  },

  'basket.get': () => basketView(),

  'basket.fromMarked': async ({ listingIds }, { report, signal }) => {
    const { basketFromMarked } = await import('../dig/refresh')
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

  'basket.refresh': async (_params, { report, signal }) => {
    const { refreshBasket } = await import('../dig/refresh')
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
    const { saveUserShipping } = await import('./profiles')
    await saveUserShipping(dealer, tiers)
    return basketView()
  },

  'basket.readOff': async ({ dealer, items, price, currency }) => {
    const { readOffShipping } = await import('./profiles')
    await readOffShipping(dealer, items, price, currency)
    return basketView()
  },

  'basket.plan': async ({ dealer, budget }) => {
    const view = await basketView()
    const summary = view.baskets.find((basket) => basket.dealer === dealer)
    if (!summary) return null

    const { planBasket } = await import('./optimise')
    const { resolveShipping } = await import('./profiles')
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
    /*
     * In the currency the budget is typed in, and off the records table (found
     * 2026-10-31): a dig's pounds summed with a table's euros came out labelled
     * as euros, and LPs were priced at the singles rate. The minimum is the
     * card's, already in that currency.
     */
    const { tiersForUnit } = await import('#shared/shipping')
    const currency = summary.currency
    return planBasket(
      candidates.filter((item) => item.currency === currency),
      tiersForUnit(shipping.tiers, 'record').filter(
        (tier) => !tier.currency || tier.currency === currency,
      ),
      budget,
      summary.minOrderTotal,
    )
  },

  'basket.landed': async ({ dealer }) => {
    const { resolveShipping } = await import('./profiles')
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
    const { tiersForUnit } = await import('#shared/shipping')
    return {
      dealer,
      // The find list prices records; a singles or CD table is not its business.
      tiers: tiersForUnit(shipping.tiers, 'record'),
      source: shipping.source,
      section: shipping.section ?? null,
      inBasket: lines.length,
      listingIds: lines.map((item) => item.listingId),
      currency: shipping.tiers[0]?.currency ?? null,
    }
  },
} satisfies Pick<HandlerMap, `basket.${string}` & keyof HandlerMap>

/**
 * Everything the basket screen needs, in one message.
 *
 * Assembled here rather than in three calls because every mutation changes all
 * of it: adding a record moves the total, the postage tier, the advice and
 * which candidates are still worth suggesting.
 */
async function basketView(): Promise<BasketView> {
  const [{ basketListingIds, basketSummaries }, { suggestCandidates }] = await Promise.all([
    import('./index'),
    import('./optimise'),
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
  const { toCandidate } = await import('./optimise')
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
