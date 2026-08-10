import { describe, expect, it, vi } from 'vitest'

import type { DiscogsClient } from '~~/worker/discogs/client'
import { DEMO_PAGES, MAX_SEEDS, runDemo } from '~~/worker/demo'

/**
 * Fidelity ohne Token, an einer Platte.
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
    // The sentence is `buildReason`'s, not one written for the demo.
    expect(roboter!.reason).toContain('Kraftwerk')
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
    expect(DEMO_PAGES).toBeLessThanOrEqual(5)
    expect(MAX_SEEDS).toBeLessThanOrEqual(2)
  })

  it('refuses politely when there is nothing to start from', async () => {
    const { client } = fakeShop()
    await expect(runDemo({ client, listingIds: [] })).rejects.toThrow('Kein Angebot')
  })
})
