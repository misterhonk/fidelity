import { openFidelityDb } from '~~/db/open'
import type { HorizonSource } from '#shared/ports'
import type { HorizonChunk, HorizonKind } from '#shared/types'

import { preferHub } from '../hub/fallback'

/** Revalidation interval from docs/01-ARCHITEKTUR.md §6. */
export const HORIZON_TTL_MS = 30 * 24 * 60 * 60 * 1000

export function horizonKey(kind: HorizonKind, id: number): string {
  return `${kind}:${id}`
}

/**
 * Expands one entity into release-id edges by calling Discogs. Supplied by the
 * DiscogsClient in M2; this module only decides *when* it is called.
 */
export type ExpandEntity = (kind: HorizonKind, id: number) => Promise<HorizonChunk>

export interface ApiHorizonSourceOptions {
  /** A hub-backed lookup, when one is configured. Normally absent (M9). */
  hub?: (kind: HorizonKind, id: number) => Promise<HorizonChunk | null>
  contribute?: (chunk: HorizonChunk) => Promise<void>
  ttlMs?: number
  now?: () => number
}

/**
 * The standard horizon source: IndexedDB first, then the hub if there is one,
 * then Discogs. The cache is the point — the collection is small and stable
 * while inventories are large and volatile, so we cache the small stable side
 * and every later dig becomes a set lookup for free.
 */
export function createApiHorizonSource(
  expand: ExpandEntity,
  { hub, contribute, ttlMs = HORIZON_TTL_MS, now = Date.now }: ApiHorizonSourceOptions = {},
): HorizonSource {
  return {
    async fetch(kind, id) {
      const db = await openFidelityDb()
      const key = horizonKey(kind, id)

      const cached = await db.get('horizon', key)
      if (cached && now() - cached.fetchedAt < ttlMs) return cached

      const chunk = await preferHub(() => expand(kind, id), {
        hub: hub ? () => hub(kind, id) : null,
        contribute,
      })

      await db.put('horizon', chunk)
      return chunk
    },

    contribute,
  }
}
