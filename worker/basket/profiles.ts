import { z } from 'zod'

import { openFidelityDb } from '~~/db/open'
import type { Dealer, ShippingTier } from '#shared/types'

import { parseShippingText } from './parse-shipping'
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
  /** What the parser thought it recognised, when that is where this came from. */
  matched: string[]
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
  // 1. What somebody typed in. Stored on the dealer, so it survives a rescan.
  const user = dealer.shippingTiers.filter((tier) => tier.source === 'user')
  if (user.length > 0) return { tiers: sortTiers(user), source: 'user', matched: [] }

  // 2. What the repository knows.
  const file = await loadBundled()
  const entry = file?.profiles[`${dealer.username}|${country}`]
  if (entry && entry.length > 0) {
    return {
      tiers: sortTiers(entry.map((tier) => ({ ...tier, source: 'bundled' as const }))),
      source: 'bundled',
      matched: [],
    }
  }

  // 3. What the dealer's own free text can be made to say. Always labelled.
  const parsed = parseShippingText(dealer.shippingNote)
  if (parsed.tiers.length > 0) {
    return { tiers: parsed.tiers, source: 'parsed', matched: parsed.matched }
  }

  // 4. Nothing. "Versand unbekannt – trag ihn ein und ich rechne" (docs/00 §7).
  return { tiers: [], source: null, matched: [] }
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
export async function saveUserShipping(
  username: string,
  tiers: Omit<ShippingTier, 'source'>[],
): Promise<Dealer> {
  const db = await openFidelityDb()
  const existing = await db.get('dealers', username)

  const updated: Dealer = {
    ...(existing ?? blankDealer(username)),
    shippingTiers: sortTiers(tiers.map((tier) => ({ ...tier, source: 'user' as const }))),
  }
  await db.put('dealers', updated)
  return updated
}

/** Everything a scan would fill in, left empty until one runs. */
function blankDealer(username: string): Dealer {
  return {
    username,
    displayName: username,
    shipsFrom: '',
    sellerRating: 0,
    ratingCount: 0,
    numForSale: 0,
    minOrderTotal: 0,
    shippingNote: '',
    lastScannedAt: null,
    affinity: null,
    fingerprint: null,
    shippingTiers: [],
  }
}
