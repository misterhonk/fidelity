import { queueJob } from '~~/db/outbox'
import { openFidelityDb } from '~~/db/open'

/**
 * A rating, given to a record you own.
 *
 * Written to the shelf here and now, and queued for Discogs. Not the other way
 * round: at 1.2 seconds per request the star would light up long after the
 * finger left it, and in a shop with no signal it would never light up at all.
 * The outbox is what makes the optimism honest — it either lands or puts the
 * old value back (`worker/outbox.ts`).
 *
 * Returns false when the record carries no entry to address. That happens to
 * anybody who last synced before entry ids were kept, and the screen has to
 * say so; a button that silently does nothing is worse than one that is off.
 */
export async function rateRecord(releaseId: number, rating: number): Promise<boolean> {
  const db = await openFidelityDb()
  const record = await db.get('collection', releaseId)
  if (!record) return false

  // Falsy, not `=== 0`: rows written before v5 have neither field at all.
  if (!record.instanceId || !record.folderId) return false
  if (record.rating === rating) return true

  await db.put('collection', { ...record, rating })
  await queueJob({
    id: `collection.rating:${releaseId}`,
    kind: 'collection.rating',
    payload: {
      releaseId,
      folderId: record.folderId,
      instanceId: record.instanceId,
      rating,
    },
    revert: { rating: record.rating },
    queuedAt: Date.now(),
  })

  return true
}
