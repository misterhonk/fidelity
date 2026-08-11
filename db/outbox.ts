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
  const existing = await db.get('outbox', job.id)
  await db.put('outbox', {
    ...job,
    revert: existing?.revert ?? job.revert,
    attempts: 0,
  })
}

export async function pendingJobs(): Promise<OutboxJob[]> {
  const db = await openFidelityDb()
  const jobs = await db.getAll('outbox')
  // Oldest first: two changes to different rows should reach Discogs in the
  // order they were made, even though nothing depends on it today.
  return jobs.sort((a, b) => a.queuedAt - b.queuedAt)
}

export async function dropJob(id: string): Promise<void> {
  const db = await openFidelityDb()
  await db.delete('outbox', id)
}

/**
 * Note that a run failed. Returns the job when it is out of attempts, so the
 * caller knows it has a value to put back.
 */
export async function noteFailure(id: string, reason: string): Promise<OutboxJob | null> {
  const db = await openFidelityDb()
  const job = await db.get('outbox', id)
  if (!job) return null

  const attempts = job.attempts + 1
  if (attempts >= MAX_ATTEMPTS) {
    await db.delete('outbox', id)
    return { ...job, attempts, lastError: reason }
  }

  await db.put('outbox', { ...job, attempts, lastError: reason })
  return null
}
