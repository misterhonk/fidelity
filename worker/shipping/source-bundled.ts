import { z } from 'zod'

import type { ShippingProfileSource } from '#shared/ports'
import type { ShippingTier } from '#shared/types'

/** External data, so it crosses a schema at the boundary (CLAUDE.md). */
const tierSchema = z.object({
  minItems: z.number().int().positive(),
  maxItems: z.number().int().positive().nullable(),
  price: z.number().nonnegative(),
  currency: z.string().length(3),
})

const fileSchema = z.object({
  version: z.literal(1),
  profiles: z.record(z.string(), z.array(tierSchema)),
})

/** `<discogs-username>|<country>` */
export function profileKey(dealer: string, toCountry: string): string {
  return `${dealer.toLowerCase()}|${toCountry.toLowerCase()}`
}

export interface BundledShippingOptions {
  url?: string
  fetchImpl?: typeof fetch
}

/**
 * Shipping ladders shipped with the app as a static file.
 *
 * Without a server there is nothing to crowdsource into, so the ladders are
 * maintained in the repository by pull request. For a circle of friends that
 * is enough, and it costs nothing to run. A hub (M9) can add real
 * crowdsourcing on top without any caller noticing.
 *
 * The file is fetched, not imported: it must not sit in the JS bundle, and it
 * has to be replaceable on the host without a rebuild.
 */
export function createBundledShippingSource({
  url = '/shipping-profiles.json',
  fetchImpl = globalThis.fetch,
}: BundledShippingOptions = {}): ShippingProfileSource {
  let profiles: Promise<Record<string, ShippingTier[]>> | undefined

  async function load(): Promise<Record<string, ShippingTier[]>> {
    const response = await fetchImpl(url)
    if (!response.ok) throw new Error(`shipping profiles: HTTP ${response.status}`)

    const parsed = fileSchema.parse(await response.json())
    return Object.fromEntries(
      Object.entries(parsed.profiles).map(([key, tiers]) => [
        key.toLowerCase(),
        tiers.map((tier) => ({ ...tier, source: 'bundled' as const })),
      ]),
    )
  }

  return {
    async get(dealer, toCountry) {
      profiles ??= load()
      try {
        return (await profiles)[profileKey(dealer, toCountry)] ?? null
      } catch {
        // A missing or malformed file means "no ladder known", not a failure:
        // the UI already handles that case by asking the user to enter one.
        profiles = undefined
        return null
      }
    },
  }
}
