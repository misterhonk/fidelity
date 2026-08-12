import { dropJob, noteFailure, pendingJobs } from '~~/db/outbox'
import { openFidelityDb } from '~~/db/open'
import { DiscogsError } from './discogs/errors'
import type { OutboxJob, OutboxKind } from '~~/db/schema'
import type { WantlistItem } from '#shared/types'
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
  /**
   * Only for a job that must not be repeated: has it already happened?
   *
   * Asked before every attempt but the first. A write whose answer never got
   * back through CORS looks exactly like one that never arrived, so a job that
   * files something new has to go and look instead of guessing — otherwise the
   * retry puts the same record in the shelf a second time.
   */
  alreadyDone?: (client: DiscogsClient, job: OutboxJob, username: string) => Promise<boolean>
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
      const { instanceId } = job.payload as { instanceId: number }
      const { rating } = job.revert as { rating: number }
      const db = await openFidelityDb()
      const record = await db.get('collection', instanceId)
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
      const { instanceId, fieldId } = job.payload as { instanceId: number; fieldId: number }
      const { value } = job.revert as { value: string }
      const { writeFieldValue } = await import('~~/db/fields')
      await writeFieldValue(instanceId, fieldId, value)
    },
  },

  'collection.remove': {
    send: async (client, job, username) => {
      const { releaseId, folderId, instanceId } = job.payload as {
        releaseId: number
        folderId: number
        instanceId: number
      }
      try {
        await client.write(
          'DELETE',
          `/users/${encodeURIComponent(username)}/collection/folders/${folderId}` +
            `/releases/${releaseId}/instances/${instanceId}`,
          // Deleting what is already gone is the state we wanted either way.
          { idempotent: true },
        )
      } catch (error) {
        // 404 means somebody — this app on another device, or Discogs' own
        // site — got there first. That is the outcome, not a failure.
        if (error instanceof DiscogsError && error.status === 404) return
        throw error
      }
    },
    revert: async (job) => {
      // Put the record back on the shelf exactly as it was taken off.
      const { restoreRecord } = await import('./collection/remove')
      await restoreRecord(job)
    },
  },

  'collection.add': {
    send: async (client, job, username) => {
      const { releaseId } = job.payload as { releaseId: number }
      await client.write(
        'POST',
        `/users/${encodeURIComponent(username)}/collection/folders/1/releases/${releaseId}`,
        /*
         * The one call in the app that files something new.
         *
         * Discogs creates another instance every time, so a blind retry after
         * an unreadable failure puts the same record in the shelf twice —
         * weeks later, with nothing to connect it to a network blip. Hence
         * `alreadyDone` below, and hence this being false.
         */
        { idempotent: false },
      )
      // The record is over there now; let the same keeper round fetch it back
      // properly rather than leaving a half-built row behind.
      const { updateSyncState } = await import('~~/db/meta')
      await updateSyncState({ collectionSyncedAt: 0 })
    },
    alreadyDone: async (client, job, username) => {
      const { releaseId } = job.payload as { releaseId: number }
      const { ownsRelease } = await import('./collection/add')
      return ownsRelease(client, username, releaseId)
    },
    revert: async (job) => {
      const { releaseId } = job.payload as { releaseId: number }
      const db = await openFidelityDb()
      await db.delete('collection', releaseId)
    },
  },

  'wantlist.add': {
    send: async (client, job, username) => {
      const { releaseId } = job.payload as { releaseId: number }
      await client.write(
        'PUT',
        `/users/${encodeURIComponent(username)}/wants/${releaseId}`,
        /*
         * Idempotent, and measured rather than assumed: a PUT on a release
         * already in the wantlist came back 201 with `date_added` unchanged
         * (2026-08-11, docs/02). Unlike the collection, a want is addressed by
         * release alone — there is no second instance to create, so there is
         * nothing a repeat can duplicate.
         */
        { idempotent: true },
      )
    },
    revert: async (job) => {
      const { releaseId } = job.payload as { releaseId: number }
      const db = await openFidelityDb()
      await db.delete('wantlist', releaseId)
    },
  },

  'wantlist.note': {
    send: async (client, job, username) => {
      const { releaseId, note, want } = job.payload as {
        releaseId: number
        note: string
        want: number
      }
      await client.write(
        'POST',
        `/users/${encodeURIComponent(username)}/wants/${releaseId}`,
        // Setting the same note twice leaves the same note. Both fields go
        // together because the endpoint takes them together — sending only one
        // would clear the other.
        { body: { notes: note, rating: want }, idempotent: true },
      )
    },
    revert: async (job) => {
      const { releaseId } = job.payload as { releaseId: number }
      const { note, want } = job.revert as { note: string; want: number }
      const db = await openFidelityDb()
      const stored = await db.get('wantlist', releaseId)
      if (stored) await db.put('wantlist', { ...stored, note, want })
    },
  },

  'wantlist.remove': {
    send: async (client, job, username) => {
      const { releaseId } = job.payload as { releaseId: number }
      try {
        await client.write(
          'DELETE',
          `/users/${encodeURIComponent(username)}/wants/${releaseId}`,
          {
            idempotent: true,
          },
        )
      } catch (error) {
        if (error instanceof DiscogsError && error.status === 404) return
        throw error
      }
    },
    revert: async (job) => {
      const { want } = job.revert as { want: string }
      const db = await openFidelityDb()
      await db.put('wantlist', JSON.parse(want) as WantlistItem)
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
      const kind = KINDS[job.kind]
      // Never on the first run: looking costs a paced request, and the first
      // attempt has nothing to look for.
      if (job.attempts > 0 && (await kind.alreadyDone?.(client, job, username))) {
        await dropJob(job.id)
        sent += 1
        continue
      }
      await kind.send(client, job, username)
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
