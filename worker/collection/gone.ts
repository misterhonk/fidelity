import { openFidelityDb } from '~~/db/open'
import { GONE_KEEP_MS } from '~~/db/schema'
import type { CollectionItem } from '#shared/types'

/**
 * Copies a full sync no longer found, and the place each one held (#238).
 *
 * The sweep puts them in `gone` instead of dropping them without a word; this
 * is the other half, kept out of the sync on purpose — the sync never writes a
 * location (places.spec.ts). Here a place is held for 30 days: the same
 * release coming back as a new entry in that time takes it again, and after
 * that it is free.
 */

/** Entries new to this shelf, after a sync stored them: one that left may have come back. */
export async function welcomeBack(fresh: CollectionItem[]): Promise<void> {
  const db = await openFidelityDb()
  const tx = db.transaction(['gone', 'placements'], 'readwrite')
  const gone = await tx.objectStore('gone').getAll()
  const placements = tx.objectStore('placements')
  for (const item of fresh) {
    if (item.instanceId <= 0) continue
    const before = gone.find(
      (entry) =>
        entry.instanceId === item.instanceId || entry.record.releaseId === item.releaseId,
    )
    if (!before) continue
    gone.splice(gone.indexOf(before), 1)
    await tx.objectStore('gone').delete(before.instanceId)
    // The same entry after all: its placement never moved.
    if (before.instanceId === item.instanceId) continue
    const old = await placements.get(before.instanceId)
    const own = await placements.get(item.instanceId)
    if (!old?.placeId || own?.placeId) continue
    const at = Date.now()
    await placements.put({ ...old, instanceId: item.instanceId, at })
    // Written down, not deleted: the vault merges placements by their stamp (places.ts).
    await placements.put({ instanceId: before.instanceId, placeId: null, at })
  }
  await tx.done
}

/** Thirty days on, a gone copy is forgotten and the place it held is free again. */
export async function forgetGone(now = Date.now()): Promise<void> {
  const db = await openFidelityDb()
  const tx = db.transaction(['gone', 'placements'], 'readwrite')
  for (const entry of await tx.objectStore('gone').getAll()) {
    if (now - entry.goneAt < GONE_KEEP_MS) continue
    await tx.objectStore('gone').delete(entry.instanceId)
    const placement = await tx.objectStore('placements').get(entry.instanceId)
    if (placement?.placeId)
      await tx.objectStore('placements').put({ ...placement, placeId: null, at: now })
  }
  await tx.done
}
