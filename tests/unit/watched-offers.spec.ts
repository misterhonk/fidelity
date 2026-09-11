import { beforeEach, describe, expect, it } from 'vitest'

import { openFidelityDb } from '~~/db/open'
import { checkWatched } from '~~/worker/watched/check'
import { MAX_CONFIRM, seenOffers } from '~~/worker/watched/offers'
import type { DiscogsClient } from '~~/worker/discogs/client'
import type { Dig, Match, WatchedRelease } from '#shared/types'

/**
 * "One offer fewer" becomes "the copy at X is gone" (M11).
 *
 * The watcher normally may not name a shop: `/marketplace/listings?
 * release_id=…` answers 405, and "who is selling release X" cannot be answered
 * through the API. The one exception is offers a dig on this device walked
 * past itself — those have a listing id, and that can be fetched individually.
 *
 * So what is checked here is above all **restraint**: ask only when the number
 * has fallen, three times at most, and never the same copy twice.
 */

const TAG = 24 * 60 * 60 * 1000
const NOW = 1_800_000_000_000

const dig = (id: string, dealer: string, tageZurueck: number): Dig =>
  ({
    id,
    dealer,
    status: 'expired',
    startedAt: NOW - tageZurueck * TAG,
    finishedAt: NOW - tageZurueck * TAG,
    expiresAt: NOW - tageZurueck * TAG,
    listingsTotal: 100,
    listingsScanned: 100,
    coverage: 1,
    uniqueSeen: 100,
    matchCount: 1,
  }) as unknown as Dig

const match = (digId: string, listingId: number, releaseId: number): Match =>
  ({
    digId,
    listingId,
    releaseId,
    score: 80,
    signals: [],
    expired: true,
  }) as unknown as Match

const watching = (over: Partial<WatchedRelease> = {}): WatchedRelease => ({
  releaseId: 42,
  kind: 'shelf',
  artist: 'Alice Coltrane',
  title: 'Journey in Satchidananda',
  since: NOW - 90 * TAG,
  threshold: null,
  // Von fünf auf zwei: `fewer` greift, also wird nachgefragt.
  points: [
    { at: NOW - 60 * TAG, lowestPrice: 40, currency: 'EUR', numForSale: 5 },
    { at: NOW - TAG, lowestPrice: 44, currency: 'EUR', numForSale: 2 },
  ],
  checkedAt: null,
  notifiedAt: null,
  ...over,
})

/** A client that keeps a record: the stats first, then the offers. */
function client(status: Record<number, string>) {
  const asked: string[] = []
  const fake = {
    get: async (path: string) => {
      asked.push(path)
      if (path.startsWith('/marketplace/stats/')) {
        return { lowest_price: { value: 44, currency: 'EUR' }, num_for_sale: 2 }
      }
      const id = Number(path.split('/').at(-1))
      return { id, status: status[id] ?? 'For Sale' }
    },
  } as unknown as DiscogsClient
  return { fake, asked }
}

beforeEach(async () => {
  const db = await openFidelityDb()
  for (const store of ['watched', 'digs', 'matches'] as const) await db.clear(store)
})

describe('the offers a dig walked past', () => {
  /**
   * Newest first, and each one only once.
   *
   * The same copy turns up in two digs of the same shop — that is one offer,
   * not two. The newer find is kept, because it says where it last stood.
   */
  it('lists each offer once, newest first', async () => {
    const db = await openFidelityDb()
    /*
     * The ids are deliberately reversed: `matches` is keyed by `[digId,
     * listingId]`, so the **older** dig runs through last. A merge that simply
     * keeps whichever was read last would get through this and still be wrong
     * — a mutation probe showed exactly that, for as long as both digs
     * belonged to the same shop.
     */
    await db.put('digs', dig('zz-alt', 'staubkiste', 30))
    await db.put('digs', dig('aa-fresh', 'plattenkiste', 2))
    await db.put('digs', dig('mm-woanders', 'vinyltresor', 10))
    await db.put('matches', match('zz-alt', 500, 42))
    await db.put('matches', match('aa-fresh', 500, 42))
    await db.put('matches', match('mm-woanders', 600, 42))
    // A different record in the same dig is none of this one's business.
    await db.put('matches', match('aa-fresh', 700, 99))

    const offers = await seenOffers(42)
    expect(offers.map((o) => o.listingId)).toEqual([500, 600])
    // The newer find carries the shop it was last seen under.
    expect(offers[0]!.dealer).toBe('plattenkiste')
  })
})

