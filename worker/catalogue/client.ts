import { z } from 'zod'

import { getPreferences } from '~~/db/meta'
import type {
  CatalogueArtist,
  CatalogueRelease,
  CatalogueSource,
  CatalogueStats,
} from '#shared/ports'
import type { HorizonChunk, PressingFamilyFacts } from '#shared/types'
import { chunkIsSound } from '#shared/wire'

import { packChunk, type Edge } from '../horizon/pack'
import { withTimeout, HUB_TIMEOUT_MS } from '../hub/fallback'
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

/*
 * Rows, not chunks: the service hands over what the API would, and the
 * packing happens here with the app's own `packChunk` — one packer, so a
 * label run computed from the dump and one computed from the API are the
 * same bytes for the same rows.
 */
const runSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  build: z.string().nullable(),
  total: z.number().int().nonnegative(),
  prefix: z.string().nullable(),
  releases: z
    .array(
      z.tuple([
        z.number().int().positive(),
        z.number().int().nullable(),
        z.number().int().nullable(),
        z.string().nullable(),
      ]),
    )
    .max(20_000),
})

const creditsSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  build: z.string().nullable(),
  total: z.number().int().nonnegative(),
  releases: z
    .array(
      z.tuple([
        z.number().int().positive(),
        z.number().int().min(0).max(255),
        z.number().int().nullable(),
      ]),
    )
    .max(20_000),
})

const idsSchema = z.object({ releaseIds: z.array(z.number().int().positive()).max(5000) })

const releaseSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  year: z.number().int().nullable(),
  country: z.string(),
  masterId: z.number().int().nonnegative(),
  artists: z.array(z.string()).max(50),
  labels: z.array(z.object({ name: z.string(), catno: z.string() })).max(50),
  formats: z.array(z.string()).max(20),
})

const statsSchema = z.object({
  build: z.string(),
  total: z.number().int().nonnegative(),
  rows: z.array(z.tuple([z.string(), z.number().int().nonnegative()])).max(5000),
})
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

  /** The build's date as the chunk's age: revalidation asks again after a month, for free. */
  const fetchedAt = (build: string | null) => {
    const parsed = build ? Date.parse(build) : Number.NaN
    return Number.isFinite(parsed) ? parsed : Date.now()
  }

  const sound = (chunk: HorizonChunk): HorizonChunk | null => {
    if (chunkIsSound(chunk)) return chunk
    log.warn('[catalogue] chunk contradicts itself, discarded', chunk.key)
    return null
  }

  return {
    async build() {
      return (await ask('/health', healthSchema))?.build ?? null
    },
    async artist(id): Promise<CatalogueArtist | null> {
      return ask(`/artist/${id}`, artistSchema)
    },
    async credits(id) {
      const answer = await ask(`/artist/${id}/credits`, creditsSchema)
      if (!answer || answer.id !== id) return null
      const edges: Edge[] = answer.releases.map(([releaseId, role, year]) => ({
        releaseId,
        role,
        year: year ?? 0,
      }))
      const chunk = packChunk('artist', id, answer.name, edges, {
        fetchedAt: fetchedAt(answer.build),
        complete: answer.releases.length >= answer.total,
        requests: 0,
      })
      chunk.catalogueSize = answer.total
      // The names come with the person: a chunk without them is the state
      // the lexicon found, and the build marks it due again (lacksKin).
      const person = await ask(`/artist/${id}`, artistSchema)
      if (person) chunk.kin = person.names
      return sound(chunk)
    },
    async run(labelId) {
      const answer = await ask(`/label/${labelId}/run`, runSchema)
      if (!answer || answer.id !== labelId) return null
      const edges: Edge[] = answer.releases.map(([releaseId, year, num, prefix]) => ({
        releaseId,
        role: 0,
        year: year ?? 0,
        catnoNum: num ?? undefined,
        catnoPrefix: prefix ?? undefined,
      }))
      const chunk = packChunk('label', labelId, answer.name, edges, {
        fetchedAt: fetchedAt(answer.build),
        complete: answer.releases.length >= answer.total,
        requests: 0,
      })
      chunk.catalogueSize = answer.total
      return sound(chunk)
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
    async release(id): Promise<CatalogueRelease | null> {
      const answer = await ask(`/release/${id}`, releaseSchema)
      return answer && answer.id === id ? answer : null
    },
    async stats(kind): Promise<CatalogueStats | null> {
      return ask(`/stats/${kind}`, statsSchema)
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
