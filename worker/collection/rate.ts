import { queueJob } from '~~/db/outbox'
import { openFidelityDb } from '~~/db/open'
import { isOwnEntry } from '#shared/types'

/**
 * A rating, given to a record you own.
 *
 * Written to the shelf here and now, and queued for Discogs. Not the other way
 * round: at 1.2 seconds per request the star would light up long after the
 * finger left it, and in a shop with no signal it would never light up at all.
 * The outbox is what makes the optimism honest — it either lands or puts the
 * old value back (`worker/outbox.ts`).
 *
 * Addressed by copy, not by record: somebody who owns a sealed one and a
 * played one rates them apart. Returns false for a copy with no entry behind
 * it — one added from a find and not yet synced — and the screen has to say
 * so; a button that silently does nothing is worse than one that is off.
 */
export async function rateRecord(instanceId: number, rating: number): Promise<boolean> {
  const db = await openFidelityDb()
  const record = await db.get('collection', instanceId)
  if (!record || !isOwnEntry(record)) return false
  if (record.rating === rating) return true

  await db.put('collection', { ...record, rating })
  await queueJob({
    id: `collection.rating:${instanceId}`,
    kind: 'collection.rating',
    payload: {
      releaseId: record.releaseId,
      folderId: record.folderId,
      instanceId,
      rating,
    },
    revert: { rating: record.rating },
    queuedAt: Date.now(),
  })

  return true
}