describe('a copy that is no longer listed', () => {
  it('names the shop the dig walked past', async () => {
    const db = await openFidelityDb()
    await db.put('digs', dig('d1', 'plattenkiste', 5))
    await db.put('matches', match('d1', 500, 42))
    await db.put('watched', watching())

    const { fake } = client({ 500: 'Sold' })
    const result = await checkWatched(fake, { now: () => NOW, force: true })

    expect(result.news[0]!.news).toMatchObject({
      kind: 'gone',
      dealer: 'plattenkiste',
      listingId: 500,
    })
  })

  /**
   * And on the next pass it costs nothing any more.
   *
   * Without this memory, the watcher asks about the same vanished copy again
   * every day and reports it again every day — a request for a message that
   * has already been read.
   */
  it('remembers it instead of asking again tomorrow', async () => {
    const db = await openFidelityDb()
    await db.put('digs', dig('d1', 'plattenkiste', 5))
    await db.put('matches', match('d1', 500, 42))
    await db.put('watched', watching())

    const erste = client({ 500: 'Sold' })
    await checkWatched(erste.fake, { now: () => NOW, force: true })
    expect(erste.asked).toContain('/marketplace/listings/500')

    const zweite = client({ 500: 'Sold' })
    await checkWatched(zweite.fake, { now: () => NOW, force: true })
    expect(zweite.asked).not.toContain('/marketplace/listings/500')
    // And with no second copy it stays at the number.
    const news = (await checkWatched(client({}).fake, { now: () => NOW, force: true })).news
    expect(news[0]!.news.kind).toBe('fewer')
  })

  /** An offer that still stands is not news — only a request. */
  it('says nothing when the copy is still for sale', async () => {
    const db = await openFidelityDb()
    await db.put('digs', dig('d1', 'plattenkiste', 5))
    await db.put('matches', match('d1', 500, 42))
    await db.put('watched', watching())

    const { fake, asked } = client({ 500: 'For Sale' })
    const result = await checkWatched(fake, { now: () => NOW, force: true })

    expect(asked).toContain('/marketplace/listings/500')
    expect(result.news[0]!.news.kind).toBe('fewer')
  })

  /**
   * Three at most, even where a dig has seen twenty copies.
   *
   * The watcher runs over up to a hundred records; without a cap, a single
   * fallen counter would be a half-hour pass.
   */
  it('asks at most three times', async () => {
    const db = await openFidelityDb()
    await db.put('digs', dig('d1', 'plattenkiste', 5))
    for (let i = 0; i < 8; i += 1) await db.put('matches', match('d1', 500 + i, 42))
    await db.put('watched', watching())

    const { fake, asked } = client({})
    await checkWatched(fake, { now: () => NOW, force: true })

    const listings = asked.filter((path) => path.startsWith('/marketplace/listings/'))
    expect(listings).toHaveLength(MAX_CONFIRM)
  })

  /**
   * And nothing is asked at all for as long as the number holds.
   *
   * That is the whole reason the feature is affordable: the expensive question
   * hangs off a cheap signal.
   */
  it('asks nothing at all while the count holds', async () => {
    const db = await openFidelityDb()
    await db.put('digs', dig('d1', 'plattenkiste', 5))
    await db.put('matches', match('d1', 500, 42))
    await db.put(
      'watched',
      watching({
        points: [
          { at: NOW - 60 * TAG, lowestPrice: 40, currency: 'EUR', numForSale: 2 },
          { at: NOW - TAG, lowestPrice: 44, currency: 'EUR', numForSale: 2 },
        ],
      }),
    )

    const { fake, asked } = client({ 500: 'Sold' })
    await checkWatched(fake, { now: () => NOW, force: true })

    expect(asked.filter((path) => path.startsWith('/marketplace/listings/'))).toEqual([])
  })
})
