import { describe, expect, it, vi } from 'vitest'

import type { DiscogsClient } from '~~/worker/discogs/client'
import { DEMO_PAGES, MAX_SEEDS, runDemo } from '~~/worker/demo'
import { reasonFor } from '~/i18n/reason'
import { DEMO_SEEDS } from '~/utils/demo-seeds'

import shops from '../fixtures/demo-shops.json'

/**
 * Fidelity without a token, on one record.
 *
 * The demo exists because the setup screen asked for the key to somebody's
 * Discogs account before showing them anything at all. Its worth rests
 * entirely on one property: that it runs the *real* engine. A demo with its
 * own scoring would be a sales pitch, and the first person to compare it with
 * a real dig would catch it.
 *
 * So these tests do not check that "some results come back". They check that
 * the signals are the ones the matcher produces, from a collection of one.
 */

/** A shop with a Kraftwerk single in it, and one more by the same artist. */
function fakeShop() {
  const asked: string[] = []

  const get = vi.fn(async (path: string, schema: { parse: (v: unknown) => unknown }) => {
    asked.push(path)

    if (path.startsWith('/marketplace/listings/')) {
      return schema.parse({
        id: 111,
        price: { value: 12.99, currency: 'EUR' },
        seller: { username: 'plattenladen' },
        release: { id: 900, title: 'Das Model', artist: 'Kraftwerk' },
      })
    }

    if (path.startsWith('/releases/')) {
      return schema.parse({
        id: 900,
        title: 'Das Model',
        year: 1978,
        artists: [{ id: 5, name: 'Kraftwerk' }],
        labels: [{ id: 77, name: 'Kling Klang', catno: '1C 006-45 109' }],
        genres: ['Electronic'],
        styles: ['Synth-pop'],
      })
    }

    return schema.parse({
      pagination: { page: 1, pages: 1, per_page: 100, items: 3, urls: {} },
      listings: [
        {
          id: 222,
          condition: 'Very Good Plus (VG+)',
          price: { value: 8.99, currency: 'EUR' },
          release: {
            id: 901,
            title: 'Die Roboter',
            artist: 'Kraftwerk',
            format: '7", Single',
            label: 'Kling Klang',
            catalog_number: '1C 006-32 941',
            year: 1978,
          },
        },
        {
          id: 333,
          condition: 'Near Mint (NM or M-)',
          price: { value: 3.99, currency: 'EUR' },
          release: {
            id: 902,
            title: 'Rosemarie',
            artist: 'Hubert Kah',
            format: '7", Single',
            label: 'Polydor',
            catalog_number: '810 123',
            year: 1982,
          },
        },
        // The seed itself, which must not come back as a find.
        {
          id: 111,
          price: { value: 12.99, currency: 'EUR' },
          release: { id: 900, title: 'Das Model', artist: 'Kraftwerk', format: '7", Single' },
        },
      ],
    })
  })

  return { client: { get } as unknown as DiscogsClient, asked }
}

describe('the demo', () => {
  it('finds the other record by the same artist, with the engine’s own sentence', async () => {
    const { client } = fakeShop()
    const result = await runDemo({ client, listingIds: [111] })

    expect(result.dealer).toBe('plattenladen')
    const roboter = result.finds.find((find) => find.releaseId === 901)

    expect(roboter, 'die zweite Kraftwerk-Platte').toBeDefined()
    expect(roboter!.signals.map((signal) => signal.type)).toContain('ARTIST_KNOWN')
    // The sentence is the engine's own, not one written for the demo.
    expect(reasonFor(roboter!.signals)).toContain('Kraftwerk')
  })

  it('does not offer the record somebody started from', async () => {
    const { client } = fakeShop()
    const result = await runDemo({ client, listingIds: [111] })
    expect(result.finds.map((find) => find.releaseId)).not.toContain(900)
  })

  it('reads one release per seed, for the ids a listing does not carry', async () => {
    // A marketplace listing has an artist string and no ids at all, and the
    // taste profile is keyed by id — without this the demo finds nothing.
    const { client, asked } = fakeShop()
    await runDemo({ client, listingIds: [111] })
    expect(asked.filter((path) => path.startsWith('/releases/'))).toHaveLength(1)
  })

  it('says how much of the shop it looked at', async () => {
    const { client } = fakeShop()
    const result = await runDemo({ client, listingIds: [111] })
    // "3 von 3" here; in a real shop it is 500 of several thousand, and the
    // difference between a sample and a claim is saying so.
    expect(result.scanned).toBe(3)
    expect(result.listingsTotal).toBe(3)
  })

  it('stops well short of a dig', async () => {
    // A demo that spent four minutes and 200 requests would not be a demo.
    // Ten pages at the token-less 2.4 s is 24 seconds: under a minute with room.
    expect(DEMO_PAGES).toBeLessThanOrEqual(10)
    expect(MAX_SEEDS).toBeLessThanOrEqual(2)
  })

  it('refuses politely when there is nothing to start from', async () => {
    const { client } = fakeShop()
    await expect(runDemo({ client, listingIds: [] })).rejects.toMatchObject({
      code: 'no-listing',
    })
  })

  /*
   * Found on 2026-10-21: eight of the thirteen seeds on the welcome screen had
   * sold, and a sold listing answers 401 without a token. The demo fetched the
   * listing to learn what the seed list already knew.
   */
  it('starts from a seed it knows without asking for the listing', async () => {
    const { client, asked } = fakeShop()
    const result = await runDemo({
      client,
      listingIds: [111],
      known: [
        {
          listingId: 111,
          releaseId: 900,
          dealer: 'plattenladen',
          title: 'Das Model',
          artist: 'Kraftwerk',
        },
      ],
    })
    expect(asked.some((path) => path.startsWith('/marketplace/listings/'))).toBe(false)
    expect(result.finds.map((find) => find.releaseId)).toContain(901)
  })

  it('turns back at the 10,000-listing wall instead of failing', async () => {
    const { DiscogsError } = await import('~~/worker/discogs/errors')
    const get = vi.fn(
      async (
        path: string,
        schema: { parse: (v: unknown) => unknown },
        options?: { query?: { page?: number } },
      ) => {
        if (path.startsWith('/releases/'))
          return schema.parse({
            id: 900,
            title: 'Das Model',
            artists: [{ id: 5, name: 'Kraftwerk' }],
          })
        if ((options?.query?.page ?? 1) > 1) throw new DiscogsError(403, 'Forbidden')
        return schema.parse({
          pagination: { page: 1, pages: 300, per_page: 100, items: 30_000, urls: {} },
          listings: [],
        })
      },
    )
    const result = await runDemo({
      client: { get } as unknown as DiscogsClient,
      listingIds: [111],
      known: [
        {
          listingId: 111,
          releaseId: 900,
          dealer: 'plattenladen',
          title: 'Das Model',
          artist: 'Kraftwerk',
        },
      ],
    })
    expect(result.finds).toEqual([])
    expect(result.requests).toBeLessThanOrEqual(1 + DEMO_PAGES)
  })

  it('says a pasted listing has sold, rather than blaming a token', async () => {
    const { DiscogsError } = await import('~~/worker/discogs/errors')
    const get = vi.fn(async () => {
      throw new DiscogsError(401, 'You must authenticate to access this resource.')
    })
    await expect(
      runDemo({ client: { get } as unknown as DiscogsClient, listingIds: [111] }),
    ).rejects.toMatchObject({ code: 'listing-gone' })
  })
})

