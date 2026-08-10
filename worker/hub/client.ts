import { z } from 'zod'

import { chunkIsSound, decodeChunk, encodeChunk, type WireChunk } from '#shared/wire'
import type { HorizonChunk, HorizonKind, ShippingTier } from '#shared/types'

import { log } from '../log'

/**
 * Talking to a hub, if there is one.
 *
 * Everything here is written on the assumption that the hub is wrong: it is a
 * service somebody runs on a spare machine, it will be down, slow, an old
 * version, or someone else's entirely. So every answer crosses a Zod schema
 * and a soundness check before it is believed, exactly like a Discogs response
 * does (CLAUDE.md) — arguably more, because Discogs at least did not get
 * configured by hand this morning.
 *
 * Nothing here retries and nothing here throws upward: the caller wraps every
 * call in `preferHub`, which swallows failures and takes the local path. A
 * broken hub costs two seconds, once, and is never visible (rule 8).
 *
 * The token is not here and never will be. The hub has no route that takes one.
 */

const wireChunkSchema = z.object({
  version: z.number().int(),
  key: z.string(),
  kind: z.enum(['artist', 'label', 'master']),
  entityId: z.number().int(),
  name: z.string(),
  fetchedAt: z.number().int(),
  complete: z.boolean(),
  requests: z.number().int(),
  catalogueSize: z.number().int().optional(),
  catnoPrefix: z.string().optional(),
  releaseIds: z.string(),
  roles: z.string(),
  years: z.string(),
  catnoNums: z.string().optional(),
})

const tiersSchema = z.object({
  tiers: z.array(
    z.object({
      minItems: z.number().int().positive(),
      maxItems: z.number().int().positive().nullable(),
      price: z.number().nonnegative(),
      currency: z.string().length(3),
    }),
  ),
})

export interface HubClientOptions {
  /** Empty or absent means no hub, which is the normal case. */
  baseUrl: string | null
  secret?: string | null
  fetchImpl?: typeof fetch
}

export interface HubClient {
  horizon(kind: HorizonKind, id: number): Promise<HorizonChunk | null>
  contributeHorizon(chunk: HorizonChunk): Promise<void>
  shipping(dealer: string, country: string): Promise<ShippingTier[] | null>
  contributeShipping(dealer: string, country: string, tiers: ShippingTier[]): Promise<void>

  /**
   * Cover, gebündelt.
   *
   * The one thing in this app that costs a request per record and returns the
   * same answer for everybody: the marketplace hands back listings without
   * images (worker/covers.ts), so each cover is a `/releases/{id}`. Batched
   * because a screen wants a dozen at once and a dozen round trips would cost
   * more than the requests they save.
   *
   * Misses are simply absent from the map.
   */
  covers(releaseIds: number[]): Promise<Record<number, HubCover>>
  contributeCovers(covers: (HubCover & { releaseId: number })[]): Promise<void>

  /**
   * The vault: one block of ciphertext per person.
   *
   * Unlike everything else here it is not a cache and not shared — it is one
   * person's own devices finding each other. The hub stores it and cannot read
   * it, which is the condition ADR-008 attaches to it being there at all.
   */
  vaultRead(id: string): Promise<SealedVault | null>
  vaultWrite(id: string, sealed: SealedVault): Promise<void>
}

export interface HubCover {
  thumbUrl: string
  coverUrl: string
}

/**
 * Auch auf dem Rückweg geprüft, nicht nur beim Einliefern.
 *
 * These strings become `<img src>`. The hub already refuses anything that is
 * not Discogs' image host — and the hub is exactly the component this client is
 * written not to trust (see the file header). An old hub, a patched one, or
 * somebody else's entirely would otherwise be able to point every screen here
 * at a URL of their choosing.
 *
 * Parsed rather than pattern-matched: `https://i.discogs.com.evil.test/x` and
 * `https://evil.test/?a=https://i.discogs.com` both survive a naive `includes`.
 */
export function isDiscogsImage(url: string): boolean {
  if (url === '') return true
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && parsed.hostname === 'i.discogs.com'
  } catch {
    return false
  }
}

const coversSchema = z.object({
  covers: z.record(z.string(), z.object({ thumbUrl: z.string(), coverUrl: z.string() })),
})

/** The envelope, as it travels. The hub validates this shape and no more. */
export interface SealedVault {
  version: number
  iv: string
  salt: string
  cipher: string
}

const sealedSchema = z.object({
  version: z.number().int().positive(),
  iv: z.string().min(1),
  salt: z.string().min(1),
  cipher: z.string().min(1),
})

