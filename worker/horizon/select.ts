import type { CollectionItem, HorizonKind, WantlistItem } from '#shared/types'

/**
 * Which entities are worth expanding.
 *
 * The whole trick of the horizon is the direction of the question: not
 * "what is this listing?" — twenty thousand times, per dig — but "what has the
 * collection got?" — a few hundred times, once. The collection is small and
 * stable; inventories are large and volatile. You cache the small stable side.
 */

export interface Candidate {
  kind: HorizonKind
  id: number
  name: string
  /** How many records in the collection point at it. Drives the order. */
  owned: number
}

/** An artist you own twice is a taste; once is an accident. */
export const MIN_ARTIST_RECORDS = 2

/** Same for labels — the real filter is the lift, which needs the expansion. */
export const MIN_LABEL_RECORDS = 2

/**
 * docs/11 §3 selects labels by "lift ≥ 2 and < 1.500 releases". Both numbers
 * come out of the expansion itself, so they cannot gate it: the catalogue size
 * arrives with the first page, and the lift needs it.
 *
 * So the cheap criterion picks the candidates and the expansion enforces the
 * rest — a label that turns out to be enormous is cut short after one page
 * and marked incomplete rather than paged through fifteen times.
 */
export const LABEL_PAGE_LIMIT = 1500

export function selectCandidates(
  collection: CollectionItem[],
  wantlist: WantlistItem[],
): Candidate[] {
  const artists = new Map<number, Candidate>()
  const labels = new Map<number, Candidate>()

  // One record counts once per entity, however often it names it. A release
  // that credits the same artist twice is still one record you own.
  const count = (
    into: Map<number, Candidate>,
    kind: 'artist' | 'label',
    ids: number[],
    names: string[],
  ) => {
    const seen = new Set<number>()
    for (const [index, id] of ids.entries()) {
      if (seen.has(id)) continue
      seen.add(id)

      const existing = into.get(id)
      if (existing) existing.owned += 1
      else into.set(id, { kind, id, name: names[index] ?? String(id), owned: 1 })
    }
  }

  for (const item of collection) {
    count(artists, 'artist', item.artistIds, item.artistNames)
    count(labels, 'label', item.labelIds, item.labelNames)
  }

  // Every wantlist album with a master: one request buys every pressing of it,
  // which is what makes "same record, different pressing" reachable at all.
  const masters = new Map<number, Candidate>()
  for (const want of wantlist) {
    if (want.masterId > 0 && !masters.has(want.masterId)) {
      masters.set(want.masterId, {
        kind: 'master',
        id: want.masterId,
        name: want.title,
        owned: 1,
      })
    }
  }

  return [
    // Wantlist masters first: one request each, and they feed the strongest
    // signal after the exact match. Then the entities you own the most of —
    // if the run is interrupted, the most valuable part is already done.
    ...masters.values(),
    ...[...artists.values()]
      .filter((candidate) => candidate.owned >= MIN_ARTIST_RECORDS)
      .sort((a, b) => b.owned - a.owned),
    ...[...labels.values()]
      .filter((candidate) => candidate.owned >= MIN_LABEL_RECORDS)
      .sort((a, b) => b.owned - a.owned),
  ]
}

export function candidateKey(candidate: Pick<Candidate, 'kind' | 'id'>): string {
  return `${candidate.kind}:${candidate.id}`
}
