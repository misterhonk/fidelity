import { afterEach, describe, expect, it } from 'vitest'

import { pendingJobs } from '~~/db/outbox'
import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import type { CollectionItem } from '#shared/types'
import { rateRecord } from '~~/worker/collection/rate'

/**
 * Giving a record of your own a rating.
 *
 * The shelf is written first and Discogs catches up, so what this has to get
 * right is the two cases where writing first would be a lie: a record that
 * cannot be written to at all, and a "change" that changes nothing.
 */

afterEach(async () => {
  await deleteFidelityDb()
})

function record(over: Partial<CollectionItem> = {}): CollectionItem {
  return {
    releaseId: 7,
    masterId: 0,
    title: 'Kind Of Blue',
    artistIds: [],
    artistNorms: [],
    artistNames: ['Miles Davis'],
    labelIds: [],
    labelNorms: [],
    labelNames: ['Columbia'],
    catnos: [],
    genres: [],
    styles: [],
    formats: ['Vinyl'],
    year: 1959,
    thumbUrl: '',
    coverUrl: '',
    rating: 0,
    addedAt: '2024-01-01T00:00:00-00:00',
    instanceId: 900,
    folderId: 1,
    ...over,
  }
}

async function store(item: CollectionItem) {
  const db = await openFidelityDb()
  await db.put('collection', item)
}

describe('rating a record you own', () => {
  it('writes the shelf now and leaves the request to the queue', async () => {
    await store(record())

    expect(await rateRecord(7, 4)).toBe(true)

    const db = await openFidelityDb()
    expect((await db.get('collection', 7))?.rating).toBe(4)

    const [job] = await pendingJobs()
    expect(job?.payload).toEqual({ releaseId: 7, folderId: 1, instanceId: 900, rating: 4 })
    expect(job?.revert).toEqual({ rating: 0 })
  })

  it('lets a rating be taken back, because zero is a state', async () => {
    await store(record({ rating: 5 }))

    await rateRecord(7, 0)

    const db = await openFidelityDb()
    expect((await db.get('collection', 7))?.rating).toBe(0)
    expect((await pendingJobs())[0]?.payload.rating).toBe(0)
  })

  /*
   * A record synced before entry ids were kept has nothing to address, and the
   * request would fail with a message nobody could act on. Saying no here is
   * what lets the sheet leave the stars out instead of offering a button that
   * does nothing.
   */
  it('refuses a record with no entry, rather than pretending', async () => {
    await store(record({ instanceId: 0, folderId: 0 }))

    expect(await rateRecord(7, 4)).toBe(false)

    const db = await openFidelityDb()
    expect((await db.get('collection', 7))?.rating).toBe(0)
    expect(await pendingJobs()).toEqual([])
  })

  it('spends nothing when the rating is the one already there', async () => {
    await store(record({ rating: 3 }))

    expect(await rateRecord(7, 3)).toBe(true)

    expect(await pendingJobs()).toEqual([])
  })
})
