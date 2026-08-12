import { openFidelityDb } from './open'
import type { CollectionItem } from '#shared/types'

/**
 * Two ways of asking about a shelf, and they are not the same question.
 *
 * Since v6 the store holds one row per *copy*: somebody who owns a record
 * twice has two. That is what the shelf screen should show — two sleeves, two
 * conditions, two ratings.
 *
 * Everything that reasons rather than displays wants the other question.
 * "Do I own this release", "what does my taste look like", "which masters
 * should the horizon expand" — none of them get a better answer because a
 * record is owned twice, and a taste profile that counted the second copy
 * would quietly weight a label by how many spares somebody keeps.
 */

/** Every copy, in no particular order. For screens that show the shelf. */
export async function allCopies(): Promise<CollectionItem[]> {
  const db = await openFidelityDb()
  return db.getAll('collection')
}

/**
 * One row per release, for everything that reasons about records.
 *
 * The copy kept is the one with the most to say: a real entry beats a
 * provisional one, and a rating beats none. Nothing else differs between two
 * copies of the same record — the sleeve, the labels and the year come from
 * the same `basic_information`.
 */
export async function distinctReleases(): Promise<CollectionItem[]> {
  const byRelease = new Map<number, CollectionItem>()

  for (const item of await allCopies()) {
    const kept = byRelease.get(item.releaseId)
    if (!kept || better(item, kept)) byRelease.set(item.releaseId, item)
  }

  return [...byRelease.values()]
}

function better(candidate: CollectionItem, current: CollectionItem): boolean {
  if (candidate.instanceId > 0 !== current.instanceId > 0) return candidate.instanceId > 0
  return candidate.rating > current.rating
}
