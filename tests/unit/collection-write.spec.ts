import { afterEach, describe, expect, it, vi } from 'vitest'

import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import { MAX_ATTEMPTS, pendingJobs } from '~~/db/outbox'
import type { CollectionItem, Match } from '#shared/types'
import { addRecord } from '~~/worker/collection/add'
import { removeRecord } from '~~/worker/collection/remove'
import type { DiscogsClient } from '~~/worker/discogs/client'
import { DiscogsError } from '~~/worker/discogs/errors'
import { drainOutbox } from '~~/worker/outbox'

/**
 * Taking a record off the shelf, and putting one on it.
 *
 * The two ends of the same feature, and the two hardest cases in the whole
 * write path: one destroys something on a real account, the other is the only
 * call that files something new and so the only one a retry can duplicate.
 */

afterEach(async () => {
  await deleteFidelityDb()
})

function record(over: Partial<CollectionItem> = {}): CollectionItem {
  return {
    releaseId: 11,
    masterId: 0,
    title: 'Loveless',
    artistIds: [],
    artistNorms: ['my bloody valentine'],
    artistNames: ['My Bloody Valentine'],
    labelIds: [],
    labelNorms: [],
    labelNames: ['Creation'],
    catnos: [],
    genres: [],
    styles: [],
    formats: ['Vinyl'],
    year: 1991,
    thumbUrl: '',
    coverUrl: '',
    rating: 5,
    addedAt: '2024-01-01T00:00:00-00:00',
    instanceId: 640,
    folderId: 1,
    ...over,
  }
}

function match(over: Partial<Match> = {}): Match {
  return {
    digId: 'd1',
    listingId: 99,
    releaseId: 12,
    score: 70,
    signals: [],
    title: 'Isn’t Anything',
    artist: 'My Bloody Valentine',
    label: 'Creation',
    catno: 'CRELP 040',
    format: 'Vinyl, LP',
    year: 1988,
    condition: null,
    sleeve: null,
    price: null,
    currency: null,
    comments: null,
    thumbUrl: null,
    marketLowestPrice: null,
    marketNumForSale: null,
    expired: false,
    ...over,
  }
}

const client = (impl: { write?: () => Promise<unknown>; get?: () => Promise<unknown> } = {}) =>
  ({
    write: vi.fn(impl.write ?? (async () => null)),
    get: vi.fn(impl.get ?? (async () => ({ releases: [] }))),
  }) as unknown as DiscogsClient

describe('taking a record off the shelf', () => {
  it('goes at once and carries the row with it', async () => {
    const db = await openFidelityDb()
    await db.put('collection', record())

    expect(await removeRecord(11)).toBe(true)
    expect(await db.get('collection', 11)).toBeUndefined()

    const [job] = await pendingJobs()
    expect(JSON.parse(String(job?.revert.record)).title).toBe('Loveless')
  })

  /*
   * The row has to be carried, not just its id: Discogs cannot hand back what
   * it never deleted, so if the delete is given up on, this copy is the only
   * way the record returns to the shelf it was taken from.
   */
  it('puts the record back when the delete is given up on', async () => {
    const db = await openFidelityDb()
    await db.put('collection', record())
    await removeRecord(11)

    const fake = client({
      write: async () => {
        throw new DiscogsError(0, 'Discogs antwortet nicht')
      },
    })
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      await drainOutbox(fake, 'mrtnmlchr')
    }

    expect((await db.get('collection', 11))?.rating).toBe(5)
  })

  /*
   * Somebody else got there first — this app on another device, or Discogs'
   * own site. The shelf already agrees with the world, so a 404 is the
   * outcome we wanted and not a failure to retry five times.
   */
  it('treats "already gone" as done', async () => {
    const db = await openFidelityDb()
    await db.put('collection', record())
    await removeRecord(11)

    const fake = client({
      write: async () => {
        throw new DiscogsError(404, 'The requested collection item does not exist.')
      },
    })

    expect((await drainOutbox(fake, 'mrtnmlchr')).sent).toBe(1)
    expect(await pendingJobs()).toEqual([])
  })
})

describe('putting a bought record on the shelf', () => {
  it('shows it straight away, with no entry until the sync has been round', async () => {
    expect(await addRecord(match())).toBe(true)

    const db = await openFidelityDb()
    const stored = await db.get('collection', 12)
    expect(stored?.title).toBe('Isn’t Anything')
    // Provisional: nothing to write to until Discogs has been asked properly.
    expect(stored?.instanceId).toBe(0)
  })

  it('refuses a record already on the shelf, rather than filing a second copy', async () => {
    const db = await openFidelityDb()
    await db.put('collection', record({ releaseId: 12 }))

    expect(await addRecord(match())).toBe(false)
    expect(await pendingJobs()).toEqual([])
  })

  /*
   * Six hours on, a find no longer knows what the record was called — title
   * and artist are marketplace fields and expiry nulls them (rule 4). A
   * nameless row in somebody's shelf is worse than no row.
   */
  it('refuses a find whose six hours are up', async () => {
    expect(await addRecord(match({ title: null, artist: null, expired: true }))).toBe(false)
  })

  /*
   * The one that earns this file.
   *
   * Adding files a new entry every time. After an unreadable failure the
   * question is not "did it work", which cannot be known, but "is it there
   * now", which can — so the second attempt looks instead of sending.
   */
  it('looks instead of sending again, once a run has already failed', async () => {
    await addRecord(match())

    const write = vi.fn(async () => {
      throw new DiscogsError(0, 'Discogs antwortet nicht')
    })
    const get = vi.fn(async () => ({ releases: [{ id: 12 }] }))
    const fake = { write, get } as unknown as DiscogsClient

    await drainOutbox(fake, 'mrtnmlchr')
    const second = await drainOutbox(fake, 'mrtnmlchr')

    expect(write).toHaveBeenCalledTimes(1)
    expect(get).toHaveBeenCalledTimes(1)
    expect(second.sent).toBe(1)
    expect(await pendingJobs()).toEqual([])
  })

  it('leaves it queued when the lookup itself cannot be read', async () => {
    await addRecord(match())

    const fake = client({
      write: async () => {
        throw new DiscogsError(0, 'Discogs antwortet nicht')
      },
      get: async () => {
        throw new DiscogsError(0, 'Discogs antwortet nicht')
      },
    })

    await drainOutbox(fake, 'mrtnmlchr')
    await drainOutbox(fake, 'mrtnmlchr')

    // Not knowing is not knowing it is absent — sending again on a guess is
    // exactly the duplicate this whole mechanism exists to prevent.
    expect((fake.write as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1)
    // And above all: still queued, not dropped as though it had landed.
    expect(await pendingJobs()).toHaveLength(1)
    expect((await pendingJobs())[0]?.attempts).toBe(2)
  })
})
