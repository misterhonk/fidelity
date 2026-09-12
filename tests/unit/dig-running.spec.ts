import { afterEach, describe, expect, it, vi } from 'vitest'

import { deleteFidelityDb } from '~~/db/open'
import type { DiscogsClient } from '~~/worker/discogs/client'
import { runDig, runningDig } from '~~/worker/dig/scan'

afterEach(async () => {
  await deleteFidelityDb()
})

/**
 * "A scan is already running" — of which shop, and how far (2026-09-12).
 *
 * A scan outlives the page that started it, and a page opened afterwards
 * used to learn nothing beyond that sentence. The worker now says which
 * shop and hands over the last progress it reported, and the refusal
 * carries the shop's name so the screen can say it.
 */
function slowShop(name: string) {
  let releasePage: () => void = () => {}
  const gate = new Promise<void>((resolve) => (releasePage = resolve))

  const get = vi.fn(
    async (path: string, schema: { parse: (v: unknown) => unknown }, options) => {
      if (!path.includes('/inventory'))
        return schema.parse({ username: name, num_for_sale: 100 })
      const page = (options?.query?.page as number) ?? 1
      // The first page waits until the test says so — a scan in flight.
      if (page === 1) await gate
      return schema.parse({
        pagination: { page, pages: 1, items: 100 },
        listings: Array.from({ length: 100 }, (_, i) => ({
          id: page * 1000 + i,
          status: 'For Sale',
          condition: 'Near Mint (NM or M-)',
          price: { value: 12, currency: 'EUR' },
          release: {
            id: page * 1000 + i,
            title: `Record ${i}`,
            artist: 'Unknown',
            format: '12"',
          },
        })),
      })
    },
  )
  return { client: { get } as unknown as DiscogsClient, releasePage: () => releasePage() }
}

describe('what is scanning right now', () => {
  it('names the shop, refuses a second start with that name, and forgets it when done', async () => {
    expect(runningDig()).toBeNull()

    const shop = slowShop('vinyl-tom')
    const reports: number[] = []
    const first = runDig({
      client: shop.client,
      dealer: 'vinyl-tom',
      digId: '01A',
      report: (p) => reports.push(p.scanned),
    })
    // Let the pre-check go through so the scan is properly in flight.
    await new Promise((done) => setTimeout(done, 20))

    expect(runningDig()).toMatchObject({ digId: '01A', dealer: 'vinyl-tom' })

    await expect(
      runDig({ client: slowShop('other-shop').client, dealer: 'other-shop', digId: '01B' }),
    ).rejects.toMatchObject({ code: 'dig-running', dealer: 'vinyl-tom' })

    shop.releasePage()
    await first

    expect(runningDig()).toBeNull()
    expect(reports.length).toBeGreaterThan(0)
  })

  it('hands over the last progress it reported', async () => {
    const shop = slowShop('vinyl-tom')
    const first = runDig({ client: shop.client, dealer: 'vinyl-tom', digId: '01C' })
    await new Promise((done) => setTimeout(done, 20))
    shop.releasePage()
    await first
    // After the scan nothing is running and nothing is remembered.
    expect(runningDig()).toBeNull()
  })
})
