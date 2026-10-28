import { afterEach, describe, expect, it, vi } from 'vitest'

import { MAX_ATTEMPTS, pendingJobs, queueJob } from '~~/db/outbox'
import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import type { CollectionItem } from '#shared/types'
import { DiscogsError } from '~~/worker/discogs/errors'
import type { DiscogsClient } from '~~/worker/discogs/client'
import { drainOutbox } from '~~/worker/outbox'

/**
 * The queue between a tap and Discogs.
 *
 * Its whole reason for existing is that those two are 1.2 seconds apart at
 * best and a shop basement apart at worst. What matters is not that it sends
 * things — it is what it does when sending does not work, because that is
 * where a queue quietly starts lying about the state of somebody's shelf.
 */

afterEach(async () => {
  await deleteFidelityDb()
})

function record(over: Partial<CollectionItem> = {}): CollectionItem {
  return {
    releaseId: 42,
    masterId: 0,
    title: 'Bitches Brew',
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
    year: 1970,
    thumbUrl: '',
    coverUrl: '',
    rating: 3,
    addedAt: '2024-01-01T00:00:00-00:00',
    instanceId: 900,
    folderId: 1,
    ...over,
  }
}

/** A rating already applied locally, on its way out. */
async function queueRating(rating: number, was: number) {
  const db = await openFidelityDb()
  await db.put('collection', record({ rating }))
  await queueJob({
    id: `collection.rating:900`,
    kind: 'collection.rating',
    payload: { releaseId: 42, folderId: 1, instanceId: 900, rating },
    revert: { rating: was },
    queuedAt: 1,
  })
}

const client = (write: () => Promise<unknown>) =>
  ({ write: vi.fn(write) }) as unknown as DiscogsClient & { write: ReturnType<typeof vi.fn> }

describe('the outbox', () => {
  it('sends a queued change and forgets it', async () => {
    await queueRating(5, 3)
    const fake = client(async () => null)

    const result = await drainOutbox(fake, 'mrtnmlchr')

    expect(result).toEqual({ sent: 1, givenUp: 0, waiting: 0 })
    expect(await pendingJobs()).toEqual([])

    const [method, path, options] = (fake.write as ReturnType<typeof vi.fn>).mock.calls[0] ?? []
    expect(method).toBe('POST')
    expect(path).toBe('/users/mrtnmlchr/collection/folders/1/releases/42/instances/900')
    // Repeating a rating leaves the same rating — so this one may be retried.
    expect(options).toEqual({ body: { rating: 5 }, idempotent: true })
  })

  /*
   * Three taps, one request.
   *
   * Somebody deciding between four and five stars taps twice, and the id
   * addresses the row rather than the moment, so the second replaces the first
   * while it is still waiting. Without this the shelf would spend a paced
   * request — 1.2 seconds of the single lane — on every intermediate opinion.
   */
  it('keeps one job per row, however often it is changed', async () => {
    await queueRating(4, 3)
    await queueRating(5, 4)

    const jobs = await pendingJobs()
    expect(jobs).toHaveLength(1)
    expect(jobs[0]?.payload.rating).toBe(5)
  })

  /*
   * And the revert survives that collapse.
   *
   * `revert` holds what Discogs still believes, not what the app showed a
   * moment ago. Overwriting it with 4 — the value from the tap in between,
   * which never left the device — would put a rating on the shelf that has
   * never existed anywhere.
   */
  it('remembers what Discogs still believes, not the last thing shown', async () => {
    await queueRating(4, 3)
    await queueRating(5, 4)

    expect((await pendingJobs())[0]?.revert.rating).toBe(3)
  })

  it('leaves the queue as it was when the drain is cancelled', async () => {
    await queueRating(5, 3)
    const fake = client(async () => null)

    await expect(drainOutbox(fake, 'mrtnmlchr', AbortSignal.abort())).rejects.toMatchObject({
      name: 'AbortError',
    })

    expect(fake.write).not.toHaveBeenCalled()
    expect((await pendingJobs()).map((job) => job.attempts)).toEqual([0])
  })

  it('counts a failed add that was cut off mid-send, so the next drain looks before sending', async () => {
    await queueJob({
      id: 'collection.add:42',
      kind: 'collection.add',
      payload: { releaseId: 42 },
      revert: {},
      queuedAt: 1,
    })
    const control = new AbortController()
    const fake = client(async () => {
      // The add never sees the signal; the opaque failure is its own.
      control.abort()
      throw new DiscogsError(0, 'Discogs is not answering')
    })

    await expect(drainOutbox(fake, 'mrtnmlchr', control.signal)).rejects.toMatchObject({
      name: 'AbortError',
    })

    expect((await pendingJobs()).map((job) => job.attempts)).toEqual([1])
  })

  it('stops the round at the first failure instead of burning the rest', async () => {
    await queueRating(5, 3)
    const fake = client(async () => {
      throw new DiscogsError(0, 'Discogs is not answering')
    })

    const result = await drainOutbox(fake, 'mrtnmlchr')

    expect(result.sent).toBe(0)
    expect(result.waiting).toBe(1)
    expect((await pendingJobs())[0]?.attempts).toBe(1)
  })

  /*
   * The one that earns the whole file.
   *
   * A change that is shown but never arrives is worse than one refused
   * outright: the shelf and Discogs disagree and nothing on screen says so.
   * After the last attempt the old value goes back where it came from.
   */
  it('puts the old rating back when it gives up', async () => {
    await queueRating(5, 3)
    const fake = client(async () => {
      throw new DiscogsError(0, 'Discogs is not answering')
    })

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      await drainOutbox(fake, 'mrtnmlchr')
    }

    const db = await openFidelityDb()
    expect((await db.get('collection', 900))?.rating).toBe(3)
    expect(await pendingJobs()).toEqual([])
  })

  it('reports having given up, so a screen can say so', async () => {
    await queueRating(5, 3)
    const fake = client(async () => {
      throw new DiscogsError(0, 'Discogs is not answering')
    })

    let last = { sent: 0, givenUp: 0, waiting: 0 }
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      last = await drainOutbox(fake, 'mrtnmlchr')
    }

    expect(last.givenUp).toBe(1)
  })

  /*
   * Found on 2026-10-21. The pacer's lock serialises requests, not jobs: two
   * drains (the keeper's and a flush after a write, or two tabs) both read
   * the queued add before either dropped it, and Discogs filed the record
   * twice. `navigator.locks` is what real tabs share; this stands in for it.
   */
  describe('across drains', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    function oneLock() {
      let held: Promise<unknown> = Promise.resolve()
      vi.stubGlobal('navigator', {
        locks: {
          request: <T>(_name: string, run: () => Promise<T>): Promise<T> => {
            const turn = held.then(run, run)
            held = turn.then(
              () => undefined,
              () => undefined,
            )
            return turn
          },
        },
      })
    }

    async function queueAdd() {
      const db = await openFidelityDb()
      await db.put('collection', record({ instanceId: -42, folderId: 0, rating: 0 }))
      await queueJob({
        id: 'collection.add:42',
        kind: 'collection.add',
        payload: { releaseId: 42 },
        revert: {},
        queuedAt: 1,
      })
    }

    it('files a new record once, however many drains reach for it', async () => {
      oneLock()
      await queueAdd()
      const fake = client(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5))
        return null
      })

      await Promise.all([drainOutbox(fake, 'mrtnmlchr'), drainOutbox(fake, 'mrtnmlchr')])

      expect(fake.write).toHaveBeenCalledTimes(1)
      expect(await pendingJobs()).toEqual([])
    })

    it('keeps a rating tapped again while the first was on its way', async () => {
      await queueRating(4, 3)
      const fake = client(async () => {
        // The second tap lands while the first is in flight.
        await queueJob({
          id: 'collection.rating:900',
          kind: 'collection.rating',
          payload: { releaseId: 42, folderId: 1, instanceId: 900, rating: 5 },
          revert: { rating: 3 },
          queuedAt: 2,
        })
        return null
      })

      await drainOutbox(fake, 'mrtnmlchr')

      expect((await pendingJobs()).map((job) => job.payload)).toEqual([
        { releaseId: 42, folderId: 1, instanceId: 900, rating: 5 },
      ])
    })

    it('takes the provisional record off the shelf when it gives up on adding it', async () => {
      await queueAdd()
      const fake = client(async () => {
        throw new DiscogsError(0, 'Discogs is not answering')
      })

      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        await drainOutbox(fake, 'mrtnmlchr')
      }

      const db = await openFidelityDb()
      expect(await db.get('collection', -42)).toBeUndefined()
    })
  })
})

