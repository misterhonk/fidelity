import { z } from 'zod'

import { getPreferences } from '~~/db/meta'
import { blankDealer } from '~~/db/dealer'
import { openFidelityDb } from '~~/db/open'
import type { Dealer, ShippingTier } from '#shared/types'

import { createHubClient } from '../hub/client'
import { withTimeout, HUB_TIMEOUT_MS } from '../hub/fallback'
import { billsByWeight, parseShippingText } from './parse-shipping'
import { sortTiers } from './shipping'

/**
 * Where a dealer's shipping table comes from.
 *
 * Three sources, and the order between them is the whole design: what a person
 * typed in beats what the repository knows beats what a regular expression
 * guessed. A hand-entered table is somebody having read the dealer's page; a
 * parsed one is a machine having had a go.
 *
 * The bundled file is fetched from our own origin, not from Discogs — it costs
 * nothing from the rate limit and works offline once the service worker has it.
 */

export const shippingProfilesSchema = z.object({
  version: z.number().int(),
  note: z.string().optional(),
  profiles: z.record(
    z.string(),
    z.array(
      z.object({
        minItems: z.number().int().min(1),
        maxItems: z.number().int().min(1).nullable(),
        price: z.number().min(0),
        currency: z.string().min(3).max(3),
      }),
    ),
  ),
})

export const PROFILES_URL = '/shipping-profiles.json'

let bundled: Promise<z.infer<typeof shippingProfilesSchema> | null> | undefined

/**
 * Loaded once per worker. A missing or malformed file is not an error worth
 * stopping for — it only means there are no bundled profiles, which is the
 * state the file ships in anyway.
 */
async function loadBundled(): Promise<z.infer<typeof shippingProfilesSchema> | null> {
  bundled ??= fetch(PROFILES_URL)
    .then((response) => (response.ok ? response.json() : null))
    .then((body) => (body === null ? null : shippingProfilesSchema.parse(body)))
    .catch(() => null)
  return bundled
}

/** Drops the cache, so a test or a service-worker update can reload it. */
export function forgetBundled(): void {
  bundled = undefined
}

export interface ShippingResolution {
  tiers: ShippingTier[]
  source: ShippingTier['source'] | null
  /**
   * "Free delivery above £75": off a pasted cart page, or read out of the
   * shop's text for this destination (M34.3).
   */
  freeOver?: { amount: number; currency: string } | null
  /** What the parser thought it recognised, when that is where this came from. */
  matched: string[]
  /**
   * The destination heading the rates were read under — `Germany`, `Europe`.
   * Only set when the text was sorted by destination and one block was picked.
   */
  section?: string | null
  /**
   * The shop bills by grams, so no table per record can be read out of it.
   *
   * Set whichever way the tiers were found, and `true` alongside tiers of its
   * own: somebody who typed a table for a shop that bills by weight typed
   * exactly what the arithmetic needs, and the screen should still be able to
   * say where the numbers came from.
   */
  byWeight?: boolean
  /**
   * The shop's own postage text, verbatim.
   *
   * Carried through so the screen can put it beside the form. Where the parser
   * gives up — and a weight table is where it always will — the gap between
   * "Fidelity cannot read this" and a working table is somebody reading four
   * lines and typing three numbers. They had to go to Discogs and find the
   * dialog to do it; the text was already on the device.
   */
  note?: string | null
}

/**
 * The tiers to use for a dealer, and where they came from.
 *
 * `country` keys the bundled file because postage is a function of where it is
 * going: '<username>|<country>' (see `public/shipping-profiles.json`).
 */
