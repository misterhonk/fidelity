import { z } from 'zod'

import {
  dropJob,
  noteFailure,
  noteSending,
  OUTBOX_LOCK,
  pendingJobs,
  resolveConflict,
  valueOf,
} from '~~/db/outbox'
import { openFidelityDb } from '~~/db/open'
import { DiscogsError } from './discogs/errors'
import { fail } from './fail'
import { GONE_KEEP_MS, type OutboxJob, type OutboxKind } from '~~/db/schema'
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
  /** `signal` goes only to idempotent writes: one cut off in flight may simply be sent again. */
  send: (
    client: DiscogsClient,
    job: OutboxJob,
    username: string,
    signal?: AbortSignal,
  ) => Promise<void>
  /** Put the old value back locally, after the job has been given up on. */
  revert: (job: OutboxJob) => Promise<void>
  /**
   * Only for a job that must not be repeated: the ids of what it files, as they are now.
   *
   * Read before every attempt and kept with the job. A write whose answer
   * never got back through CORS looks exactly like one that never arrived, so
   * a job that files something new has to go and look instead of guessing —
   * an id that was not there before means it landed. Asking "is there any"
   * instead took a copy already on the shelf for the new one, and dropped it.
   */
  instances?: (client: DiscogsClient, job: OutboxJob, username: string) => Promise<number[]>
  /** With `instances`: what to do once the lookup has found the id the job filed. */
  landed?: (job: OutboxJob, instanceId: number) => Promise<void>
}

/** Discogs answers an add with the entry it filed (201). */
const addedSchema = z.object({ instance_id: z.number().int().positive() })

/**
 * The folder Discogs has an entry in right now, which is part of its address.
 *
 * Resolved when sending, not when queuing: a move still waiting has not
 * happened over there, and one that has landed is already in the local row.
 */
async function folderNow(instanceId: number, queued: number): Promise<number> {
  const db = await openFidelityDb()
  const move = await db.get('outbox', `collection.folder:${instanceId}`)
  if (move) return Number(move.payload.folderId)
  return (await db.get('collection', instanceId))?.folderId ?? queued
}

