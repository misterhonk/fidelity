import { z } from 'zod'

import { discogsImageOrNone, isDiscogsImage } from '#shared/images'

import { chunkIsSound, decodeChunk, encodeChunk, type WireChunk } from '#shared/wire'
import type {
  HorizonChunk,
  HorizonKind,
  PressingFamilyFacts,
  PushRegistration,
  HubShop,
  ShippingTier,
} from '#shared/types'

import { log } from '../log'
import { fail } from '../fail'

/**
 * What the hub sends back for shops (ADR-014).
 *
 * Validated rather than trusted, like every other answer here: a hub is
 * somebody's own machine, and a shop row that arrived malformed would be
 * ranked against a collection and drawn on a screen.
 */
/*
 * The same bounds the hub enforces (hub/src/app.ts), enforced again here: a
 * hub is somebody else's machine, and what it answers is drawn on this
 * screen. A username is a Discogs username, a picture is a Discogs picture
 * or nothing, a distribution has at most sixty entries, an answer at most
 * two hundred shops.
 */
const distributionSchema = z
  .record(z.string().max(120), z.number())
  .refine((value) => Object.keys(value).length <= 60, 'too many entries')

const DEALER_NAME = /^[A-Za-z0-9._-]{1,120}$/

const shopsAnswerSchema = z.object({
  shops: z
    .array(
      z.object({
        username: z.string().regex(DEALER_NAME),
        displayName: z.string().max(120),
        shipsFrom: z.string().max(120),
        numForSale: z.number().int().min(0).max(10_000_000),
        avatarUrl: z.string().max(2048).optional().transform(discogsImageOrNone),
        seenAt: z.number().int().min(0),
        fingerprint: z.object({
          sampledItems: z.number().int().min(0),
          totalItems: z.number().int().min(0),
          coverage: z.number().min(0).max(1),
          labelDist: distributionSchema,
          styleDist: distributionSchema,
          decadeDist: distributionSchema,
        }),
      }),
    )
    .max(200),
})

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

export const wireChunkSchema = z.object({
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
  kin: z
    .array(z.object({ name: z.string(), relation: z.enum(['alias', 'member', 'group']) }))
    .optional(),
})