describe('a job that fails on its own', () => {
  it('does not hold up the job behind it', async () => {
    await queueJob({
      id: 'wantlist.note:7',
      kind: 'wantlist.note',
      payload: { releaseId: 7, note: 'x', want: 0 },
      revert: { note: '', want: 0 },
      queuedAt: 0,
    })
    await queueRating(5, 3)
    const fake = client(async () => {
      if (fake.write.mock.calls.length === 1) throw new DiscogsError(404, 'Not Found')
      return null
    })

    const result = await drainOutbox(fake, 'mrtnmlchr')

    expect(result).toEqual({ sent: 1, givenUp: 0, waiting: 1 })
    expect((await pendingJobs()).map((job) => job.id)).toEqual(['wantlist.note:7'])
  })
})

describe('a move that has not been sent yet', () => {
  const move = (from: number, to: number, queuedAt: number) =>
    queueJob({
      id: 'collection.folder:900',
      kind: 'collection.folder',
      payload: { releaseId: 42, folderId: from, instanceId: 900, moveTo: to },
      revert: { folderId: from },
      queuedAt,
    })

  it('keeps the folder Discogs still has it in when moved again', async () => {
    await move(1, 2, 1)
    await move(2, 3, 2)

    const [job] = await pendingJobs()
    expect(job?.payload).toMatchObject({ folderId: 1, moveTo: 3 })
  })

  it('sends a second move from where the first one landed', async () => {
    await move(1, 2, 1)
    const fake = client(async () => {
      // Moved on again while the first move is in flight.
      if (fake.write.mock.calls.length === 1) await move(2, 3, 2)
      return null
    })

    await drainOutbox(fake, 'mrtnmlchr')
    await drainOutbox(fake, 'mrtnmlchr')

    const [, path, options] = fake.write.mock.calls[1] ?? []
    expect(path).toBe('/users/mrtnmlchr/collection/folders/2/releases/42/instances/900')
    expect(options).toMatchObject({ body: { folder_id: 3 } })
    expect(await pendingJobs()).toEqual([])
  })

  it('addresses a rating sent before it by the old folder', async () => {
    const db = await openFidelityDb()
    await db.put('collection', record({ folderId: 2, rating: 5 }))
    await queueJob({
      id: 'collection.rating:900',
      kind: 'collection.rating',
      payload: { releaseId: 42, folderId: 2, instanceId: 900, rating: 5 },
      revert: { rating: 3 },
      queuedAt: 1,
    })
    await move(1, 2, 2)
    const fake = client(async () => null)

    await drainOutbox(fake, 'mrtnmlchr')

    const [, path] = fake.write.mock.calls[0] ?? []
    expect(path).toBe('/users/mrtnmlchr/collection/folders/1/releases/42/instances/900')
  })
})
