import { afterEach, describe, expect, it } from 'vitest'

import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import { homeOverview } from '~~/worker/home'

afterEach(async () => {
  await deleteFidelityDb()
})

/**
 * Die Startseite, aus dem, was auf dem Gerät liegt.
 *
 * Two things matter here and neither is visible on screen. The first is that
 * the rails are trimmed *in the worker*: a dig can hold thousands of matches
 * and postMessage would carry every one of them across for a row that shows
 * twelve. The second is that "newest" is decided by a bounded walk rather than
 * by sorting a copy of the whole collection.
 */

async function shelve(store: 'collection' | 'wantlist', releaseId: number, addedAt: string) {
  const db = await openFidelityDb()
  await db.put(store, {
    releaseId,
    masterId: 0,
    title: `Platte ${releaseId}`,
    artistIds: [],
    artistNames: ['Robag Wruhme'],
    artistNorms: ['robag wruhme'],
    labelIds: [],
    labelNames: [],
    labelNorms: [],
    catnos: [],
    genres: [],
    styles: [],
    formats: ['Vinyl'],
    year: 2018,
    rating: 0,
    thumbUrl: `https://i.discogs.com/${releaseId}.jpg`,
    coverUrl: `https://i.discogs.com/${releaseId}-600.jpg`,
    addedAt,
  } as never)
}

async function dig(id: string, dealer: string, matches: number) {
  const db = await openFidelityDb()
  await db.put('digs', {
    id,
    dealer,
    status: 'done',
    startedAt: 1_800_000_000_000,
    finishedAt: 1_800_000_100_000,
    expiresAt: 1_800_021_600_000,
    listingsTotal: matches,
    listingsScanned: matches,
    coverage: 1,
    truncated: false,
    matchCount: matches,
    apiRequests: 1,
    cursor: null,
  } as never)

  for (let index = 0; index < matches; index++) {
    await db.put('matches', {
      digId: id,
      listingId: 1000 + index,
      releaseId: 500 + index,
      // Ascending, so the *last* one written is the strongest — which is what
      // the index gives back last and the rail has to show first.
      score: index,
      signals: [],
      title: `Treffer ${index}`,
      artist: 'Someone',
      thumbUrl: null,
      price: 10,
      currency: 'EUR',
      expired: false,
    } as never)
  }
}

describe('homeOverview', () => {
  it('is empty and does not throw on a fresh device', async () => {
    const home = await homeOverview()

    expect(home.dig).toBeNull()
    expect(home.finds).toEqual([])
    expect(home.shelf).toEqual([])
    expect(home.library.collection).toBe(0)
  })

  it('shows the newest records first and stops at twelve', async () => {
    // Twenty, written oldest-first so insertion order cannot be what sorts it.
    for (let index = 0; index < 20; index++) {
      await shelve(
        'collection',
        index,
        `2024-01-${String(index + 1).padStart(2, '0')}T00:00:00Z`,
      )
    }

    const home = await homeOverview()

    expect(home.shelf).toHaveLength(12)
    expect(home.shelf[0]!.addedAt).toBe('2024-01-20T00:00:00Z')
    expect(home.shelf[11]!.addedAt).toBe('2024-01-09T00:00:00Z')
    // The denominator is still the whole collection, not the rail.
    expect(home.library.collection).toBe(20)
  })

  it('carries the covers a rail needs', async () => {
    await shelve('wantlist', 7, '2025-06-01T00:00:00Z')

    const home = await homeOverview()

    expect(home.wanted[0]).toMatchObject({
      releaseId: 7,
      artist: 'Robag Wruhme',
      thumbUrl: 'https://i.discogs.com/7.jpg',
      coverUrl: 'https://i.discogs.com/7-600.jpg',
    })
  })

  it('sends twelve finds across, not two thousand', async () => {
    await dig('01J000000000000000000000A', 'juno_records', 300)

    const home = await homeOverview()

    expect(home.dig).toMatchObject({ dealer: 'juno_records', matches: 300 })
    expect(home.finds).toHaveLength(12)
    // Strongest first: the fixture scored them 0..299.
    expect(home.finds[0]!.score).toBe(299)
    expect(home.finds[11]!.score).toBe(288)
  })

  it('takes the newest dig when there are several', async () => {
    await dig('01J000000000000000000000A', 'alt', 3)
    await dig('01J000000000000000000000B', 'neu', 3)

    expect((await homeOverview()).dig?.dealer).toBe('neu')
  })

  it('does not let an empty visit hide a shop that had finds', async () => {
    /*
     * "Nur das Neue" costs one request and often turns up nothing, which is a
     * good answer and a bad rail. Before this, a dig that found nothing an
     * hour after a dig that found fifteen would blank the start screen.
     */
    await dig('01J000000000000000000000A', 'juno_records', 15)
    await dig('01J000000000000000000000B', 'juno_records', 0)

    const home = await homeOverview()

    expect(home.dig?.matches).toBe(15)
    expect(home.finds).toHaveLength(12)
  })

  it('puts the shops that actually deliver at the front', async () => {
    const db = await openFidelityDb()
    for (const [username, affinity] of [
      ['mittel', 2.4],
      ['ungemessen', null],
      ['stark', 9.1],
    ] as const) {
      await db.put('dealers', {
        username,
        displayName: '',
        shipsFrom: 'Germany',
        sellerRating: 99,
        ratingCount: 10,
        numForSale: 500,
        minOrderTotal: 0,
        shippingNote: '',
        lastScannedAt: null,
        affinity,
        fingerprint: null,
        shippingTiers: [],
      } as never)
    }

    const home = await homeOverview()

    expect(home.shops.map((shop) => shop.username)).toEqual(['stark', 'mittel', 'ungemessen'])
    // Falls back to the username, so a shop without a display name is not blank.
    expect(home.shops[0]!.displayName).toBe('stark')
  })
})
