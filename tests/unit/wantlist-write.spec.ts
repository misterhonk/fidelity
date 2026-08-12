import { afterEach, describe, expect, it, vi } from 'vitest'

import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import { pendingJobs } from '~~/db/outbox'
import type { Match, WantlistItem } from '#shared/types'
import { noteWant, unwantRecord, wantRecord } from '~~/worker/collection/want'
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
      throw new DiscogsError(0, 'Discogs antwortet nicht')
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