const KINDS: Record<OutboxKind, JobKind> = {
  'collection.rating': {
    send: async (client, job, username, signal) => {
      const { releaseId, folderId, instanceId, rating } = job.payload as {
        releaseId: number
        folderId: number
        instanceId: number
        rating: number
      }
      await client.write(
        'POST',
        `/users/${encodeURIComponent(username)}/collection/folders/${await folderNow(instanceId, folderId)}` +
          `/releases/${releaseId}/instances/${instanceId}`,
        // Sending the same rating twice leaves the same rating, so an
        // unreadable failure may simply be tried again.
        { body: { rating }, idempotent: true, signal },
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
    send: async (client, job, username, signal) => {
      const { releaseId, folderId, instanceId, fieldId, value } = job.payload as {
        releaseId: number
        folderId: number
        instanceId: number
        fieldId: number
        value: string
      }
      await client.write(
        'POST',
        `/users/${encodeURIComponent(username)}/collection/folders/${await folderNow(instanceId, folderId)}` +
          `/releases/${releaseId}/instances/${instanceId}/fields/${fieldId}`,
        // Setting a field to a value it already has is the same field with the
        // same value, so an unreadable failure may simply be tried again.
        { query: { value }, idempotent: true, signal },
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
    send: async (client, job, username, signal) => {
      const { releaseId, folderId, instanceId } = job.payload as {
        releaseId: number
        folderId: number
        instanceId: number
      }
      try {
        await client.write(
          'DELETE',
          `/users/${encodeURIComponent(username)}/collection/folders/${await folderNow(instanceId, folderId)}` +
            `/releases/${releaseId}/instances/${instanceId}`,
          // Deleting what is already gone is the state we wanted either way.
          { idempotent: true, signal },
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
      // No folder: queued before the chosen one was kept, when every add went to 1.
      const { releaseId, folderId = 1 } = job.payload as {
        releaseId: number
        folderId?: number
      }
      const answer = await client.write(
        'POST',
        `/users/${encodeURIComponent(username)}/collection/folders/${folderId}/releases/${releaseId}`,
        /*
         * The one call in the app that files something new.
         *
         * Discogs creates another instance every time, so a blind retry after
         * an unreadable failure puts the same record in the shelf twice —
         * weeks later, with nothing to connect it to a network blip. Hence
         * `instances` below, and hence this being false.
         */
        { idempotent: false },
      )
      // The record is over there now; the next sync (the read runs before the
      // drain since #238) fetches it back rather than leaving a half-built row.
      const { updateSyncState } = await import('~~/db/meta')
      await updateSyncState({ collectionSyncedAt: 0 })
      /*
       * Landed, but not said as what. Counted as a failure, so the job stays
       * marked: the next round looks, finds the new id and settles it there,
       * rather than leaving the copy under a key no sync ever replaces.
       */
      const added = addedSchema.safeParse(answer)
      if (!added.success) throw fail('malformed-payload', 'add answered without an instance id')
      const { settleCopy } = await import('./collection/add')
      await settleCopy(job, added.data.instance_id)
    },
    instances: async (client, job, username) => {
      const { releaseId } = job.payload as { releaseId: number }
      const { instancesOf } = await import('./collection/add')
      return instancesOf(client, username, releaseId)
    },
    landed: async (job, instanceId) => {
      const { settleCopy } = await import('./collection/add')
      await settleCopy(job, instanceId)
    },
    revert: async (job) => {
      /*
       * Under the key it was put there with, not `releaseId`: the sync keeps
       * keys at or below zero on purpose, so deleting the wrong one left a
       * record on the shelf for good, hiding it from every dig as owned.
       */
      const { dropCopy } = await import('./collection/add')
      await dropCopy(job)
    },
  },

  'wantlist.add': {
    send: async (client, job, username, signal) => {
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
        { idempotent: true, signal },
      )
    },
    revert: async (job) => {
      const { releaseId } = job.payload as { releaseId: number }
      const db = await openFidelityDb()
      await db.delete('wantlist', releaseId)
    },
  },

  'collection.folder': {
    send: async (client, job, username, signal) => {
      const { releaseId, folderId, instanceId, moveTo } = job.payload as {
        releaseId: number
        folderId: number
        instanceId: number
        moveTo: number
      }
      await client.write(
        'POST',
        `/users/${encodeURIComponent(username)}/collection/folders/${folderId}` +
          `/releases/${releaseId}/instances/${instanceId}`,
        // Moving a record where it already is leaves it where it is.
        { body: { folder_id: moveTo }, idempotent: true, signal },
      )
    },
    revert: async (job) => {
      const { instanceId } = job.payload as { instanceId: number }
      const { folderId } = job.revert as { folderId: number }
      const db = await openFidelityDb()
      const record = await db.get('collection', instanceId)
      if (record) await db.put('collection', { ...record, folderId })
    },
  },

  'wantlist.note': {
    send: async (client, job, username, signal) => {
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
        { body: { notes: note, rating: want }, idempotent: true, signal },
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
    send: async (client, job, username, signal) => {
      const { releaseId } = job.payload as { releaseId: number }
      try {
        await client.write(
          'DELETE',
          `/users/${encodeURIComponent(username)}/wants/${releaseId}`,
          { idempotent: true, signal },
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
  /** What those were about, by record title, so a screen can say which. */
  undone: string[]
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
  signal?: AbortSignal,
): Promise<DrainResult> {
  /*
   * One drain at a time, across every tab.
   *
   * The pacer's lock serialises requests, not jobs. Two drains — the keeper's
   * and the flush after a write, or two tabs — both read the same queued add
   * before either had dropped it, and both sent it: a second copy of the
   * record in somebody's Discogs collection (found 2026-10-21). Behind this
   * lock the second drain reads the queue after the first has emptied it.
   */
  const locks = globalThis.navigator?.locks
  const run = () => drainOnce(client, username, signal)
  if (!locks) return run()
  return signal ? locks.request(OUTBOX_LOCK, { signal }, run) : locks.request(OUTBOX_LOCK, run)
}

async function drainOnce(
  client: DiscogsClient,
  username: string,
  signal?: AbortSignal,
): Promise<DrainResult> {
  const jobs = await pendingJobs()
  let sent = 0
  let givenUp = 0
  const undone: string[] = []
  let waiting = 0

  const db = await openFidelityDb()
  for (const [index, queued] of jobs.entries()) {
    signal?.throwIfAborted()
    // Read again: a copy settled earlier this round has added its id to this job's instancesBefore.
    const job = await db.get('outbox', queued.id)
    if (!job) continue
    // Both sides changed it: nothing goes out until somebody says which (#238).
    if (job.conflict) {
      waiting += 1
      continue
    }
    try {
      const kind = KINDS[job.kind]
      if (kind.instances) {
        const now = await kind.instances(client, job, username)
        const before = new Set(job.instancesBefore)
        /*
         * Only a marked job can have gone out: every send is marked first, and
         * one that failed while looking never reached the POST. A mark without
         * ids predates them (0.114.1), and then any copy at all is taken for it.
         *
         * shortcut: the same release added elsewhere while ours never arrived
         * is a new id too, so the job is dropped and one copy lands, not two.
         * Nothing Discogs answers tells the two apart.
         */
        const landed = now.find((id) => !before.has(id))
        if (job.sentAt !== undefined && landed !== undefined) {
          await kind.landed?.(job, landed)
          await dropJob(job.id, job)
          sent += 1
          continue
        }
        await noteSending(job.id, Date.now(), now)
      }
      await kind.send(client, job, username, signal)
      await dropJob(job.id, job)
      sent += 1
    } catch (error) {
      // Cut off, not failed: the job stays as it was, and only idempotent writes ever see the signal.
      if (signal?.aborted && error instanceof Error && error.name === 'AbortError') throw error
      const reason = error instanceof Error ? error.message : String(error)
      const exhausted = await noteFailure(job.id, reason)
      if (exhausted) {
        // The job is already gone from the queue, so the revert must run whatever the name lookup does.
        undone.push(await titleOf(exhausted).catch(() => `#${exhausted.payload.releaseId}`))
        await KINDS[exhausted.kind].revert(exhausted)
        givenUp += 1
      } else {
        waiting += 1
      }
      // A real failure of a write sent without the signal is counted first, so the next drain looks before resending.
      signal?.throwIfAborted()
      // Offline, limited or unauthorised hits every job alike; anything else is this job's own.
      if (!(error instanceof DiscogsError) || error.code !== undefined) {
        return {
          sent,
          givenUp,
          undone: [...new Set(undone)],
          waiting: waiting + jobs.length - index - 1,
        }
      }
    }
  }

  // A rating and a move on the same record are still one record to name.
  return { sent, givenUp, undone: [...new Set(undone)], waiting }
}

/** The record a job is about — read before its revert takes the row away. */
async function titleOf(job: OutboxJob): Promise<string> {
  const { releaseId, instanceId } = job.payload
  // A removal carries the whole row it took off, since nothing local has it any more.
  const carried = job.revert.record ?? job.revert.want
  if (carried !== undefined) return (JSON.parse(String(carried)) as { title: string }).title
  const db = await openFidelityDb()
  const row = job.kind.startsWith('wantlist.')
    ? await db.get('wantlist', Number(releaseId))
    : // An add is still its provisional row: the payload's key, or `-releaseId` for an older one.
      await db.get('collection', Number(instanceId ?? -Number(releaseId)))
  return row?.title ?? `#${releaseId}`
}

/** One change waiting, as the outbox sheet shows it (#238). */
export interface OutboxChange {
  id: string
  kind: OutboxKind
  attempts: number
  lastError: string | null
  queuedAt: number
  /** What it sets, ready to read — a value has no language. Empty for an add or a removal. */
  ours: string
  /** Set when Discogs changed it too: what Discogs holds now. */
  theirs: string | null
}

export interface OutboxOverview {
  /** Grouped by record, oldest change first. */
  records: { key: string; title: string; changes: OutboxChange[] }[]
  /** Copies a full sync no longer found, kept 30 days with their place. */
  gone: { instanceId: number; title: string; place: string | null; until: number }[]
}

/** Everything still on its way, and everything gone — no request. */
export async function outboxOverview(): Promise<OutboxOverview> {
  const db = await openFidelityDb()
  const folders = (await db.get('meta', 'collectionFolders'))?.value
  const names = new Map(
    (Array.isArray(folders) ? folders : []).map((folder) => [folder.id, folder.name]),
  )
  const shown = (job: OutboxJob, value: Record<string, number | string> | undefined) => {
    if (!value) return ''
    if (job.kind === 'collection.rating') return '★'.repeat(Number(value.rating)) || '–'
    if (job.kind === 'collection.folder')
      return names.get(Number(value.folderId)) ?? `#${value.folderId}`
    if (job.kind === 'wantlist.note') return String(value.note)
    return String(value.value ?? '')
  }

  const records = new Map<string, OutboxOverview['records'][number]>()
  for (const job of await pendingJobs()) {
    const store = job.kind.startsWith('wantlist.') ? 'wantlist' : 'collection'
    const key = `${store}:${store === 'wantlist' ? job.payload.releaseId : (job.payload.instanceId ?? -Number(job.payload.releaseId))}`
    const record = records.get(key) ?? {
      key,
      title: await titleOf(job).catch(() => `#${job.payload.releaseId}`),
      changes: [],
    }
    record.changes.push({
      id: job.id,
      kind: job.kind,
      attempts: job.attempts,
      lastError: job.lastError ?? null,
      queuedAt: job.queuedAt,
      ours: shown(job, valueOf(job)),
      theirs: job.conflict ? shown(job, job.conflict.remote) : null,
    })
    records.set(key, record)
  }

  const gone: OutboxOverview['gone'] = []
  for (const entry of await db.getAll('gone')) {
    const placeId = (await db.get('placements', entry.instanceId))?.placeId
    const place = placeId ? await db.get('places', placeId) : undefined
    gone.push({
      instanceId: entry.instanceId,
      title: entry.record.title,
      place: place?.name ?? null,
      until: entry.goneAt + GONE_KEEP_MS,
    })
  }
  return { records: [...records.values()], gone: gone.sort((a, b) => a.until - b.until) }
}

/**
 * Keeps ours or takes Discogs' for a change in conflict. `theirs` puts
 * Discogs' value on the shelf the way giving up would put the old one back.
 */
export async function resolveOutboxConflict(
  id: string,
  keep: 'mine' | 'theirs',
): Promise<boolean> {
  const job = await resolveConflict(id, keep)
  if (!job) return false
  if (keep === 'theirs') await KINDS[job.kind].revert(job)
  return true
}
