import { openFidelityDb } from '~~/db/open'
import type { CollectionGaps, LabelStanding, ShelfGap } from '#shared/types'

import { buildLookup, labelLift } from '../horizon/lookup'
import { norm } from '../match/normalize'
import { distinctReleases } from '~~/db/collection'

/**
 * Where the shelf has holes, and which labels you really collect.
 *
 * The map showed counts and stopped: "Cocoon Recordings 6". Six of what?
 * Cocoon has hundreds of releases and Border Community has a fraction of that,
 * so the same 6 means two completely different things — and a collector
 * looking at their own shelf is asking exactly that question.
 *
 * Both answers were already sitting in the horizon and nothing surfaced them.
 * The discography map knows you have four of six Robag Wruhme records; the
 * catalogue sizes give the label lift its denominator. This is the reading, not
 * a new calculation, and it costs no requests at all.
 */

/**
 * Below this an artist is not a collection, and "1 von 47" is discouraging
 * rather than useful. Two is the same floor the horizon uses to decide
 * somebody is worth expanding at all.
 */
export const MIN_OWNED = 2

/**
 * Somebody who owns everything filed under a name has nothing to be told.
 *
 * Rare, and only reachable for artists with a handful of entries — which is
 * precisely why it is a ceiling and not a ranking.
 */
export const MAX_SHARE = 0.999

/** How many rows either list offers. Past this it is a database, not a map. */
export const LIMIT = 15

export async function collectionGaps(): Promise<CollectionGaps> {
  const db = await openFidelityDb()
  const [collection, wantlist, chunks] = await Promise.all([
    distinctReleases(),
    db.getAll('wantlist'),
    db.getAll('horizon'),
  ])

  if (chunks.length === 0) return { built: false, artists: [], labels: [] }

  const lookup = buildLookup(chunks, collection, wantlist)

  // How many records of each label the shelf holds, by label id — the
  // numerator the lift needs.
  const ownedByLabel = new Map<number, number>()
  const labelNames = new Map<number, string>()
  for (const item of collection) {
    const seen = new Set<number>()
    for (const [index, id] of item.labelIds.entries()) {
      if (seen.has(id)) continue
      seen.add(id)
      ownedByLabel.set(id, (ownedByLabel.get(id) ?? 0) + 1)
      labelNames.set(id, item.labelNames[index] ?? String(id))
    }
  }

  const artists: ShelfGap[] = []
  for (const [entityId, entry] of lookup.discography) {
    if (entry.owned < MIN_OWNED || entry.total === 0) continue

    const share = entry.owned / entry.total
    if (share > MAX_SHARE) continue

    artists.push({
      entityId,
      name: entry.name,
      owned: entry.owned,
      total: entry.total,
      share,
      missing: entry.total - entry.owned,
      from: entry.from,
      to: entry.to,
    })
  }

  const labels: LabelStanding[] = []
  for (const [entityId, owned] of ownedByLabel) {
    const size = lookup.catalogueSizes.get(entityId)
    if (!size || size <= 0) continue

    labels.push({
      entityId,
      name: labelNames.get(entityId) ?? String(entityId),
      owned,
      catalogueSize: size,
      // Against the labels this collection actually buys from, not against all
      // of Discogs — a corpus size nobody in a browser can measure (docs/04 §S5).
      lift: labelLift(lookup, entityId, ownedByLabel),
    })
  }

  return {
    built: true,
    /*
     * The artists you own most of, first.
     *
     * Sorting by share was tried against a real shelf and thrown away: it put
     * "Monkey Maffia 2 von 24" above "Robag Wruhme 5 von 252" and called the
     * first one nearly complete. `/artists/{id}/releases` lists everything
     * filed under a name — albums, singles, remixes, compilation appearances
     * — so a share is not a completion percentage and ranking by it rewards
     * whoever happens to have the smallest catalogue.
     *
     * How many you own is a fact about you, and that is what this list is for.
     */
    artists: artists.sort((a, b) => b.owned - a.owned || b.total - a.total).slice(0, LIMIT),
    labels: labels
      .sort((a, b) => (b.lift ?? 0) - (a.lift ?? 0) || b.owned - a.owned)
      .slice(0, LIMIT),
  }
}

/** Kept so a label name can be matched against the taste profile's spelling. */
export const labelKey = norm
