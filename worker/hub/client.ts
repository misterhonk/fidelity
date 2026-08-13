import { z } from 'zod'

import { chunkIsSound, decodeChunk, encodeChunk, type WireChunk } from '#shared/wire'
import type { HorizonChunk, HorizonKind, PushRegistration, ShippingTier } from '#shared/types'

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
  /**
   * Gibt zurück, ob es ankam.
   *
   * Für den normalen Weg egal — der wirft das Ergebnis weg, weil ein Hub, der
   * einen Beitrag ablehnt, nichts ändert (Regel 8). Das Nachreichen in
   * `horizon/build.ts` braucht die Auskunft aber: es merkt sich, was geteilt
   * wurde, und darf einen abgelehnten Beitrag nicht als erledigt verbuchen.
   */
  contributeHorizon(chunk: HorizonChunk): Promise<boolean>
  shipping(dealer: string, country: string): Promise<ShippingTier[] | null>
  contributeShipping(dealer: string, country: string, tiers: ShippingTier[]): Promise<void>

  /**
   * Covers, in one bundle.
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
  /**
   * Einen Block loswerden — gebraucht beim Umzug einer Kennung.
   *
   * Still: es ist ein Zwischenspeicher, das Original liegt auf dem Gerät, und
   * ein Umzug soll nicht daran scheitern, dass das Aufräumen danach nicht
   * geklappt hat.
   */
  vaultForget(id: string): Promise<void>

  /**
   * The watcher — the one thing here that is not a cache.
   *
   * Everything else in this client makes the app faster. This makes it do
   * something it cannot do alone: notice that a shop got records while nobody
   * had the app open. A browser does not run when it is closed, so without a
   * hub the answer is the check at app start (worker/watch/service-local.ts),
   * and that stays true — rule 8 holds here as everywhere.
   */
  watchKey(): Promise<string | null>
  watchSubscribe(registration: PushRegistration, dealers: string[]): Promise<boolean>
  watchUnsubscribe(endpoint: string): Promise<void>
}

export interface HubCover {
  thumbUrl: string
  coverUrl: string
}

/**
 * Checked on the way back too, not only on the way in.
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

/*
 * The VAPID public key, as it must be before a browser will take it.
 *
 * base64url, 87 or 88 characters — a P-256 point in 65 bytes. Checked rather
 * than passed straight through because `pushManager.subscribe` throws on
 * anything else, and a hub that answers with an error page would otherwise
 * turn into an exception three call sites away from the thing that was wrong.
 */
const watchKeySchema = z.object({
  publicKey: z.string().regex(/^[A-Za-z0-9_-]{80,100}$/, 'not a base64url VAPID key'),
})

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
        log.warn('[hub] chunk contradicts itself, discarded', chunk.key)
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

    async vaultForget(id) {
      try {
        await fetchImpl(url(`/v1/vault/${id}`), { method: 'DELETE', headers })
      } catch {
        // Siehe oben: das Aufräumen ist der unwichtigste Teil des Umzugs.
      }
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
      const response = await fetchImpl(url(`/v1/horizon/${chunk.kind}/${chunk.entityId}`), {
        method: 'PUT',
        headers,
        body: JSON.stringify(encodeChunk(chunk)),
      })
      return response.ok
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

    async watchKey() {
      const response = await fetchImpl(url('/v1/watch/key'), { headers })
      if (!response.ok) return null

      const parsed = watchKeySchema.safeParse(await response.json())
      return parsed.success ? parsed.data.publicKey : null
    },

    async watchSubscribe(registration, dealers) {
      /*
       * The whole list, every time, because that is what the hub stores: it
       * replaces this endpoint's shops with what arrives. Sending a difference
       * would need the hub to remember what it already had, and two memories
       * of the same list eventually disagree.
       */
      const response = await fetchImpl(url('/v1/watch/subscribe'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ subscription: registration, dealers }),
      })
      return response.ok
    },

    async watchUnsubscribe(endpoint) {
      // No return value worth having. If it does not arrive, the hub keeps an
      // address that no longer answers — and drops it itself on the first 410
      // from the push service (hub/src/watch.ts).
      await fetchImpl(url('/v1/watch/unsubscribe'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ endpoint }),
      })
    },
  }
}
