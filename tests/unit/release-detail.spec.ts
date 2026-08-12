import { afterEach, describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'

import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import { releaseDetail } from '~~/worker/collection/detail'
import type { DiscogsClient } from '~~/worker/discogs/client'

/**
 * The one request rule 2 allows, and the reason it stays one.
 *
 * `/releases/{id}` is the endpoint that must never be walked — ten thousand of
 * them is three hours. Opening a record is not a walk, so the tracklist is
 * fetched for a record somebody actually looked at and then kept for ever.
 * "For ever" is the whole bargain: a second look must cost nothing, or the
 * rule has been broken slowly instead of quickly.
 */

afterEach(async () => {
  await deleteFidelityDb()
})

const ANSWER = {
  id: 42,
  country: 'Germany',
  released: '2005-01-27',
  notes: 'Pressed at Optimal.',
  tracklist: [
    { position: '', title: 'That Side', type_: 'heading' },
    { position: 'A', title: 'Moan', duration: '6:14', type_: 'track' },
    { position: 'B', title: 'Moan (Radio Slave Remix)', duration: '', type_: 'track' },
  ],
  extraartists: [
    { name: 'Trentemøller', role: 'Remix' },
    { name: 'Kalle Kuts', role: 'Mastered By' },
  ],
  identifiers: [
    { type: 'Matrix / Runout', value: 'PFR81 A1', description: 'Side A' },
    { type: 'Barcode', value: '807297154610' },
  ],
  community: { rating: { average: 4.31, count: 312 } },
  videos: [{ title: 'Moan', uri: 'https://www.youtube.com/watch?v=x' }],
}

function fakeClient(answer: unknown = ANSWER) {
  const get = vi.fn(async (_path: string, schema: z.ZodType) => schema.parse(answer))
  return { client: { get } as unknown as DiscogsClient, get }
}

describe('what only a release lookup knows', () => {
  it('reads the record and keeps it', async () => {
    const { client } = fakeClient()
    const detail = await releaseDetail(client, 42, { now: () => 1_700_000_000_000 })

    expect(detail?.country).toBe('Germany')
    expect(detail?.released).toBe('2005-01-27')
    expect(detail?.credits).toEqual([
      { name: 'Trentemøller', role: 'Remix' },
      { name: 'Kalle Kuts', role: 'Mastered By' },
    ])
    expect(detail?.identifiers[0]).toEqual({
      type: 'Matrix / Runout',
      value: 'PFR81 A1',
      description: 'Side A',
    })
    expect(detail?.fetchedAt).toBe(1_700_000_000_000)
  })

  /*
   * The test the rule is made of.
   *
   * One request per record opened is the bargain; one per *opening* would turn
   * a browsed collection back into the walk rule 2 forbids, only spread out
   * enough that nobody notices.
   */
  it('asks Discogs once, however often the record is opened', async () => {
    const { client, get } = fakeClient()

    await releaseDetail(client, 42)
    await releaseDetail(client, 42)
    await releaseDetail(client, 42)

    expect(get).toHaveBeenCalledTimes(1)
    expect(get.mock.calls[0]?.[0]).toBe('/releases/42')
  })

  it('drops the headings, which are sections and not songs', async () => {
    const detail = await releaseDetail(fakeClient().client, 42)

    expect(detail?.tracks).toHaveLength(2)
    expect(detail?.tracks.map((track) => track.title)).not.toContain('That Side')
  })

  /*
   * A rating nobody gave is not a rating of zero.
   *
   * Discogs answers `average: 0, count: 0` for a record nobody voted on, and
   * "0.0 out of 5" would invent a verdict the community never reached — the
   * same mistake the stars on your own copy already refuse to make.
   */
  it('shows no community verdict when nobody has voted', async () => {
    const { client } = fakeClient({
      ...ANSWER,
      community: { rating: { average: 0, count: 0 } },
    })

    expect((await releaseDetail(client, 42))?.community).toBeNull()
  })

  it('keeps the verdict when somebody has', async () => {
    expect((await releaseDetail(fakeClient().client, 42))?.community).toEqual({
      rating: 4.31,
      votes: 312,
    })
  })

  /*
   * No answer is a shorter screen, not an error.
   *
   * Everything above the tracklist — cover, rating, label, condition — came
   * out of storage and is already drawn. A basement with no signal should cost
   * the tracklist and nothing else, and it must not poison the store with an
   * empty record that then never gets fetched again.
   */
  it('returns nothing and stores nothing when Discogs will not answer', async () => {
    const get = vi.fn(async () => {
      throw new Error('offline')
    })

    const detail = await releaseDetail({ get } as unknown as DiscogsClient, 42)

    expect(detail).toBeNull()
    const db = await openFidelityDb()
    expect(await db.get('releaseDetail', 42)).toBeUndefined()
  })

  /*
   * The price is the one part of this that expires.
   *
   * Rule 4: marketplace data is never shown once it is six hours old. The
   * tracklist beside it is not marketplace data and does not expire — so the
   * row keeps everything and the *answer* drops the price, exactly the way
   * `expireDigs` nulls the marketplace fields of a match and leaves the rest.
   */
  it('turns a float into cents, in the currency that was asked for', async () => {
    const { client, get } = fakeClient({ ...ANSWER, lowest_price: 13.21, num_for_sale: 26 })
    const detail = await releaseDetail(client, 42, { now: () => 1_000 })

    expect(detail?.market).toEqual({
      priceCents: 1321,
      currency: 'EUR',
      numForSale: 26,
      at: 1_000,
    })
    // Asked for explicitly: Discogs prices in the caller's currency and names
    // it nowhere in the body.
    expect(get.mock.calls[0]?.[2]).toMatchObject({ query: { curr_abbr: 'EUR' } })
  })

  it('stops showing the price after six hours, and keeps the record', async () => {
    const { client } = fakeClient({ ...ANSWER, lowest_price: 13.21, num_for_sale: 26 })
    await releaseDetail(client, 42, { now: () => 0 })

    const later = await releaseDetail(client, 42, { now: () => 6 * 60 * 60 * 1000 + 1 })

    expect(later?.market).toBeNull()
    // The half that is not marketplace data is untouched.
    expect(later?.tracks).toHaveLength(2)
    expect(later?.identifiers).toHaveLength(2)
  })

  it('still shows it a minute before the six hours are up', async () => {
    const { client } = fakeClient({ ...ANSWER, lowest_price: 13.21, num_for_sale: 26 })
    await releaseDetail(client, 42, { now: () => 0 })

    const later = await releaseDetail(client, 42, { now: () => 6 * 60 * 60 * 1000 - 60_000 })
    expect(later?.market?.priceCents).toBe(1321)
  })

  it('asks again only when asked to', async () => {
    const { client, get } = fakeClient({ ...ANSWER, lowest_price: 13.21 })
    await releaseDetail(client, 42, { now: () => 0 })
    await releaseDetail(client, 42, { now: () => 0 })
    expect(get).toHaveBeenCalledTimes(1)

    const fresh = await releaseDetail(client, 42, { refresh: true, now: () => 99_000 })
    expect(get).toHaveBeenCalledTimes(2)
    expect(fresh?.market?.at).toBe(99_000)
  })

  /*
   * Nothing for sale is a fact, not a price of zero.
   *
   * Discogs sends `lowest_price: null` — and a "0.00" beside a record nobody
   * is selling would be the same invented number the community rating already
   * refuses to draw.
   */
  it('shows no price when nobody is selling one', async () => {
    const { client } = fakeClient({ ...ANSWER, lowest_price: null, num_for_sale: 0 })
    expect((await releaseDetail(client, 42))?.market).toBeNull()
  })

  it('tries again on the next open after a failure', async () => {
    const failing = vi.fn(async () => {
      throw new Error('offline')
    })
    await releaseDetail({ get: failing } as unknown as DiscogsClient, 42)

    const { client, get } = fakeClient()
    expect((await releaseDetail(client, 42))?.country).toBe('Germany')
    expect(get).toHaveBeenCalledTimes(1)
  })
})
