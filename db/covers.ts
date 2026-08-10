import type { CoverEntry } from './schema'

import { openFidelityDb } from './open'

/**
 * Die gemeinsame Cover-Ablage.
 *
 * One picture per release, shared by every screen that draws one. See
 * `db/schema.ts` for why it has to exist at all — the short version is that the
 * marketplace hands back listings without images and always has.
 */

/** What the store knows about these releases. Missing ids are simply absent. */
export async function readCovers(
  releaseIds: Iterable<number>,
): Promise<Map<number, CoverEntry>> {
  const wanted = [...new Set(releaseIds)].filter((id) => id > 0)
  if (wanted.length === 0) return new Map()

  const db = await openFidelityDb()
  const tx = db.transaction('covers', 'readonly')
  const found = new Map<number, CoverEntry>()

  await Promise.all(
    wanted.map(async (releaseId) => {
      const entry = await tx.store.get(releaseId)
      if (entry) found.set(releaseId, entry)
    }),
  )
  await tx.done

  return found
}

/**
 * Merkt sich, was schon bekannt ist — auch das Nichts.
 *
 * An empty `thumbUrl` is written deliberately for a release Discogs holds no
 * image for. Without it the app would ask again on every visit, and spend a
 * request each time to learn the same nothing.
 */
export async function writeCovers(entries: Omit<CoverEntry, 'fetchedAt'>[]): Promise<void> {
  if (entries.length === 0) return

  const db = await openFidelityDb()
  const tx = db.transaction('covers', 'readwrite')
  const fetchedAt = Date.now()

  for (const entry of entries) {
    if (entry.releaseId > 0) await tx.store.put({ ...entry, fetchedAt })
  }
  await tx.done
}

/**
 * Welche davon noch niemand geholt hat.
 *
 * The order of the input is kept, because it is the order the screen wants
 * them in: what is at the top of the list is what somebody is looking at.
 */
export async function unknownCovers(releaseIds: number[]): Promise<number[]> {
  const known = await readCovers(releaseIds)
  const seen = new Set<number>()

  return releaseIds.filter((id) => {
    if (id <= 0 || known.has(id) || seen.has(id)) return false
    seen.add(id)
    return true
  })
}

/** How many covers are on hand — for the storage page. */
export async function countCovers(): Promise<number> {
  const db = await openFidelityDb()
  return db.count('covers')
}
