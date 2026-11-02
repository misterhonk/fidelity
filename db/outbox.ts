import { openFidelityDb } from './open'
import { retryAfterPurge } from './quota'
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

/** Held by a drain, and by anything that must know which jobs it has not sent yet. */
export const OUTBOX_LOCK = 'fidelity:outbox'

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
  // The one write here that holds what nobody else has yet, so a full disk gives up covers for it.
  await retryAfterPurge(async () => {
    const tx = db.transaction('outbox', 'readwrite')
    const existing = await tx.store.get(job.id)
    // A pending move still sits in its old folder at Discogs, so that stays the address.
    const from = existing?.kind === 'collection.folder' ? existing.payload.folderId : undefined
    await tx.store.put({
      ...job,
      payload: from === undefined ? job.payload : { ...job.payload, folderId: from },
      revert: existing?.revert ?? job.revert,
      // A question about this copy stays asked until it is answered (#238).
      ...(existing?.conflict ? { conflict: existing.conflict } : {}),
      attempts: 0,
    })
    await tx.done
  })
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
  else {
    // What was sent is what Discogs holds now: the replacement's base, and what giving up puts back.
    const landed = valueOf(sent)
    await tx.store.put({
      ...stored,
      ...(landed ? { revert: landed } : {}),
      // The sent move has landed, so the replacement now starts where it put the record.
      ...(stored.kind === 'collection.folder' && sent.kind === 'collection.folder'
        ? { payload: { ...stored.payload, folderId: Number(sent.payload.moveTo) } }
        : {}),
    })
  }
  await tx.done
}

/**
 * Note that a write which may not be repeated is going out.
 *
 * A run cut off mid-send — the tab closed, the worker gone — counts no attempt,
 * and Discogs may have filed it all the same. This mark is what tells the next
 * run to look before it sends again.
 */
export async function noteSending(
  id: string,
  at: number,
  instancesBefore: number[],
): Promise<void> {
  const db = await openFidelityDb()
  const tx = db.transaction('outbox', 'readwrite')
  const job = await tx.store.get(id)
  if (job) await tx.store.put({ ...job, sentAt: at, instancesBefore })
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

type Value = Record<string, number | string>

/**
 * What a job sets, in the shape of its `revert` — so base, ours and Discogs'
 * can be compared like with like. `undefined` for a job that sets no value
 * (an add, a removal): there is nothing to merge, it just goes.
 */
export function valueOf(job: Pick<OutboxJob, 'kind' | 'payload'>): Value | undefined {
  const { payload } = job
  switch (job.kind) {
    case 'collection.rating':
      return { rating: Number(payload.rating) }
    case 'collection.folder':
      return { folderId: Number(payload.moveTo) }
    case 'collection.field':
      return { value: String(payload.value) }
    case 'wantlist.note':
      return { note: String(payload.note), want: Number(payload.want) }
    default:
      return undefined
  }
}

/**
 * Discogs' side of the same value, read off a synced row.
 *
 * `undefined` where the row does not say: a field (media, sleeve, notes) is
 * in no listing Discogs answers (docs/02, spike #235), so a field job is never
 * in conflict — it keeps going out as it did.
 */
export function remoteValueOf(
  job: Pick<OutboxJob, 'kind'>,
  row: { rating?: number; folderId?: number; note?: string; want?: number },
): Value | undefined {
  switch (job.kind) {
    case 'collection.rating':
      return row.rating === undefined ? undefined : { rating: row.rating }
    case 'collection.folder':
      return row.folderId === undefined ? undefined : { folderId: row.folderId }
    case 'wantlist.note':
      return row.note === undefined ? undefined : { note: row.note, want: row.want ?? 0 }
    default:
      return undefined
  }
}

export type Merge =
  /** Only we changed it, or Discogs says nothing: send ours. */
  | 'send'
  /** Discogs already holds ours: nothing left to send. */
  | 'settled'
  /** Only Discogs changed it: take theirs, drop ours. */
  | 'theirs'
  /** Both changed it, differently: ask. */
  | 'conflict'

const same = (a: Value, b: Value) =>
  Object.keys({ ...a, ...b }).every((key) => String(a[key]) === String(b[key]))

/**
 * The three-way merge, as a pure decision (#238).
 *
 * `base` is what Discogs held when the change was made (the job's `revert`),
 * `ours` the change, `theirs` what a sync just read. Ask only when both sides
 * moved away from the base and did not land on the same value.
 */
export function merge3(base: Value, ours: Value, theirs: Value | undefined): Merge {
  // Not knowing what Discogs holds is not knowing that ours is already there.
  if (theirs === undefined) return 'send'
  if (same(theirs, base)) return same(ours, base) ? 'settled' : 'send'
  if (same(theirs, ours)) return 'settled'
  if (same(ours, base)) return 'theirs'
  return 'conflict'
}

/**
 * Answers the question a conflict asked.
 *
 * `mine` keeps ours and sends it, now over what Discogs holds (the new base).
 * `theirs` drops ours and hands back the job, whose `revert` now holds
 * Discogs' value — the caller puts that on the shelf (`worker/outbox.ts`).
 */
export async function resolveConflict(
  id: string,
  keep: 'mine' | 'theirs',
): Promise<OutboxJob | null> {
  const db = await openFidelityDb()
  const tx = db.transaction('outbox', 'readwrite')
  const job = await tx.store.get(id)
  if (!job?.conflict) {
    await tx.done
    return null
  }
  const { conflict, ...rest } = job
  // A move is addressed by the folder the copy is in, and that is Discogs' one now.
  const payload =
    job.kind === 'collection.folder'
      ? { ...job.payload, folderId: Number(conflict.remote.folderId) }
      : job.payload
  if (keep === 'mine')
    await tx.store.put({ ...rest, payload, revert: conflict.remote, attempts: 0 })
  else await tx.store.delete(id)
  await tx.done
  return { ...rest, revert: conflict.remote }
}
