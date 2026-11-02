import { afterEach, describe, expect, it, vi } from 'vitest'

import { fieldValuesFor } from '~~/db/fields'
import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import { pendingJobs } from '~~/db/outbox'
import type { CollectionItem } from '#shared/types'
import { bulkEdit, bulkUndo, estimateMs } from '~~/worker/collection/bulk'
import { rateRecord } from '~~/worker/collection/rate'
import type { DiscogsClient } from '~~/worker/discogs/client'
import { DiscogsError } from '~~/worker/discogs/errors'
import { MIN_REQUEST_INTERVAL_MS } from '~~/worker/discogs/pacer'
import { drainOutbox } from '~~/worker/outbox'

/**
 * Bulk edit (#237): "240 changes · about 5 min in the background · Undo all".
 *
 * The estimate is the pacer's interval times what is queued, and the undo is
 * the part that has to be right: what has not gone out is cancelled for free,
 * what has gone out is reversed, and what is on its way is never cancelled
 * underneath the drain.
 */

afterEach(async () => {
  await deleteFidelityDb()
})

function record(instanceId: number, over: Partial<CollectionItem> = {}): CollectionItem {
  return {
    releaseId: instanceId + 1,
    masterId: 0,
    title: `Record ${instanceId}`,
    artistIds: [],
    artistNorms: ['someone'],
    artistNames: ['Someone'],
    labelIds: [],
    labelNorms: [],
    labelNames: [],
    catnos: [],
    genres: [],
    styles: [],
    formats: ['Vinyl'],
    year: 1990,
    thumbUrl: '',
    coverUrl: '',
    rating: 3,
    addedAt: '2024-01-01T00:00:00-00:00',
    instanceId,
    folderId: 1,
    ...over,
  }
}

async function shelf(...ids: number[]) {
  const db = await openFidelityDb()
  for (const id of ids) await db.put('collection', record(id))
  return db
}

const client = (write: () => Promise<unknown> = async () => null) =>
  ({
    write: vi.fn(write),
    get: vi.fn(async () => ({ releases: [] })),
  }) as unknown as DiscogsClient

describe('the estimate', () => {
  it('is one paced slot per request', () => {
    // The issue's own line: 240 changes is about five minutes.
    expect(estimateMs(240)).toBe(240 * MIN_REQUEST_INTERVAL_MS)
    expect(Math.round(estimateMs(240) / 60_000)).toBe(5)
    expect(estimateMs(0)).toBe(0)
  })

  it('counts only what changes, plus what is already waiting', async () => {
    await shelf(1, 2, 3)
    await rateRecord(3, 1)

    const result = await bulkEdit([1, 2, 3], { kind: 'rating', rating: 5 })

    expect(result.changed).toBe(3)
    expect(result.requests).toBe(3)
    // Copy 3's earlier tap folds into the same job, so three jobs wait, not four.
    expect(result.ms).toBe(3 * MIN_REQUEST_INTERVAL_MS)

    const again = await bulkEdit([1, 2, 3], { kind: 'rating', rating: 5 })
    expect(again.changed).toBe(0)
  })

  it('costs nothing for a place, which stays on this device', async () => {
    await shelf(1, 2)
    const result = await bulkEdit([1, 2], { kind: 'place', placeId: 'p1' })
    expect(result).toMatchObject({ changed: 2, requests: 0, ms: 0 })
    expect(await pendingJobs()).toEqual([])
  })

  it('skips a copy with no entry behind it', async () => {
    const db = await shelf(1)
    await db.put('collection', record(0))
    expect((await bulkEdit([0, 1], { kind: 'rating', rating: 5 })).changed).toBe(1)
  })
})

describe('undo all', () => {
  it('cancels what is still waiting, for free', async () => {
    const db = await shelf(1, 2)
    const { undo } = await bulkEdit([1, 2], { kind: 'rating', rating: 5 })

    expect(await bulkUndo(undo)).toEqual({ undone: 2, gone: 0 })
    expect((await db.get('collection', 1))?.rating).toBe(3)
    expect(await pendingJobs()).toEqual([])
  })

  it('reverses what has already gone out', async () => {
    const db = await shelf(1)
    const { undo } = await bulkEdit([1], { kind: 'rating', rating: 5 })
    await drainOutbox(client(), 'me')

    await bulkUndo(undo)

    expect((await db.get('collection', 1))?.rating).toBe(3)
    const [job] = await pendingJobs()
    expect(job?.payload.rating).toBe(3)
  })

  /*
   * The drain marks a job before it sends it. One that is marked is never
   * cancelled — the change is out there, so the way back is a second request.
   */
  it('never cancels a job that is on its way', async () => {
    await shelf(1)
    const { undo } = await bulkEdit([1], { kind: 'rating', rating: 5 })
    let undone: Promise<unknown> | undefined
    const fake = client(async () => {
      undone = bulkUndo(undo)
      await undone
      return null
    })

    await drainOutbox(fake, 'me')
    await undone

    // The 5 went; the 3 waits to follow it, under the same id.
    const [job] = await pendingJobs()
    expect(job?.payload.rating).toBe(3)
  })

  // A 401 filed nothing, so the job is ours to cancel again.
  it('cancels a job Discogs refused', async () => {
    const db = await shelf(1)
    const { undo } = await bulkEdit([1], { kind: 'remove' })
    await drainOutbox(
      client(async () => {
        throw new DiscogsError(401, 'You must authenticate to access this resource.')
      }),
      'me',
    )

    expect(await bulkUndo(undo)).toEqual({ undone: 1, gone: 0 })
    expect(await db.get('collection', 1)).toBeDefined()
    expect(await pendingJobs()).toEqual([])
  })

  it('keeps an older change folded into the same job', async () => {
    const db = await shelf(1)
    // Rated 4 by hand (still waiting, Discogs holds 3), then 5 for the whole selection.
    await rateRecord(1, 4)
    const { undo } = await bulkEdit([1], { kind: 'rating', rating: 5 })

    await bulkUndo(undo)

    expect((await db.get('collection', 1))?.rating).toBe(4)
    const [job] = await pendingJobs()
    expect(job?.payload.rating).toBe(4)
    expect(job?.revert.rating).toBe(3)
  })

  it('puts a grade, a folder and a place back', async () => {
    const db = await shelf(1, 2)
    const grade = await bulkEdit([1, 2], { kind: 'grade', grade: 'Very Good (VG)' })
    const folder = await bulkEdit([1, 2], { kind: 'folder', folderId: 7 })
    const place = await bulkEdit([1, 2], { kind: 'place', placeId: 'p1' })

    await bulkUndo(place.undo)
    await bulkUndo(folder.undo)
    await bulkUndo(grade.undo)

    expect((await db.get('collection', 1))?.folderId).toBe(1)
    expect((await fieldValuesFor(1))[1]).toBe('')
    expect((await db.get('placements', 1))?.placeId).toBeNull()
    expect(await pendingJobs()).toEqual([])
  })

  it('brings back a removal that has not gone, and says which have', async () => {
    const db = await shelf(1, 2)
    const { undo } = await bulkEdit([1, 2], { kind: 'remove' })
    expect(await db.get('collection', 1)).toBeUndefined()

    // One removal is already on its way when the undo comes.
    const out = await db.get('outbox', 'collection.remove:1')
    await db.put('outbox', { ...out!, sentAt: 1 })

    expect(await bulkUndo(undo)).toEqual({ undone: 1, gone: 1 })
    expect(await db.get('collection', 1)).toBeUndefined()
    expect(await db.get('collection', 2)).toBeDefined()
  })
})
