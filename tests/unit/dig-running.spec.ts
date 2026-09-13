import { afterEach, describe, expect, it, vi } from 'vitest'

import { deleteFidelityDb } from '~~/db/open'
import type { DiscogsClient } from '~~/worker/discogs/client'
import { runDig, runningDig } from '~~/worker/dig/scan'
import { handlers } from '~~/worker/handlers'

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

const ctx = { report: () => {}, signal: new AbortController().signal }

/**
 * "0 Treffer bei Vinylvoorelkaar · 0 von 5.551 gescannt (0 %)" — under a bar
 * reading "443 von 5.551 · 45 Treffer". One screenshot, 2026-09-13, two
 * numbers about the same shop at the same second.
 *
 * The running dig is a row in the database like any other, and it is the
 * newest one there is: written before the first page, updated after each. So
 * `dig.latest` handed it over at whatever it happened to say — and a screen
 * that opened as a scan began got a row of noughts, with the acquittal
 * underneath it: "nothing here for you at this shop".
 *
 * The bar is what tells the truth while a scan runs. The result list shows the
 * last dig that is finished with, or nothing at all.
 */
describe('the latest dig is never the one being scanned', () => {
  it('hands back the previous dig while a scan runs, and the new one after', async () => {
    const done = slowShop('first-shop')
    done.releasePage()
    await runDig({ client: done.client, dealer: 'first-shop', digId: '01D' })

    const running = slowShop('second-shop')
    const scan = runDig({ client: running.client, dealer: 'second-shop', digId: '02D' })
    await new Promise((tick) => setTimeout(tick, 20))

    expect(runningDig()).toMatchObject({ digId: '02D' })
    const latest = await handlers['dig.latest'](undefined, ctx)
    expect(latest?.dig.id).toBe('01D')

    running.releasePage()
    await scan

    const after = await handlers['dig.latest'](undefined, ctx)
    expect(after?.dig.id).toBe('02D')
  })

  it('answers nothing rather than a row of noughts when the first dig is the running one', async () => {
    const running = slowShop('only-shop')
    const scan = runDig({ client: running.client, dealer: 'only-shop', digId: '03D' })
    await new Promise((tick) => setTimeout(tick, 20))

    await expect(handlers['dig.latest'](undefined, ctx)).resolves.toBeNull()

    running.releasePage()
    await scan
  })
})
