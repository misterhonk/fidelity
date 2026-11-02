import { fieldValuesFor, writeFieldValue } from '~~/db/fields'
import { openFidelityDb } from '~~/db/open'
import { pendingJobs, takeBack } from '~~/db/outbox'
import { isOwnEntry } from '#shared/types'
import { MIN_REQUEST_INTERVAL_MS } from '../discogs/pacer'
import { placeOf, placeRecords } from '../places'
import { moveToFolder } from './folders'
import { rateRecord } from './rate'
import { setFieldValue } from './fields'
import { removeRecord, restoreRecord } from './remove'

/**
 * One change to many copies at once (#237) — and the way back from all of it.
 *
 * Nothing new goes to Discogs here: each copy takes the same path a single tap
 * takes (rate, grade, move, remove), so the outbox paces it through the one
 * slot (rule 3) and puts the old value back if it never lands. What this adds
 * is the count, the time it will take, and an undo that cancels what has not
 * gone out yet instead of sending a second request to reverse it.
 */

export type BulkChange =
  | { kind: 'place'; placeId: string | null }
  | { kind: 'rating'; rating: number }
  /** Media condition — Discogs' field 1 on every account. */
  | { kind: 'grade'; grade: string }
  | { kind: 'folder'; folderId: number }
  | { kind: 'remove' }

/** What each changed copy was before, which is everything the undo needs. */
export interface BulkUndo {
  kind: BulkChange['kind']
  was: { instanceId: number; value: string | number | null }[]
}

export interface BulkResult {
  /** Copies that actually changed — one already at the value is not counted. */
  changed: number
  /** Discogs requests this queued. Zero for a place, which stays on this device. */
  requests: number
  /** About how long until the last of them has gone, queue ahead included. */
  ms: number
  undo: BulkUndo
}

const MEDIA = 1

/**
 * How long the queue takes to empty: one request per paced slot.
 *
 * Writes need a token, so the interval is the signed-in one. Everything already
 * waiting goes first (the outbox is oldest first), so it counts too.
 */
export function estimateMs(requests: number, interval = MIN_REQUEST_INTERVAL_MS): number {
  return requests * interval
}

export async function bulkEdit(instanceIds: number[], change: BulkChange): Promise<BulkResult> {
  const db = await openFidelityDb()
  const was: BulkUndo['was'] = []

  if (change.kind === 'place') {
    for (const instanceId of instanceIds) {
      const before = await placeOf(instanceId)
      if (before !== change.placeId) was.push({ instanceId, value: before })
    }
    await placeRecords(
      was.map((step) => step.instanceId),
      change.placeId,
    )
    return { changed: was.length, requests: 0, ms: 0, undo: { kind: 'place', was } }
  }

  for (const instanceId of instanceIds) {
    const record = await db.get('collection', instanceId)
    if (!record || !isOwnEntry(record)) continue
    switch (change.kind) {
      case 'rating':
        if (record.rating === change.rating) continue
        was.push({ instanceId, value: record.rating })
        await rateRecord(instanceId, change.rating)
        break
      case 'grade': {
        const before = (await fieldValuesFor(instanceId))[MEDIA] ?? ''
        if (before === change.grade) continue
        was.push({ instanceId, value: before })
        await setFieldValue(instanceId, MEDIA, change.grade)
        break
      }
      case 'folder':
        if (record.folderId === change.folderId) continue
        was.push({ instanceId, value: record.folderId })
        await moveToFolder(instanceId, change.folderId)
        break
      case 'remove':
        was.push({ instanceId, value: null })
        await removeRecord(instanceId)
        break
    }
  }

  const waiting = (await pendingJobs()).length
  return {
    changed: was.length,
    requests: was.length,
    ms: estimateMs(waiting),
    undo: { kind: change.kind, was },
  }
}

export interface UndoResult {
  /** Put back on this device; those already sent get a reversal queued. */
  undone: number
  /** Removals that had already gone out — Discogs has filed them, and a new add would be another copy. */
  gone: number
}

/**
 * Puts every copy back.
 *
 * A change still waiting is cancelled, which costs nothing — unless something
 * older was waiting under the same id, since the outbox folds two changes to
 * one copy into one job. Then the job is re-pointed at the old value instead,
 * because Discogs still holds the value before *that*. A change already sent,
 * or on its way, gets the old value queued like any other tap.
 */
export async function bulkUndo(undo: BulkUndo): Promise<UndoResult> {
  const db = await openFidelityDb()
  let undone = 0
  let gone = 0

  if (undo.kind === 'place') {
    const byPlace = new Map<string | null, number[]>()
    for (const { instanceId, value } of undo.was) {
      const place = value === null ? null : String(value)
      byPlace.set(place, [...(byPlace.get(place) ?? []), instanceId])
    }
    for (const [placeId, instanceIds] of byPlace) await placeRecords(instanceIds, placeId)
    return { undone: undo.was.length, gone: 0 }
  }

  for (const { instanceId, value } of undo.was) {
    switch (undo.kind) {
      case 'rating': {
        const rating = Number(value)
        const taken = await takeBack(
          `collection.rating:${instanceId}`,
          (job) => Number(job.revert.rating) === rating,
        )
        const record = await db.get('collection', instanceId)
        if (taken && record) await db.put('collection', { ...record, rating })
        else await rateRecord(instanceId, rating)
        break
      }
      case 'grade': {
        const grade = String(value)
        const taken = await takeBack(
          `collection.field:${instanceId}:${MEDIA}`,
          (job) => String(job.revert.value) === grade,
        )
        if (taken) await writeFieldValue(instanceId, MEDIA, grade)
        else await setFieldValue(instanceId, MEDIA, grade)
        break
      }
      case 'folder': {
        const folderId = Number(value)
        // Still addressed from the old folder, so cancelling leaves Discogs where it was.
        const taken = await takeBack(
          `collection.folder:${instanceId}`,
          (job) => Number(job.payload.folderId) === folderId,
        )
        const record = await db.get('collection', instanceId)
        if (taken && record) await db.put('collection', { ...record, folderId })
        else await moveToFolder(instanceId, folderId)
        break
      }
      case 'remove': {
        const taken = await takeBack(`collection.remove:${instanceId}`)
        if (!taken) {
          gone += 1
          continue
        }
        await restoreRecord(taken)
        break
      }
    }
    undone += 1
  }
  return { undone, gone }
}
