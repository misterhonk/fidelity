import { afterEach, describe, expect, it, vi } from 'vitest'

import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import { pendingJobs } from '~~/db/outbox'
import type { Match, WantlistItem } from '#shared/types'
import {
  noteWant,
  rewantRecords,
  unwantRecord,
  unwantRecords,
  wantRecord,
} from '~~/worker/collection/want'
import type { DiscogsClient } from '~~/worker/discogs/client'
import { DiscogsError } from '~~/worker/discogs/errors'
import { drainOutbox } from '~~/worker/outbox'

/**
 * Wanting a record, and stopping.
 *
 * Simpler than the collection in the one way that matters: a want is
 * addressed by release alone, so there is no second instance a repeat could
 * create — both directions may be retried freely. That is measured, not
 * assumed: a PUT on a want that already exists came back 201 with its
 * `date_added` untouched (docs/02).
 */

afterEach(async () => {
  await deleteFidelityDb()
})

function match(over: Partial<Match> = {}): Match {
  return {
    digId: 'd1',
    listingId: 4,
    releaseId: 31,
    score: 60,
    signals: [],
    title: 'Spiderland',
    artist: 'Slint',
    label: 'Touch And Go',
    catno: 'TG 64',
    format: 'Vinyl, LP',
    year: 1991,
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

function want(over: Partial<WantlistItem> = {}): WantlistItem {
  return {
    releaseId: 31,
    masterId: 0,
    title: 'Spiderland',
    artistIds: [],
    artistNorms: ['slint'],
    artistNames: ['Slint'],
    labelIds: [],
    labelNorms: [],
    labelNames: [],
    catnos: [],
    genres: [],
    styles: [],
    formats: [],
    year: 1991,
    thumbUrl: '',
    coverUrl: '',
    addedAt: '2024-02-02T00:00:00-00:00',
    note: '',
    want: 0,
    ...over,
  }
}

const client = (write: () => Promise<unknown>) =>
  ({ write: vi.fn(write) }) as unknown as DiscogsClient

describe('the wantlist, written to', () => {
  it('puts a find on the list and sends a PUT that may be repeated', async () => {
    expect(await wantRecord(match())).toBe(true)

    const db = await openFidelityDb()
    expect((await db.get('wantlist', 31))?.title).toBe('Spiderland')

    const fake = client(async () => null)
    await drainOutbox(fake, 'mrtnmlchr')

    const [method, path, options] = (fake.write as ReturnType<typeof vi.fn>).mock.calls[0] ?? []
    expect(method).toBe('PUT')
    expect(path).toBe('/users/mrtnmlchr/wants/31')
    expect(options).toEqual({ idempotent: true })
  })

  it('says yes without queuing anything when it is already wanted', async () => {
    const db = await openFidelityDb()
    await db.put('wantlist', want())

    expect(await wantRecord(match())).toBe(true)
    expect(await pendingJobs()).toEqual([])
  })

  it('refuses a find whose six hours are up', async () => {
    expect(await wantRecord(match({ title: null, artist: null }))).toBe(false)
  })

  it('takes one off and carries the row, in case it has to go back', async () => {
    const db = await openFidelityDb()
    await db.put('wantlist', want())

    expect(await unwantRecord(31)).toBe(true)
    expect(await db.get('wantlist', 31)).toBeUndefined()
    expect(JSON.parse(String((await pendingJobs())[0]?.revert.want)).title).toBe('Spiderland')
  })

  /*
   * The note, and the trap in the endpoint.
   *
   * Discogs replaces both fields on every POST, so writing a note without
   * carrying the rating along would silently clear it — the kind of thing
   * nobody notices until a wish rating they set years ago is gone.
   */
  it('writes the note and the rating together, because the endpoint does', async () => {
    const db = await openFidelityDb()
    await db.put('wantlist', want({ want: 4 }))

    expect(await noteWant(31, 'Only the 1991 press', 4)).toBe(true)

    const fake = client(async () => null)
    await drainOutbox(fake, 'mrtnmlchr')

    const [method, path, options] = (fake.write as ReturnType<typeof vi.fn>).mock.calls[0] ?? []
    expect(method).toBe('POST')
    expect(path).toBe('/users/mrtnmlchr/wants/31')
    expect(options).toEqual({
      body: { notes: 'Only the 1991 press', rating: 4 },
      idempotent: true,
    })
  })

  it('puts the old note back when it is given up on', async () => {
    const db = await openFidelityDb()
    await db.put('wantlist', want({ note: 'German press only', want: 5 }))
    await noteWant(31, 'anything will do', 1)

    const fake = client(async () => {
      throw new DiscogsError(0, 'Discogs is not answering')
    })
    for (let attempt = 0; attempt < 5; attempt++) await drainOutbox(fake, 'mrtnmlchr')

    const stored = await db.get('wantlist', 31)
    expect(stored?.note).toBe('German press only')
    expect(stored?.want).toBe(5)
  })

  it('treats a want that is already gone as gone', async () => {
    const db = await openFidelityDb()
    await db.put('wantlist', want())
    await unwantRecord(31)

    const fake = client(async () => {
      throw new DiscogsError(404, 'Not found')
    })

    expect((await drainOutbox(fake, 'mrtnmlchr')).sent).toBe(1)
    expect(await pendingJobs()).toEqual([])
  })
})

/**
 * An armful at once (M27), and the way back from it.
 *
 * The removal is local first and reaches Discogs through the outbox, which is
 * what makes both halves cheap — and makes the undo's cost depend on *when* it
 * is pressed. That timing is the whole of what is tested here, because it is
 * the part that cannot be seen from the screen.
 */
describe('the wantlist, by the armful', () => {
  it('takes several off in one go and hands the rows back', async () => {
    const db = await openFidelityDb()
    await db.put('wantlist', want())
    await db.put('wantlist', want({ releaseId: 32, title: 'Tweez' }))
    await db.put('wantlist', want({ releaseId: 33, title: 'Untitled' }))

    const removed = await unwantRecords([31, 33])

    expect(removed.map((row) => row.title)).toEqual(['Spiderland', 'Untitled'])
    expect(await db.get('wantlist', 31)).toBeUndefined()
    expect(await db.get('wantlist', 33)).toBeUndefined()
    // The one nobody ticked is untouched.
    expect((await db.get('wantlist', 32))?.title).toBe('Tweez')
    expect((await pendingJobs()).map((job) => job.id)).toEqual([
      'wantlist.remove:31',
      'wantlist.remove:33',
    ])
  })

  it('skips an id that is not on the list rather than queuing a job for it', async () => {
    const db = await openFidelityDb()
    await db.put('wantlist', want())

    expect(await unwantRecords([31, 999])).toHaveLength(1)
    expect((await pendingJobs()).map((job) => job.id)).toEqual(['wantlist.remove:31'])
  })

  /*
   * The case worth having a test for: undo before the drain.
   *
   * Discogs has not been told anything yet, so the way back is dropping the
   * job — not a second write. A `wantlist.add` here would spend a request to
   * undo something that never happened, and the pair would then be drained in
   * order for no reason at all.
   */
  it('undoes a removal for free while it is still waiting in the outbox', async () => {
    const db = await openFidelityDb()
    await db.put('wantlist', want())

    const removed = await unwantRecords([31])
    expect(await rewantRecords(removed)).toBe(0)

    expect((await db.get('wantlist', 31))?.title).toBe('Spiderland')
    expect(await pendingJobs()).toEqual([])

    // And nothing reaches Discogs, because there is nothing left to send.
    const fake = client(async () => null)
    await drainOutbox(fake, 'mrtnmlchr')
    expect(fake.write).not.toHaveBeenCalled()
  })

  /*
   * And the case where it is not free. Once the removal has drained, the want
   * really is gone over there, and the only honest way back is to ask for it.
   */
  it('asks for a record back when the removal has already reached Discogs', async () => {
    const db = await openFidelityDb()
    await db.put('wantlist', want())

    const removed = await unwantRecords([31])
    const fake = client(async () => null)
    await drainOutbox(fake, 'mrtnmlchr')
    expect(await pendingJobs()).toEqual([])

    expect(await rewantRecords(removed)).toBe(1)
    expect((await db.get('wantlist', 31))?.title).toBe('Spiderland')

    const again = client(async () => null)
    await drainOutbox(again, 'mrtnmlchr')
    const [method, path] = (again.write as ReturnType<typeof vi.fn>).mock.calls[0] ?? []
    expect(method).toBe('PUT')
    expect(path).toBe('/users/mrtnmlchr/wants/31')
  })

  /*
   * The row goes back whole, not as an id.
   *
   * A wantlist row carries the note, the wish rating and the date it was added
   * — none of which Discogs hands back, and all of which the screen shows. An
   * undo that restored a blank record would look like it worked.
   */
  it('puts the note, the rating and the waiting time back with it', async () => {
    const db = await openFidelityDb()
    await db.put(
      'wantlist',
      want({ note: 'Only the 1991 press', want: 5, addedAt: '2019-03-01T00:00:00-00:00' }),
    )

    await rewantRecords(await unwantRecords([31]))

    const back = await db.get('wantlist', 31)
    expect(back?.note).toBe('Only the 1991 press')
    expect(back?.want).toBe(5)
    expect(back?.addedAt).toBe('2019-03-01T00:00:00-00:00')
  })
})