/** Returns null when no hub is configured — the caller then never asks. */
export function createHubClient({
  baseUrl,
  secret,
  fetchImpl = globalThis.fetch.bind(globalThis),
}: HubClientOptions): HubClient | null {
  const trimmed = baseUrl?.trim().replace(/\/+$/, '')
  if (!trimmed) return null

  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (secret) headers['x-hub-secret'] = secret

  const url = (path: string) => `${trimmed}${path}`

  return {
    async horizon(kind, id) {
      const response = await fetchImpl(url(`/v1/horizon/${kind}/${id}`), { headers })
      // 404 is the ordinary answer for anything nobody has expanded yet.
      if (!response.ok) return null

      const parsed = wireChunkSchema.safeParse(await response.json())
      if (!parsed.success) {
        log.warn('[hub] Antwort passt nicht zum Schema', kind, id)
        return null
      }

      const chunk = decodeChunk(parsed.data as WireChunk)

      /*
       * The parallel arrays have to be the same length or index *i* of `roles`
       * describes a different release than index *i* of `releaseIds`. A hub
       * that hands back a mismatched chunk would corrupt the horizon quietly
       * and forever, which is worse than any amount of slowness.
       */
      if (!chunkIsSound(chunk)) {
        log.warn('[hub] Chunk ist in sich widersprüchlich, verworfen', chunk.key)
        return null
      }

      return chunk
    },

    async covers(releaseIds) {
      if (releaseIds.length === 0) return {}

      const response = await fetchImpl(url(`/v1/covers?ids=${releaseIds.join(',')}`), {
        headers,
      })
      if (!response.ok) return {}

      const parsed = coversSchema.safeParse(await response.json())
      if (!parsed.success) {
        log.warn('[hub] Cover-Antwort passt nicht zum Schema')
        return {}
      }

      const covers: Record<number, HubCover> = {}
      for (const [key, value] of Object.entries(parsed.data.covers)) {
        const releaseId = Number(key)
        if (!Number.isSafeInteger(releaseId) || releaseId <= 0) continue
        if (!isDiscogsImage(value.thumbUrl) || !isDiscogsImage(value.coverUrl)) {
          log.warn('[hub] Cover-Adresse ist nicht von Discogs, verworfen', releaseId)
          continue
        }
        covers[releaseId] = value
      }
      return covers
    },

    async contributeCovers(covers) {
      if (covers.length === 0) return
      await fetchImpl(url('/v1/covers'), {
        method: 'PUT',
        headers,
        body: JSON.stringify({ covers }),
      })
    },

    async vaultRead(id) {
      const response = await fetchImpl(url(`/v1/vault/${id}`), { headers })
      // 404 is the first answer on a device that has never written one.
      if (!response.ok) return null

      const body = (await response.json()) as { sealed?: unknown }
      const parsed = sealedSchema.safeParse(body?.sealed)
      if (!parsed.success) {
        log.warn('[hub] Tresor-Antwort passt nicht zum Schema')
        return null
      }
      return parsed.data
    },

    async vaultWrite(id, sealed) {
      const response = await fetchImpl(url(`/v1/vault/${id}`), {
        method: 'PUT',
        headers,
        body: JSON.stringify(sealed),
      })
      // Unlike a contribution, this one is not fire-and-forget: somebody is
      // waiting to hear that their shortlist is safe on the other device.
      if (!response.ok) throw new Error(`Hub hat den Tresor abgelehnt (${response.status}).`)
    },

    async contributeHorizon(chunk) {
      await fetchImpl(url(`/v1/horizon/${chunk.kind}/${chunk.entityId}`), {
        method: 'PUT',
        headers,
        body: JSON.stringify(encodeChunk(chunk)),
      })
    },

    async shipping(dealer, country) {
      const response = await fetchImpl(
        url(`/v1/shipping/${encodeURIComponent(dealer)}/${encodeURIComponent(country)}`),
        { headers },
      )
      if (!response.ok) return null

      const parsed = tiersSchema.safeParse(await response.json())
      if (!parsed.success) return null

      // Labelled 'bundled', never 'user'. Whatever somebody else typed in is,
      // from here, a shared profile — and the basket says so out loud.
      return parsed.data.tiers.map((tier) => ({ ...tier, source: 'bundled' as const }))
    },

    async contributeShipping(dealer, country, tiers) {
      // Only hand-entered ladders are worth sharing. A parsed guess passed on
      // as a shared profile would launder a heuristic into a fact.
      const own = tiers.filter((tier) => tier.source === 'user')
      if (own.length === 0) return

      await fetchImpl(
        url(`/v1/shipping/${encodeURIComponent(dealer)}/${encodeURIComponent(country)}`),
        {
          method: 'PUT',
          headers,
          body: JSON.stringify(
            own.map(({ minItems, maxItems, price, currency }) => ({
              minItems,
              maxItems,
              price,
              currency,
            })),
          ),
        },
      )
    },
  }
}
