import { afterEach, describe, expect, it, vi } from 'vitest'

import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import { MAX_ATTEMPTS, pendingJobs } from '~~/db/outbox'
import type { CollectionItem, Match } from '#shared/types'
import { addCopy, addRecord } from '~~/worker/collection/add'
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

    expect(await removeRecord(640)).toBe(true)
    expect(await db.get('collection', 640)).toBeUndefined()

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
    await removeRecord(640)

    const fake = client({
      write: async () => {
        throw new DiscogsError(0, 'Discogs is not answering')
      },
    })
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      await drainOutbox(fake, 'mrtnmlchr')
    }

    expect((await db.get('collection', 640))?.rating).toBe(5)
  })

  /*
   * Somebody else got there first — this app on another device, or Discogs'
   * own site. The shelf already agrees with the world, so a 404 is the
   * outcome we wanted and not a failure to retry five times.
   */
  it('treats "already gone" as done', async () => {
    const db = await openFidelityDb()
    await db.put('collection', record())
    await removeRecord(640)

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
    // Under a negative key of its own — see `collection/add.ts`. Nothing to
    // write to until Discogs has named the entry.
    const [stored] = await db.getAllFromIndex('collection', 'by-release', 12)
    expect(stored?.title).toBe('Isn’t Anything')
    expect(stored?.instanceId).toBeLessThan(0)
    expect(stored?.folderId).toBe(1)
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
      throw new DiscogsError(0, 'Discogs is not answering')
    })
    // None before the add went out, one when the next run looks.
    const get = vi
      .fn()
      .mockResolvedValueOnce({ releases: [] })
      .mockResolvedValue({ releases: [{ id: 12, instance_id: 5 }] })
    const fake = { write, get } as unknown as DiscogsClient

    await drainOutbox(fake, 'mrtnmlchr')
    const second = await drainOutbox(fake, 'mrtnmlchr')

    expect(write).toHaveBeenCalledTimes(1)
    expect(get).toHaveBeenCalledTimes(2)
    expect(second.sent).toBe(1)
    expect(await pendingJobs()).toEqual([])
  })

  /*
   * And a run that never got to fail. Closing the tab while the POST is out
   * counts no attempt, and Discogs may have filed it all the same: the next
   * start sent it again, and the shelf had two copies.
   */
  it('marks an add before it goes out, so a run cut off mid-send looks next time', async () => {
    await addRecord(match())
    let marked: number | undefined
    const fake = client({
      write: async () => {
        marked = (await pendingJobs())[0]?.sentAt
        return null
      },
    })

    await drainOutbox(fake, 'mrtnmlchr')

    expect(marked).toBeTypeOf('number')
  })

  it('looks instead of sending when the last run was cut off mid-send', async () => {
    await addRecord(match())
    const db = await openFidelityDb()
    const [job] = await pendingJobs()
    await db.put('outbox', { ...job!, sentAt: 1 })
    // Marked before ids were kept: any copy at all is taken for it.
    const fake = client({ get: async () => ({ releases: [{ id: 12, instance_id: 5 }] }) })

    const result = await drainOutbox(fake, 'mrtnmlchr')

    expect(fake.write).not.toHaveBeenCalled()
    expect(result.sent).toBe(1)
    expect(await pendingJobs()).toEqual([])
  })

  /*
   * A second copy of a record already on the shelf over there.
   *
   * "Owns at least one" was taken for "this add arrived", so after an
   * unreadable failure the copy that was already there swallowed the new one
   * and the job was dropped. The copies before sending are what tell them apart.
   */
  it('sends a second copy again after an unreadable failure, instead of taking the first for it', async () => {
    await addRecord(match())
    const write = vi
      .fn()
      .mockRejectedValueOnce(new DiscogsError(0, 'Discogs is not answering'))
      .mockResolvedValue({ instance_id: 2 })
    const fake = client({
      write,
      get: async () => ({ releases: [{ id: 12, instance_id: 1 }] }),
    })

    await drainOutbox(fake, 'mrtnmlchr')
    expect((await pendingJobs())[0]?.instancesBefore).toEqual([1])
    const second = await drainOutbox(fake, 'mrtnmlchr')

    expect(write).toHaveBeenCalledTimes(2)
    expect(second.sent).toBe(1)
    expect(await pendingJobs()).toEqual([])
  })

  it('takes a copy it has not seen for the add having landed', async () => {
    await addRecord(match())
    const fake = client({
      write: async () => {
        throw new DiscogsError(0, 'Discogs is not answering')
      },
    })
    ;(fake.get as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ releases: [{ id: 12, instance_id: 1 }] })
      .mockResolvedValue({
        releases: [
          { id: 12, instance_id: 1 },
          { id: 12, instance_id: 2 },
        ],
      })

    await drainOutbox(fake, 'mrtnmlchr')
    const second = await drainOutbox(fake, 'mrtnmlchr')

    expect(fake.write).toHaveBeenCalledTimes(1)
    expect(second.sent).toBe(1)
  })

  /*
   * Ours landed and another copy went in the meantime — on discogs.com, or a
   * queued removal that went first. A count stays the same and sends ours
   * again; the id that was not there before says it arrived.
   */
  it('sees its copy arrive even when another one went in the meantime', async () => {
    await addRecord(match())
    const fake = client({
      write: async () => {
        throw new DiscogsError(0, 'Discogs is not answering')
      },
    })
    ;(fake.get as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ releases: [{ id: 12, instance_id: 1 }] })
      .mockResolvedValue({ releases: [{ id: 12, instance_id: 2 }] })

    await drainOutbox(fake, 'mrtnmlchr')
    const second = await drainOutbox(fake, 'mrtnmlchr')

    expect(fake.write).toHaveBeenCalledTimes(1)
    expect(second.sent).toBe(1)
  })

  /*
   * The look before the very first send fails, and Discogs already holds a
   * copy. Nothing went out — no mark — so the copy there is not ours, and the
   * add still has to be sent.
   */
  it('sends after a first lookup that failed, though a copy is already there', async () => {
    await addRecord(match())
    const fake = client({ write: async () => ({ instance_id: 2 }) })
    ;(fake.get as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new DiscogsError(0, 'Discogs is not answering'))
      .mockResolvedValue({ releases: [{ id: 12, instance_id: 1 }] })

    await drainOutbox(fake, 'mrtnmlchr')
    const second = await drainOutbox(fake, 'mrtnmlchr')

    expect(fake.write).toHaveBeenCalledTimes(1)
    expect(second.sent).toBe(1)
  })

  it('names the record when it gives up and takes it off the shelf again', async () => {
    await addRecord(match())
    const fake = client({
      write: async () => {
        throw new DiscogsError(0, 'Discogs is not answering')
      },
    })

    let last = await drainOutbox(fake, 'mrtnmlchr')
    for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt++) {
      last = await drainOutbox(fake, 'mrtnmlchr')
    }

    expect(last.givenUp).toBe(1)
    expect(last.undone).toEqual(['Isn’t Anything'])
    expect(await (await openFidelityDb()).getAll('collection')).toEqual([])
  })

  it('leaves it queued when the lookup itself cannot be read', async () => {
    await addRecord(match())

    const fake = client({
      write: async () => {
        throw new DiscogsError(0, 'Discogs is not answering')
      },
    })
    // The count before sending answers; the look afterwards does not.
    ;(fake.get as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ releases: [] })
      .mockRejectedValue(new DiscogsError(0, 'Discogs is not answering'))

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

/*
 * Copies, not releases (#232).
 *
 * Two copies of one record on their way at once, each in the folder it was
 * meant for, each keeping its place and condition when Discogs names it.
 */
describe('several copies of one record on their way', () => {
  const copy = () => {
    const { instanceId: _instance, folderId: _folder, ...rest } = record({ releaseId: 12 })
    return rest
  }
  const write = (...answers: unknown[]) => {
    const fn = vi.fn()
    for (const answer of answers)
      if (answer instanceof Error) fn.mockRejectedValueOnce(answer)
      else fn.mockResolvedValueOnce(answer)
    return fn.mockResolvedValue(null)
  }
  const paths = (fake: DiscogsClient) =>
    (fake.write as ReturnType<typeof vi.fn>).mock.calls.map((call) => call[1])
  const keys = async () =>
    ((await (await openFidelityDb()).getAllKeys('collection')) as number[]).sort()

  it('keeps two pending copies apart and gives each its own entry', async () => {
    const first = await addCopy(copy())
    const second = await addCopy(copy())
    expect(first).not.toBe(second)
    expect(await pendingJobs()).toHaveLength(2)

    const result = await drainOutbox(
      client({ write: write({ instance_id: 5 }, { instance_id: 6 }) }),
      'mrtnmlchr',
    )

    expect(result.sent).toBe(2)
    expect(await keys()).toEqual([5, 6])
  })

  it('keeps two copies added in the same millisecond apart', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    try {
      const first = await addCopy(copy())
      const second = await addCopy(copy())
      expect(first).not.toBe(second)
    } finally {
      vi.restoreAllMocks()
    }
    expect(await pendingJobs()).toHaveLength(2)
    expect(await keys()).toHaveLength(2)
  })

  it('files a copy straight into the folder it was meant for', async () => {
    await addCopy(copy(), { folderId: 3 })
    const fake = client({ write: write({ instance_id: 5 }) })

    await drainOutbox(fake, 'mrtnmlchr')

    expect(paths(fake)).toEqual(['/users/mrtnmlchr/collection/folders/3/releases/12'])
    expect((await (await openFidelityDb()).get('collection', 5))?.folderId).toBe(3)
  })

  it('carries place and condition over to the real entry, and sends the condition', async () => {
    const key = await addCopy(copy(), { placeId: 'a1', fields: { 1: 'Mint (M)' } })
    const fake = client({ write: write({ instance_id: 5 }) })

    await drainOutbox(fake, 'mrtnmlchr')

    const db = await openFidelityDb()
    expect((await db.get('placements', 5))?.placeId).toBe('a1')
    // Written down, not deleted, so the vault does not bring it back.
    expect((await db.get('placements', key))?.placeId).toBeNull()
    expect((await db.get('fieldValues', 5))?.values).toEqual({ 1: 'Mint (M)' })
    expect(await db.get('fieldValues', key)).toBeUndefined()
    // And the condition is on its way to Discogs, addressed at the new entry.
    await drainOutbox(fake, 'mrtnmlchr')
    expect(paths(fake)).toEqual([
      '/users/mrtnmlchr/collection/folders/1/releases/12',
      '/users/mrtnmlchr/collection/folders/1/releases/12/instances/5/fields/1',
    ])
  })

  it('moves the copy to the id the lookup found, after an unreadable failure', async () => {
    const key = await addCopy(copy(), { placeId: 'a1' })
    const fake = client({ write: write(new DiscogsError(0, 'Discogs is not answering')) })
    ;(fake.get as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ releases: [{ id: 12, instance_id: 1 }] })
      .mockResolvedValue({
        releases: [
          { id: 12, instance_id: 1 },
          { id: 12, instance_id: 9 },
        ],
      })

    await drainOutbox(fake, 'mrtnmlchr')
    await drainOutbox(fake, 'mrtnmlchr')

    const db = await openFidelityDb()
    expect(fake.write).toHaveBeenCalledTimes(1)
    expect(await db.get('collection', key)).toBeUndefined()
    expect((await db.get('collection', 9))?.title).toBe('Loveless')
    expect((await db.get('placements', 9))?.placeId).toBe('a1')
  })

  it('looks next round when the add landed without naming the entry', async () => {
    await addCopy(copy())
    const fake = client({ write: write({}) })
    ;(fake.get as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ releases: [] })
      .mockResolvedValue({ releases: [{ id: 12, instance_id: 4 }] })

    await drainOutbox(fake, 'mrtnmlchr')
    await drainOutbox(fake, 'mrtnmlchr')

    expect(fake.write).toHaveBeenCalledTimes(1)
    expect(await pendingJobs()).toEqual([])
    expect(await keys()).toEqual([4])
  })

  /*
   * The first copy was refused readably and stays marked; the second went out
   * and landed. The first must not take the second's id for its own and be
   * dropped — that is one copy on the shelf where two were bought.
   */
  it('does not let a waiting copy claim the id another copy just got', async () => {
    await addCopy(copy())
    await addCopy(copy())
    const fake = client({
      write: write(
        new DiscogsError(500, 'Something went wrong'),
        { instance_id: 6 },
        {
          instance_id: 7,
        },
      ),
    })
    ;(fake.get as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ releases: [] })
      .mockResolvedValueOnce({ releases: [] })
      .mockResolvedValue({ releases: [{ id: 12, instance_id: 6 }] })

    await drainOutbox(fake, 'mrtnmlchr')
    await drainOutbox(fake, 'mrtnmlchr')

    expect(fake.write).toHaveBeenCalledTimes(3)
    expect(await keys()).toEqual([6, 7])
  })

  /*
   * Both copies refused readably, both marked — and both found next round.
   * The second used to read its marks from before the first had landed, took
   * the first one's id, and one bought copy was gone from the shelf.
   */
  it('gives two marked copies that land in one round an entry each', async () => {
    await addCopy(copy())
    await addCopy(copy())
    const fake = client({
      write: write(
        new DiscogsError(500, 'Something went wrong'),
        new DiscogsError(500, 'Something went wrong'),
      ),
    })
    ;(fake.get as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ releases: [] })
      .mockResolvedValueOnce({ releases: [] })
      .mockResolvedValue({
        releases: [
          { id: 12, instance_id: 6 },
          { id: 12, instance_id: 7 },
        ],
      })

    await drainOutbox(fake, 'mrtnmlchr')
    const second = await drainOutbox(fake, 'mrtnmlchr')

    expect(fake.write).toHaveBeenCalledTimes(2)
    expect(second.sent).toBe(2)
    expect(await pendingJobs()).toEqual([])
    expect(await keys()).toEqual([6, 7])
  })

  it('still sends an add queued before copies had keys of their own', async () => {
    const db = await openFidelityDb()
    await db.put('collection', record({ releaseId: 12, instanceId: -12, folderId: 0 }))
    await db.put('outbox', {
      id: 'collection.add:12',
      kind: 'collection.add',
      payload: { releaseId: 12 },
      revert: {},
      attempts: 0,
      queuedAt: 1,
    })
    const fake = client({ write: write({ instance_id: 5 }) })

    await drainOutbox(fake, 'mrtnmlchr')

    expect(paths(fake)).toEqual(['/users/mrtnmlchr/collection/folders/1/releases/12'])
    expect(await keys()).toEqual([5])
    // Filed in folder 1, so a rating afterwards must not address the virtual folder 0.
    expect((await db.get('collection', 5))?.folderId).toBe(1)
  })
})