export async function resolveShipping(
  dealer: Dealer,
  country: string,
): Promise<ShippingResolution> {
  /*
   * Read once, up front, and attached to every answer below: the shop's own
   * words and whether they are a weight table are facts about the shop, not
   * about which of the five routes produced the numbers.
   */
  const note = dealer.shippingNote?.trim() ? dealer.shippingNote : null
  const byWeight = billsByWeight(note)
  // The threshold off a pasted cart page outranks one read out of the text.
  const about = { matched: [] as string[], byWeight, note, freeOver: dealer.freeOver ?? null }

  // 1. What somebody typed in. Stored on the dealer, so it survives a rescan.
  const user = dealer.shippingTiers.filter((tier) => tier.source === 'user')
  if (user.length > 0) return { ...about, tiers: sortTiers(user), source: 'user' }

  // 2. What a hub knows, when one is configured (M9). Ranked here — above
  // the repository file and below a hand-entered table — because it is
  // somebody's hand-entered table, just not yours. A hub that is slow or off
  // costs two seconds once and then stops existing for this call.
  const preferences = await getPreferences()
  const hub = createHubClient({
    baseUrl: preferences.hubUrl,
    secret: preferences.hubSecret,
    accessKey: preferences.accessKey,
  })

  if (hub) {
    try {
      const shared = await withTimeout(hub.shipping(dealer.username, country), HUB_TIMEOUT_MS)
      if (shared && shared.length > 0) {
        return { ...about, tiers: sortTiers(shared), source: 'bundled' }
      }
    } catch {
      // Deliberately silent (rule 8). The file below is not a degraded mode.
    }
  }

  // 3. What the repository knows.
  const file = await loadBundled()
  const entry = file?.profiles[`${dealer.username}|${country}`]
  if (entry && entry.length > 0) {
    return {
      ...about,
      tiers: sortTiers(entry.map((tier) => ({ ...tier, source: 'bundled' as const }))),
      source: 'bundled',
    }
  }

  // 4. What the dealer's own free text can be made to say. Always labelled.
  const parsed = parseShippingText(dealer.shippingNote, country)
  if (parsed.tiers.length > 0) {
    return {
      ...about,
      tiers: parsed.tiers,
      source: 'parsed',
      matched: parsed.matched,
      section: parsed.section,
      freeOver: dealer.freeOver ?? parsed.freeOver,
    }
  }

  // 5. Nothing. "Versand unbekannt – trag ihn ein und ich rechne" (docs/00 §7).
  return { ...about, tiers: [], source: null }
}

/**
 * Stores a hand-entered table against the dealer.
 *
 * Replaces any earlier user table rather than merging: a half-updated postage
 * table is worse than either version of it.
 *
 * Creates the dealer row when there is none. There need not be one — a basket
 * can outlive the dig it came from, and a dig from before the fingerprint
 * existed never wrote a dealer at all. Refusing here would have been a save
 * button that silently does nothing, which is the worst of the options.
 */
/**
 * "Discogs shows for 3 records: €9.80" (M34.3): one figure read off the
 * Discogs cart, kept as a user tier for exactly that count. Merged into what
 * the user typed before, never over it: a tier for two records and a tier
 * for three are two facts, and a table can hold both.
 */
export async function readOffShipping(
  username: string,
  items: number,
  price: number,
  currency: string,
  /**
   * The last count the figure is known to hold for. The cart page says "add
   * up to 42 more at no additional shipping cost", and that is a tier from
   * here to there, not a point (M34.3).
   */
  upTo: number = items,
): Promise<Dealer> {
  const db = await openFidelityDb()
  const existing = await db.get('dealers', username)
  const last = Math.max(items, upTo)

  /*
   * The figure is the truth for exactly these counts. A tier the user typed
   * that overlaps is cut around it: "2 to 5 records: €9" with a read-off
   * for three becomes "2: €9", "3: the figure", "4 to 5: €9". Nothing the
   * user typed for other counts is touched.
   */
  const own: Omit<ShippingTier, 'source'>[] = []
  for (const tier of existing?.shippingTiers ?? []) {
    if (tier.source !== 'user') continue
    const { minItems, maxItems, price: p, currency: c } = tier
    const overlaps = minItems <= last && (maxItems === null || maxItems >= items)
    if (!overlaps) {
      own.push({ minItems, maxItems, price: p, currency: c })
      continue
    }
    if (minItems < items) own.push({ minItems, maxItems: items - 1, price: p, currency: c })
    if (maxItems === null || maxItems > last)
      own.push({ minItems: last + 1, maxItems, price: p, currency: c })
  }

  return saveUserShipping(username, [
    ...own,
    { minItems: items, maxItems: last, price, currency },
  ])
}

export async function saveUserShipping(
  username: string,
  tiers: Omit<ShippingTier, 'source'>[],
): Promise<Dealer> {
  const db = await openFidelityDb()
  const existing = await db.get('dealers', username)

  const updated: Dealer = {
    ...(existing ?? blankDealer(username)),
    shippingTiers: sortTiers(tiers.map((tier) => ({ ...tier, source: 'user' as const }))),
    updatedAt: Date.now(),
  }
  await db.put('dealers', updated)

  // Offered to the hub, never awaited: one person types a ladder in and
  // everybody who shares that hub has it. A refusal changes nothing here.
  const preferences = await getPreferences()
  const hub = createHubClient({
    baseUrl: preferences.hubUrl,
    secret: preferences.hubSecret,
    accessKey: preferences.accessKey,
  })
  if (hub) {
    void hub
      .contributeShipping(username, preferences.shipsToCountry, updated.shippingTiers)
      .catch(() => {})
  }

  return updated
}
