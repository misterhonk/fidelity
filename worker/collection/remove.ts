import { openFidelityDb } from '~~/db/open'
import { queueJob } from '~~/db/outbox'
import type { OutboxJob } from '~~/db/schema'
import type { CollectionItem } from '#shared/types'

/**
 * Taking a record off your own shelf.
 *
 * The one destructive thing the app can do to somebody's Discogs account, so
 * it is the one that always asks first — the confirmation lives in the sheet,
 * where the record and its cover are still in front of you.
 *
 * The whole row is carried in the job rather than just its id, because the
 * only way to put it back after a failed run is to have kept it. Discogs
 * cannot hand back what was never deleted over there.
 */
export async function removeRecord(releaseId: number): Promise<boolean> {
  const db = await openFidelityDb()
  const record = await db.get('collection', releaseId)
  if (!record?.instanceId || !record.folderId) return false

  await db.delete('collection', releaseId)
  await queueJob({
    id: `collection.remove:${releaseId}`,
    kind: 'collection.remove',
    payload: {
      releaseId,
      folderId: record.folderId,
      instanceId: record.instanceId,
    },
    // Not a value but the record itself. JSON, because the store holds plain
    // data and the row has to survive a reload of the app to be restorable.
    revert: { record: JSON.stringify(record) },
    queuedAt: Date.now(),
  })

  return true
}

/** Puts a record back after its removal was given up on. */
export async function restoreRecord(job: OutboxJob): Promise<void> {
  const { record } = job.revert as { record: string }
  const db = await openFidelityDb()
  await db.put('collection', JSON.parse(record) as CollectionItem)
}
