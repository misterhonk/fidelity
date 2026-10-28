import { openFidelityDb } from './open'
import type { OutboxJob } from './schema'

/**
 * The queue of changes that have not reached Discogs yet.
 *
 * Storage only — what a job *means* lives in `worker/outbox.ts`. Keeping the
 * two apart is what lets the drain be tested against a fake client while this
 * file stays a plain table.
 */

/** After this many failed runs a job is given up on and its value put back. */
export const MAX_ATTEMPTS = 5

export async function queueJob(job: Omit<OutboxJob, 'attempts'>): Promise<void> {
  const db = await openFidelityDb()
  /*
   * put, not add — and that is the whole coalescing story.
   *
   * Tapping four stars and then three is one intention, not two, and the id
   * addresses the row rather than the moment. The second tap replaces the
   * first while it is still waiting, so the shelf spends one request on what
   * the collector meant rather than one per twitch of the finger.
   *
   * `revert` survives that replacement deliberately: it holds what Discogs
   * still believes, not what the app showed a second ago.
   */
  // One transaction: a drain dropping or failing the job in between must not be undone.
  const tx = db.transaction('outbox', 'readwrite')
  const existing = await tx.store.get(job.id)
  // A pending move still sits in its old folder at Discogs, so that stays the address.
  const from = existing?.kind === 'collection.folder' ? existing.payload.folderId : undefined
  await tx.store.put({
    ...job,
    payload: from === undefined ? job.payload : { ...job.payload, folderId: from },
    revert: existing?.revert ?? job.revert,
    attempts: 0,
  })
  await tx.done
}

export async function pendingJobs(): Promise<OutboxJob[]> {
  const db = await openFidelityDb()
  const jobs = await db.getAll('outbox')
  // Oldest first: two changes to different rows should reach Discogs in the
  // order they were made, even though nothing depends on it today.
  return jobs.sort((a, b) => a.queuedAt - b.queuedAt)
}

/**
 * Takes a job off the queue once it has reached Discogs.
 *
 * With `sent`, only if the row is still the one that was sent: a rating tapped
 * again while the first one was on its way replaced it under the same id
 * (`queueJob`), and deleting that would lose what the collector meant last.
 */
export async function dropJob(id: string, sent?: OutboxJob): Promise<void> {
  const db = await openFidelityDb()
  const tx = db.transaction('outbox', 'readwrite')
  const stored = await tx.store.get(id)
  const replaced =
    sent !== undefined &&
    stored !== undefined &&
    (stored.queuedAt !== sent.queuedAt ||
      JSON.stringify(stored.payload) !== JSON.stringify(sent.payload))
  if (!replaced) await tx.store.delete(id)
  // The sent move has landed, so the replacement now starts where it put the record.
  else if (stored.kind === 'collection.folder' && sent.kind === 'collection.folder')
    await tx.store.put({
      ...stored,
      payload: { ...stored.payload, folderId: Number(sent.payload.moveTo) },
    })
  await tx.done
}

/**
 * Note that a run failed. Returns the job when it is out of attempts, so the
 * caller knows it has a value to put back.
 */
export async function noteFailure(id: string, reason: string): Promise<OutboxJob | null> {
  const db = await openFidelityDb()
  const tx = db.transaction('outbox', 'readwrite')
  const job = await tx.store.get(id)
  if (!job) {
    await tx.done
    return null
  }

  const attempts = job.attempts + 1
  if (attempts >= MAX_ATTEMPTS) {
    await tx.store.delete(id)
    await tx.done
    return { ...job, attempts, lastError: reason }
  }

  await tx.store.put({ ...job, attempts, lastError: reason })
  await tx.done
  return null
}
