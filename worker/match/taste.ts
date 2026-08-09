import type { CollectionItem, TasteFacet, TasteProfile } from '#shared/types'

/**
 * The taste profile: what the collection says about its owner.
 *
 * A pure function over the collection — no I/O, no database, no clock of its
 * own. That is deliberate and it is the same reason the scoring engine is
 * pure: it makes the thing golden-file testable, and this is the input every
 * later signal is weighed against.
 *
 * Recomputed after a sync, never during a dig.
 */

interface Tally {
  name: string
  n: number
}

function tally(entries: Iterable<{ key: string; name: string }>): Map<string, Tally> {
  const counts = new Map<string, Tally>()
  for (const { key, name } of entries) {
    const existing = counts.get(key)
    if (existing) {
      existing.n += 1
      // Discogs renames things; the last spelling seen wins, and they agree
      // often enough that this never matters in practice.
      existing.name = name
    } else {
      counts.set(key, { name, n: 1 })
    }
  }
  return counts
}

function toFacets(counts: Map<string, Tally>, total: number): Record<string, TasteFacet> {
  const facets: Record<string, TasteFacet> = {}
  for (const [key, { name, n }] of counts) {
    facets[key] = {
      name,
      n,
      weight: total > 0 ? n / total : 0,
      // Needs a denominator the client does not have yet — see TasteFacet.
      lift: null,
    }
  }
  return facets
}

/** Every entity of one release, counted once even if it appears twice. */
function* uniquePairs(
  ids: number[] | undefined,
  names: string[] | undefined,
): Generator<{ key: string; name: string }> {
  const seen = new Set<string>()
  for (const [index, id] of (ids ?? []).entries()) {
    const key = String(id)
    if (seen.has(key)) continue
    seen.add(key)
    // A row from an older schema version may not carry names. The migration
    // refetches those, but this must not be the thing that explodes first.
    yield { key, name: names?.[index] ?? key }
  }
}

function* uniqueValues(values: string[] | undefined): Generator<{ key: string; name: string }> {
  const seen = new Set<string>()
  for (const value of values ?? []) {
    if (seen.has(value)) continue
    seen.add(value)
    yield { key: value, name: value }
  }
}

export function computeTasteProfile(items: CollectionItem[], now: number): TasteProfile {
  const total = items.length

  const artists: { key: string; name: string }[] = []
  const labels: { key: string; name: string }[] = []
  const styles: { key: string; name: string }[] = []
  const genres: { key: string; name: string }[] = []
  const decades: { key: string; name: string }[] = []

  for (const item of items) {
    artists.push(...uniquePairs(item.artistIds, item.artistNames))
    labels.push(...uniquePairs(item.labelIds, item.labelNames))
    styles.push(...uniqueValues(item.styles))
    genres.push(...uniqueValues(item.genres))

    // Year 0 means Discogs does not know, which is not the same as "the
    // zeroth decade" — counting it would put a phantom bar on the map.
    if (item.year > 0) {
      const decade = Math.floor(item.year / 10) * 10
      decades.push({ key: String(decade), name: `${decade}er` })
    }
  }

  const styleFacets = toFacets(tally(styles), total)

  return {
    computedAt: now,
    releaseCount: total,
    artists: toFacets(tally(artists), total),
    labels: toFacets(tally(labels), total),
    styles: styleFacets,
    genres: toFacets(tally(genres), total),
    decades: toFacets(tally(decades), total),
    // Unit-length style vector, so cosine similarity is a dot product later
    // (M3). Empty while the collection is.
    styleCentroid: normalise(styleFacets),
  }
}

function normalise(facets: Record<string, TasteFacet>): Record<string, number> {
  const entries = Object.entries(facets)
  const length = Math.hypot(...entries.map(([, facet]) => facet.weight))
  if (length === 0) return {}
  return Object.fromEntries(entries.map(([key, facet]) => [key, facet.weight / length]))
}

/** The n strongest facets, for the map and for reason sentences. */
export function topFacets(facets: Record<string, TasteFacet>, limit: number): TasteFacet[] {
  return Object.values(facets)
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
    .slice(0, limit)
}
