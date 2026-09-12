import type { CatalogueSource, CatalogueStats } from '#shared/ports'
import type { TasteComparison, TasteFacet, TasteProfile } from '#shared/types'

/**
 * "Your seventies share is 3× the catalogue's" (docs/16 §2, M21.6).
 *
 * The taste profile knows each facet's share of the collection; the
 * catalogue knows each facet's share of everything Discogs has. The ratio
 * is the lift the map has carried a slot for since M1 and never had a
 * denominator for — the dumps that would have provided it went with
 * ADR-007, and now they are back as a service.
 *
 * Null without a catalogue, and null when the catalogue does not answer:
 * the map shows no comparison rather than a wrong one. A facet the
 * catalogue does not carry gets no lift, not a lift of infinity.
 */
export function lifts(
  facets: Record<string, TasteFacet>,
  stats: CatalogueStats,
  keyOf: (key: string, facet: TasteFacet) => string,
): Record<string, number> {
  if (stats.total <= 0) return {}
  const share = new Map(stats.rows.map(([key, count]) => [key, count / stats.total]))
  const out: Record<string, number> = {}
  for (const [key, facet] of Object.entries(facets)) {
    const global = share.get(keyOf(key, facet))
    if (!global || facet.weight <= 0) continue
    out[key] = Math.round((facet.weight / global) * 10) / 10
  }
  return out
}

export async function compareWithCatalogue(
  profile: TasteProfile | null,
  catalogue: CatalogueSource | null,
): Promise<TasteComparison | null> {
  if (!profile || !catalogue) return null
  const [decades, styles, genres] = await Promise.all([
    catalogue.stats('decades'),
    catalogue.stats('styles'),
    catalogue.stats('genres'),
  ])
  if (!decades || !styles || !genres) return null
  return {
    build: decades.build,
    decades: lifts(profile.decades, decades, (key) => key),
    styles: lifts(profile.styles, styles, (_key, facet) => facet.name),
    genres: lifts(profile.genres, genres, (_key, facet) => facet.name),
  }
}
