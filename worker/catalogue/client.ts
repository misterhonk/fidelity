import { z } from 'zod'

import { getPreferences } from '~~/db/meta'
import type { CatalogueArtist, CatalogueSource } from '#shared/ports'
import type { HorizonChunk, PressingFamilyFacts } from '#shared/types'
import { chunkIsSound, decodeChunk, type WireChunk } from '#shared/wire'

import { withTimeout, HUB_TIMEOUT_MS } from '../hub/fallback'
import { wireChunkSchema } from '../hub/client'
import { log } from '../log'

/**
 * Talking to a catalogue service, if there is one (ADR-013, docs/16 §5–6).
 *
 * Written on the same assumption as the hub client: the service is wrong.
 * Every answer crosses a Zod schema, a chunk crosses the soundness check,
 * a miss is null, an error is null and a warning in the console, and nothing
 * waits longer than two seconds. The consumers have the horizon behind them
 * and never learn which of the two answered — that is rule 1 of ADR-013.
 *
 * No secret: the catalogue is public CC0 data with nothing to lock.
 */

const artistSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  names: z
    .array(z.object({ name: z.string(), relation: z.enum(['alias', 'member', 'group']) }))
    .max(200),
})

const healthSchema = z.object({
  ok: z.literal(true),
  build: z.string().min(4),
  releases: z.number().int().nonnegative().optional(),
})

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

const idsSchema = z.object({ releaseIds: z.array(z.number().int().positive()).max(5000) })
const artistIdsSchema = z.object({ artistIds: z.array(z.number().int().positive()).max(50) })

export interface CatalogueClientOptions {
  /** Empty or absent means no catalogue, which is the normal case. */
  baseUrl: string | null | undefined
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

export function createCatalogueClient({
  baseUrl,
  fetchImpl = globalThis.fetch?.bind(globalThis),
  timeoutMs = HUB_TIMEOUT_MS,
}: CatalogueClientOptions): CatalogueSource | null {
  const trimmed = baseUrl?.trim().replace(/\/+$/, '')
  if (!trimmed) return null

  /** One GET, bounded, parsed — or null. Never a throw past this line. */
  async function ask<T>(path: string, schema: z.ZodType<T>): Promise<T | null> {
    try {
      const response = await withTimeout(
        fetchImpl(`${trimmed}/v1/catalogue${path}`, {
          headers: { accept: 'application/json' },
        }),
        timeoutMs,
      )
      // 404 is the ordinary answer for anything the build does not know.
      if (!response.ok) return null
      const parsed = schema.safeParse(await response.json())
      if (!parsed.success) {
        log.warn('[catalogue] answer does not match the schema', path)
        return null
      }
      return parsed.data
    } catch {
      // Refused, too slow, offline — the horizon is behind every caller.
      return null
    }
  }

  async function chunk(path: string): Promise<HorizonChunk | null> {
    const wire = await ask(path, wireChunkSchema)
    if (!wire) return null
    const decoded = decodeChunk(wire as WireChunk)
    if (!chunkIsSound(decoded)) {
      log.warn('[catalogue] chunk contradicts itself, discarded', decoded.key)
      return null
    }
    return decoded
  }

  return {
    async build() {
      return (await ask('/health', healthSchema))?.build ?? null
    },
    async artist(id): Promise<CatalogueArtist | null> {
      return ask(`/artist/${id}`, artistSchema)
    },
    credits(id, role) {
      return chunk(`/artist/${id}/credits?role=${encodeURIComponent(role)}`)
    },
    run(labelId, prefix) {
      return chunk(`/label/${labelId}/run?prefix=${encodeURIComponent(prefix)}`)
    },
    async family(masterId): Promise<PressingFamilyFacts | null> {
      const facts = await ask(`/master/${masterId}/family`, familySchema)
      return facts && facts.masterId === masterId ? facts : null
    },
    async identify(query) {
      const params = new URLSearchParams()
      if (query.barcode) params.set('barcode', query.barcode)
      if (query.runout) params.set('runout', query.runout)
      if ([...params.keys()].length === 0) return null
      return (await ask(`/identify?${params}`, idsSchema))?.releaseIds ?? null
    },
    async resolve(name) {
      const trimmed = name.trim()
      if (!trimmed) return null
      return (
        (await ask(`/resolve?artist=${encodeURIComponent(trimmed)}`, artistIdsSchema))
          ?.artistIds ?? null
      )
    },
  }
}

/** The configured catalogue, or null — read fresh, because the setting can change. */
export async function catalogueSource(): Promise<CatalogueSource | null> {
  const { catalogueUrl } = await getPreferences()
  return createCatalogueClient({ baseUrl: catalogueUrl })
}