/*
 * Issue #212: the demo read the newest 500 listings, and in a shop of thirty
 * thousand the artist the welcome screen had just promised was almost never
 * among them. Each shop below is the real one's size, with the clue artist at
 * the place the artist sort put it on 2026-11-01 and that artist's real rows
 * (tests/fixtures/demo-shops.json); the rest is filler that fits nothing.
 */
describe('every record on the welcome screen', () => {
  type ShopFixture = (typeof shops)[keyof typeof shops]
  type Row = ShopFixture['sameArtist'][number]

  function shopOf(fixture: ShopFixture) {
    const filler = (key: string, id: number): Row => ({
      id,
      condition: 'Very Good (VG)',
      price: { value: 5, currency: 'EUR' },
      release: {
        id,
        title: 'Filler',
        artist: key,
        format: 'LP',
        label: 'Nobody',
        catalog_number: 'X',
        year: 1990,
      },
    })
    // Digits sort before every letter and `~` after: filler either side of the clue.
    const rest = fixture.items - fixture.before - fixture.sameArtist.length
    const early = fixture.order === 'asc' ? fixture.before : rest
    const late = fixture.items - early - fixture.sameArtist.length
    const asc = [
      ...Array.from({ length: early }, (_, i) => filler(String(i).padStart(6, '0'), 1e9 + i)),
      ...fixture.sameArtist,
      ...Array.from({ length: late }, (_, i) =>
        filler(`~${String(i).padStart(6, '0')}`, 2e9 + i),
      ),
    ]
    const desc = asc.toReversed()
    const asked: string[] = []

    const get = vi.fn(
      async (
        path: string,
        schema: { parse: (v: unknown) => unknown },
        options?: { query?: { page?: number; sort?: string; sort_order?: string } },
      ) => {
        asked.push(path)
        if (path.startsWith('/releases/')) return schema.parse(fixture.release)
        const { page = 1, sort, sort_order: order } = options?.query ?? {}
        expect(sort).toBe('artist')
        if (page > 100) throw Object.assign(new Error('Forbidden'), { status: 403 })
        return schema.parse({
          pagination: {
            page,
            pages: Math.ceil(asc.length / 100),
            per_page: 100,
            items: asc.length,
            urls: {},
          },
          listings: (order === 'desc' ? desc : asc).slice((page - 1) * 100, page * 100),
        })
      },
    )
    return { client: { get } as unknown as DiscogsClient, asked }
  }

  for (const seed of DEMO_SEEDS) {
    it(`finds something next to ${seed.artist} at ${seed.dealer}`, async () => {
      const fixture = (shops as Record<string, ShopFixture | undefined>)[seed.releaseId]
      expect(fixture, 'a recorded shop for this seed').toBeDefined()
      expect(fixture!.dealer).toBe(seed.dealer)

      const { client, asked } = shopOf(fixture!)
      const result = await runDemo({
        client,
        listingIds: [seed.listingId],
        known: [
          {
            listingId: seed.listingId,
            releaseId: seed.releaseId,
            dealer: seed.dealer,
            title: seed.title,
            artist: seed.artist,
          },
        ],
      })

      expect(result.finds.length).toBeGreaterThanOrEqual(1)
      expect(result.finds[0]!.signals.map((signal) => signal.type)).toContain('ARTIST_KNOWN')
      // Rule 3 at 2.4 s a request: the whole look stays well under a minute.
      expect(asked.filter((path) => path.includes('/inventory')).length).toBeLessThanOrEqual(
        DEMO_PAGES,
      )
      // Rule 2: one release, the seed's.
      expect(asked.filter((path) => path.startsWith('/releases/'))).toHaveLength(1)
    })
  }
})
