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
    id: `collection.rating:42`,
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

  it('stops the round at the first failure instead of burning the rest', async () => {
    await queueRating(5, 3)
    const fake = client(async () => {
      throw new DiscogsError(0, 'Discogs antwortet nicht')
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
      throw new DiscogsError(0, 'Discogs antwortet nicht')
    })

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      await drainOutbox(fake, 'mrtnmlchr')
    }

    const db = await openFidelityDb()
    expect((await db.get('collection', 42))?.rating).toBe(3)
    expect(await pendingJobs()).toEqual([])
  })

  it('reports having given up, so a screen can say so', async () => {
    await queueRating(5, 3)
    const fake = client(async () => {
      throw new DiscogsError(0, 'Discogs antwortet nicht')
    })

    let last = { sent: 0, givenUp: 0, waiting: 0 }
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      last = await drainOutbox(fake, 'mrtnmlchr')
    }

    expect(last.givenUp).toBe(1)
  })
})
