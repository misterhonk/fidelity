import { openFidelityDb } from '~~/db/open'
import type { CatalogueContext, DiscographyContext, Match, MatchDetail } from '#shared/types'

import { buildLookup, hitsFor, type HorizonLookup } from '../horizon/lookup'
import { parseCatno } from '../horizon/pack'
import { distinctReleases } from '~~/db/collection'

/**
 * The detail sheet's data.
 *
 * Everything here comes out of the horizon and the stored match — not a single
 * request. That is the point of having expanded the collection in the first
 * place: the expensive question was asked once, so opening a record is a set
 * lookup and costs nothing from a rate limit that is already the scarcest
 * thing in this app.
 */

/** How many numbers either side of this one the grid shows. */
export const RUN_SPAN = 12

let cached: { at: number; lookup: HorizonLookup } | null = null

/**
 * The lookup costs about 30 ms to build over a few hundred thousand ids, which
 * is fine once and silly per click.
 *
 * Invalidation is explicit — `forgetLookup()` after a horizon build and after
 * a library sync — because the cached answer depends on the collection too,
 * not only on the horizon. Sync three more Robag records and "3 von 4" has to
 * become "6 von 7"; a stamp over the horizon rows alone would keep saying the
 * old number and look like a matching bug rather than a stale cache.
 */
async function lookup(): Promise<HorizonLookup> {
  const db = await openFidelityDb()
  const [chunks, collection, wantlist] = await Promise.all([
    db.getAll('horizon'),
    distinctReleases(),
    db.getAll('wantlist'),
  ])

  if (cached) return cached.lookup

  const built = buildLookup(chunks, collection, wantlist)
  cached = { at: Date.now(), lookup: built }
  return built
}

/** Dropped whenever the horizon or the collection moves under it. */
export function forgetLookup(): void {
  cached = null
}

export async function matchDetail(
  digId: string,
  listingId: number,
): Promise<MatchDetail | null> {
  const db = await openFidelityDb()
  const match = await db.get('matches', [digId, listingId])
  if (!match) return null

  const horizon = await lookup()
  const hits = hitsFor(horizon, match.releaseId)

  return {
    match,
    catalogue: catalogueContext(horizon, match),
    discography: discographyContext(horizon, hits),
    connections: hits
      .filter((hit) => hit.kind === 'artist')
      .map((hit) => ({ kind: hit.kind, name: hit.name, role: hit.role }))
      // Main credits before production work: "sein Album" before "hat produziert".
      .sort((a, b) => a.role - b.role || a.name.localeCompare(b.name)),
  }
}

/**
 * The catalogue-series grid: this number in its neighbourhood, with the ones
 * you own marked. Brain's 1000s read very differently once you can see that
 * you have 1001, 1002, 1004 and 1005 and this is 1003.
 */
function catalogueContext(horizon: HorizonLookup, match: Match): CatalogueContext | null {
  const parsed = match.catno ? parseCatno(match.catno) : null
  if (!parsed) return null

  for (const [key, run] of horizon.runs) {
    if (!key.endsWith(`:${parsed.prefix}`)) continue

    const near = run.numbers.filter(
      (number) => Math.abs(number - parsed.num) <= RUN_SPAN && number !== parsed.num,
    )
    // A series of one is not a series; there is nothing to show.
    if (near.length === 0) continue

    const neighbours = [...new Set([...near, parsed.num])]
      .sort((a, b) => a - b)
      .map((number) => ({
        number,
        owned: run.owned.has(number),
        isThis: number === parsed.num,
      }))

    return { label: run.label, prefix: parsed.prefix, number: parsed.num, neighbours }
  }

  return null
}

/** For each artist on this record: how much of their discography you hold. */
function discographyContext(
  horizon: HorizonLookup,
  hits: ReturnType<typeof hitsFor>,
): DiscographyContext[] {
  const seen = new Set<number>()
  const out: DiscographyContext[] = []

  for (const hit of hits) {
    if (hit.kind !== 'artist' || seen.has(hit.entityId)) continue
    seen.add(hit.entityId)

    const entry = horizon.discography.get(hit.entityId)
    if (!entry || entry.total === 0) continue
    out.push({
      artist: entry.name,
      owned: entry.owned,
      total: entry.total,
      from: entry.from,
      to: entry.to,
    })
  }

  return out.sort((a, b) => b.owned - a.owned)
}
