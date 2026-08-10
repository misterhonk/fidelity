import { afterEach, describe, expect, it, vi } from 'vitest'

import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import type { DiscogsClient } from '~~/worker/discogs/client'
import { runDig } from '~~/worker/dig/scan'

afterEach(async () => {
  await deleteFidelityDb()
})

/**
 * The dealer profile a finished dig leaves behind.
 *
 * This is what The Clerk's Take reads (docs/06 M3) and nothing was testing it,
 * which is how a whole screen could have been showing "gescannt wurde er noch
 * nicht" about a shop scanned twice without anybody noticing.
 */
function fakeClient() {
  const get = vi.fn(
    async (path: string, schema: { parse: (v: unknown) => unknown }, options) => {
      if (!path.includes('/inventory')) {
        return schema.parse({ username: 'plattenkiste', num_for_sale: 200 })
      }

      const page = (options?.query?.page as number) ?? 1
      return schema.parse({
        pagination: { page, pages: 2, items: 200 },
        listings: Array.from({ length: 100 }, (_, i) => ({
          id: page * 1000 + i,
          status: 'For Sale',
          condition: 'Near Mint (NM or M-)',
          price: { value: 12, currency: 'EUR' },
          release: {
            id: page * 1000 + i,
            title: `Platte ${page}-${i}`,
            artist: 'Robag Wruhme',
            format: '12"',
            label: 'Freude Am Tanzen',
            year: 2003,
          },
        })),
      })
    },
  )

  return { get } as unknown as DiscogsClient
}

describe('what a dig leaves behind about the shop', () => {
  it('writes a profile the Clerk can read', async () => {
    await runDig({ client: fakeClient(), dealer: 'plattenkiste', digId: '01A' })

    const db = await openFidelityDb()
    const dealer = await db.get('dealers', 'plattenkiste')

    expect(dealer).toBeDefined()
    expect(dealer?.lastScannedAt).not.toBeNull()
    expect(dealer?.numForSale).toBe(200)
    // The rate, not the factor: the factor changes the moment another shop is
    // scanned, so it is derived on read.
    expect(dealer?.affinity).not.toBeNull()
    expect(dealer?.fingerprint).not.toBeNull()
  })

  it('does not stop watching a shop just because it was scanned', async () => {
    const db = await openFidelityDb()
    await db.put('dealers', {
      username: 'plattenkiste',
      displayName: 'Die Plattenkiste',
      shipsFrom: 'Germany',
      sellerRating: 99,
      ratingCount: 400,
      numForSale: 0,
      minOrderTotal: 20,
      shippingNote: '1 LP 6 EUR',
      lastScannedAt: null,
      affinity: null,
      fingerprint: null,
      shippingTiers: [
        { minItems: 1, maxItems: 1, price: 6, currency: 'EUR', source: 'user' as const },
      ],
      watching: true,
      watchNumForSale: 180,
      watchCheckedAt: 5000,
    })

    await runDig({ client: fakeClient(), dealer: 'plattenkiste', digId: '01A' })

    const dealer = await db.get('dealers', 'plattenkiste')

    /*
     * The regression this exists for. saveDealer listed its fields by hand;
     * the watch fields arrived three milestones later and nothing connected
     * the two, so scanning a watched shop silently stopped watching it — the
     * shop somebody most wants watched being exactly the one they scan.
     */
    expect(dealer?.watching).toBe(true)
    expect(dealer?.watchNumForSale).toBe(180)
    expect(dealer?.watchCheckedAt).toBe(5000)

    // And everything else that did not come from a scan.
    expect(dealer?.displayName).toBe('Die Plattenkiste')
    expect(dealer?.minOrderTotal).toBe(20)
    expect(dealer?.shippingNote).toBe('1 LP 6 EUR')
    expect(dealer?.shippingTiers).toHaveLength(1)
    expect(dealer?.sellerRating).toBe(99)

    // What a scan does learn, updated.
    expect(dealer?.numForSale).toBe(200)
    expect(dealer?.lastScannedAt).not.toBeNull()
  })
})
