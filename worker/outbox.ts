import { dropJob, noteFailure, pendingJobs } from '~~/db/outbox'
import { openFidelityDb } from '~~/db/open'
import type { OutboxJob, OutboxKind } from '~~/db/schema'
import type { DiscogsClient } from './discogs/client'

/**
 * Getting what the app already shows to Discogs.
 *
 * The shelf was written the moment the collector tapped; this is the part
 * that catches up, in the background, through the one paced slot. Nothing
 * here is urgent — a rating that lands four minutes late is a rating that
 * landed — so the drain runs where the keeper runs and never in front of
 * somebody waiting for a screen.
 */

interface JobKind {
  /** Where it goes, and whether repeating it is harmless. See WriteOptions. */
  send: (client: DiscogsClient, job: OutboxJob, username: string) => Promise<void>
  /** Put the old value back locally, after the job has been given up on. */
  revert: (job: OutboxJob) => Promise<void>
}

const KINDS: Record<OutboxKind, JobKind> = {
  'collection.rating': {
    send: async (client, job, username) => {
      const { releaseId, folderId, instanceId, rating } = job.payload as {
        releaseId: number
        folderId: number
        instanceId: number
        rating: number
      }
      await client.write(
        'POST',
        `/users/${encodeURIComponent(username)}/collection/folders/${folderId}` +
          `/releases/${releaseId}/instances/${instanceId}`,
        // Sending the same rating twice leaves the same rating, so an
        // unreadable failure may simply be tried again.
        { body: { rating }, idempotent: true },
      )
    },
    revert: async (job) => {
      const { releaseId } = job.payload as { releaseId: number }
      const { rating } = job.revert as { rating: number }
      const db = await openFidelityDb()
      const record = await db.get('collection', releaseId)
      if (record) await db.put('collection', { ...record, rating })
    },
  },

  'collection.field': {
    send: async (client, job, username) => {
      const { releaseId, folderId, instanceId, fieldId, value } = job.payload as {
        releaseId: number
        folderId: number
        instanceId: number
        fieldId: number
        value: string
      }
      await client.write(
        'POST',
        `/users/${encodeURIComponent(username)}/collection/folders/${folderId}` +
          `/releases/${releaseId}/instances/${instanceId}/fields/${fieldId}`,
        // Setting a field to a value it already has is the same field with the
        // same value, so an unreadable failure may simply be tried again.
        { query: { value }, idempotent: true },
      )
    },
    revert: async (job) => {
      const { releaseId, fieldId } = job.payload as { releaseId: number; fieldId: number }
      const { value } = job.revert as { value: string }
      const { writeFieldValue } = await import('~~/db/fields')
      await writeFieldValue(releaseId, fieldId, value)
    },
  },
}

export interface DrainResult {
  sent: number
  /** Jobs that ran out of attempts. Their local value has been put back. */
  givenUp: number
  /** Still queued — failed this round, or never reached. */
  waiting: number
}

/**
 * Works the queue once.
 *
 * One job at a time on purpose: they share the single Discogs slot anyway, and
 * a serial loop means a job that fails does not take the rest of the round
 * with it. The first unreadable failure does stop the round, though — if
 * Discogs is unreachable or the limit is hit, the remaining jobs would only
 * burn their attempts against the same wall.
 */
export async function drainOutbox(
  client: DiscogsClient,
  username: string,
): Promise<DrainResult> {
  const jobs = await pendingJobs()
  let sent = 0
  let givenUp = 0

  for (const [index, job] of jobs.entries()) {
    try {
      await KINDS[job.kind].send(client, job, username)
      await dropJob(job.id)
      sent += 1
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      const exhausted = await noteFailure(job.id, reason)
      if (exhausted) {
        await KINDS[exhausted.kind].revert(exhausted)
        givenUp += 1
      }
      return { sent, givenUp, waiting: jobs.length - index - (exhausted ? 1 : 0) }
    }
  }

  return { sent, givenUp, waiting: 0 }
}