/** Same shape as the hub's `familySchema`; the client trusts nothing it did not check. */
const familySchema = z.object({
  masterId: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  fetchedAt: z.number().int().nonnegative(),
  siblings: z
    .array(
      z.object({
        releaseId: z.number().int().positive(),
        year: z.number().int().nullable(),
        country: z.string(),
        label: z.string(),
        catno: z.string(),
        format: z.string(),
      }),
    )
    .max(200),
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
  /** The access key (docs/17 §6.2), sent as `x-fidelity-key` when set. */
  accessKey?: string | null
  fetchImpl?: typeof fetch
}

export interface HubClient {
  horizon(kind: HorizonKind, id: number): Promise<HorizonChunk | null>
  /**
   * Returns whether it arrived.
   *
   * Irrelevant on the ordinary path — that throws the result away, because a
   * hub rejecting a contribution changes nothing (rule 8). The catch-up in
   * `horizon/build.ts` does need to know, though: it remembers what has been
   * shared, and must not book a rejected contribution as done.
   */
  contributeHorizon(chunk: HorizonChunk): Promise<boolean>
  shipping(dealer: string, country: string): Promise<ShippingTier[] | null>
  contributeShipping(dealer: string, country: string, tiers: ShippingTier[]): Promise<void>

  /**
   * Shops, and what they stock (ADR-014).
   *
   * The one part of the hub that is about a shop rather than a record. What
   * comes back is a name, where it ships from and a distribution of labels,
   * styles and decades — never a price, and never how well a shop suits
   * somebody, because that is a statement about them and is computed on the
   * device against a collection the hub never sees.
   *
   * An empty list is the ordinary answer on a hub nobody else uses.
   */
  shops(): Promise<HubShop[]>
  contributeShop(shop: HubShop): Promise<boolean>

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
   * A pressing family, by master (M20 #7) — the catalogue hub of docs/14 in
   * miniature. CC0 facts, thirty days; a miss is null and the client asks
   * Discogs itself, then offers the answer back.
   */
  family(masterId: number): Promise<PressingFamilyFacts | null>
  contributeFamily(family: PressingFamilyFacts): Promise<void>

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
   * Getting rid of a block — needed when an id moves.
   *
   * Silent: it is a cache, the original is on the device, and a move should
   * not fail because the tidying up afterwards did not work.
   */
  vaultForget(id: string): Promise<void>

  /**
   * Share a find list — in such a way that the hub cannot read it.
   *
   * A sealed envelope like the vault's, only with a random key instead of a
   * passphrase; the key sits in the `#` fragment of the link and reaches no
   * server.
   *
   * `shareRead` is the **only** method here that has to manage without the hub
   * secret: the link goes to somebody who does not know this hub. So it
   * deliberately does not send the headers.
   */
  shareWrite(id: string, sealed: SealedVault, expiresAt: number): Promise<void>
  shareRead(id: string): Promise<{ sealed: SealedVault; expiresAt: number } | null>

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

/** Re-exported: the guard lives in `#shared/images` since M34.5, the tests import it here. */
export { isDiscogsImage }

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
  accessKey,
  fetchImpl = globalThis.fetch.bind(globalThis),
}: HubClientOptions): HubClient | null {
  const trimmed = baseUrl?.trim().replace(/\/+$/, '')
  if (!trimmed) return null

  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (secret) headers['x-hub-secret'] = secret
  // The second door (docs/17 §3.2). Both may travel: a self-hoster's hub
  // ignores the key, a hosted one the secret.
  if (accessKey) headers['x-fidelity-key'] = accessKey

  const url = (path: string) => `${trimmed}${path}`

  return {
    async horizon(kind, id) {
      const response = await fetchImpl(url(`/v1/horizon/${kind}/${id}`), { headers })
      // 404 is the ordinary answer for anything nobody has expanded yet.
      if (!response.ok) return null

      const parsed = wireChunkSchema.safeParse(await response.json())
      if (!parsed.success) {
        log.warn('[hub] answer does not match the schema', kind, id)
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
        log.warn('[hub] cover answer does not match the schema')
        return {}
      }

      const covers: Record<number, HubCover> = {}
      for (const [key, value] of Object.entries(parsed.data.covers)) {
        const releaseId = Number(key)
        if (!Number.isSafeInteger(releaseId) || releaseId <= 0) continue
        if (!isDiscogsImage(value.thumbUrl) || !isDiscogsImage(value.coverUrl)) {
          log.warn('[hub] cover address is not Discogs, discarded', releaseId)
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

    async family(masterId) {
      const response = await fetchImpl(url(`/v1/family/${masterId}`), { headers })
      if (!response.ok) return null
      const parsed = familySchema.safeParse(await response.json())
      if (!parsed.success || parsed.data.masterId !== masterId) {
        log.warn('[hub] family answer does not match the schema', masterId)
        return null
      }
      return parsed.data
    },

    async contributeFamily(family) {
      await fetchImpl(url(`/v1/family/${family.masterId}`), {
        method: 'PUT',
        headers,
        body: JSON.stringify(family),
      })
    },

    async vaultRead(id) {
      const response = await fetchImpl(url(`/v1/vault/${id}`), { headers })
      // 404 is the first answer on a device that has never written one.
      if (!response.ok) return null

      const body = (await response.json()) as { sealed?: unknown }
      const parsed = sealedSchema.safeParse(body?.sealed)
      if (!parsed.success) {
        log.warn('[hub] vault answer does not match the schema')
        return null
      }
      return parsed.data
    },

    async vaultForget(id) {
      try {
        await fetchImpl(url(`/v1/vault/${id}`), { method: 'DELETE', headers })
      } catch {
        // See above: the tidying up is the least important part of the move.
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
      if (!response.ok)
        throw Object.assign(fail('hub-http-error', 'hub refused the vault'), {
          status: response.status,
        })
    },

    async shareWrite(id, sealed, expiresAt) {
      const response = await fetchImpl(url('/v1/share'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ id, expiresAt, sealed }),
      })
      // As with the vault: somebody here is waiting for a link they mean to
      // send. Failing silently would hand them a dead one.
      if (!response.ok) {
        throw Object.assign(fail('hub-http-error', 'hub refused the find list'), {
          status: response.status,
        })
      }
    },

    async shareRead(id) {
      /*
       * Without `headers`, and that is the point.
       *
       * Whoever opens this link does not have the hub secret — they do not
       * know the hub at all. If this method sent the recipient's headers, it
       * would get a 401 at a foreign hub and a result at their own, which
       * breaks the feature for exactly the people it is there for.
       */
      const response = await fetchImpl(url(`/v1/share/${id}`), {
        headers: { 'content-type': 'application/json' },
      })
      if (!response.ok) return null

      const body = (await response.json()) as { sealed?: unknown; expiresAt?: unknown }
      const parsed = sealedSchema.safeParse(body?.sealed)
      if (!parsed.success || typeof body?.expiresAt !== 'number') {
        log.warn('[hub] shared-list answer does not match the schema')
        return null
      }
      return { sealed: parsed.data, expiresAt: body.expiresAt }
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

    async shops() {
      const response = await fetchImpl(url('/v1/shops'), { headers })
      if (!response.ok) return []

      const parsed = shopsAnswerSchema.safeParse(await response.json())
      if (!parsed.success) {
        log.warn('[hub] shop list does not match the schema')
        return []
      }
      return parsed.data.shops
    },

    async contributeShop(shop) {
      const response = await fetchImpl(url(`/v1/shops/${encodeURIComponent(shop.username)}`), {
        method: 'PUT',
        headers,
        /*
         * Assembled field by field rather than spread.
         *
         * ADR-014 draws a line — no price, no affinity — and a spread would
         * carry over whatever a future `Dealer` field happens to be called.
         * The hub drops what its schema does not name, but a client that
         * relies on the other side to forget is a client that has already
         * sent it.
         */
        body: JSON.stringify({
          displayName: shop.displayName,
          shipsFrom: shop.shipsFrom,
          numForSale: shop.numForSale,
          avatarUrl: shop.avatarUrl ?? '',
          seenAt: shop.seenAt,
          fingerprint: {
            sampledItems: shop.fingerprint.sampledItems,
            totalItems: shop.fingerprint.totalItems,
            coverage: shop.fingerprint.coverage,
            labelDist: shop.fingerprint.labelDist,
            styleDist: shop.fingerprint.styleDist,
            decadeDist: shop.fingerprint.decadeDist,
          },
        }),
      })
      return response.ok
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
