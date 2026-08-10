import { afterEach, describe, expect, it, vi } from 'vitest'

import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import type { DiscogsClient } from '~~/worker/discogs/client'
import { MAX_PAGES, NORMAL_PASSES, PER_PAGE, runDig, SCAN_PASSES } from '~~/worker/dig/scan'

afterEach(async () => {
  await deleteFidelityDb()
})

/**
 * Der Tiefenscan: an einem Laden vorbei, der größer ist als die Wand.
 *
 * Page 101 of a foreign inventory is 403 and `per_page` is clamped to 100, so
 * one ordering can never return more than 10.000 listings. Every sort key is a
 * different window onto the same shop, and walking several of them is the only
 * way past that — at the price of a hundred requests each, which is why the
 * cheap parts of this (stopping when a pass is dry, skipping the whole thing
 * on a small shop) are the parts worth testing.
 */

interface ShopOptions {
  /** What the profile claims, which is what decides whether passes run. */
  total: number
  /**
   * Which listing ids a given ordering hands back, as a function of the pass.
   * Defaults to every ordering returning the same records — the worst case,
   * and the one the convergence check exists for.
   */
  windowFor?: (sort: string, order: string) => number[]
}

function fakeShop({ total, windowFor }: ShopOptions) {
  const asked: { sort: string; order: string; page: number }[] = []

  const ids = (sort: string, order: string) =>
    windowFor?.(sort, order) ?? Array.from({ length: Math.min(total, 300) }, (_, i) => i)

  const get = vi.fn(
    async (path: string, schema: { parse: (v: unknown) => unknown }, options) => {
      if (!path.includes('/inventory')) {
        return schema.parse({ username: 'grosser-laden', num_for_sale: total })
      }

      const page = (options?.query?.page as number) ?? 1
      const sort = String(options?.query?.sort ?? 'listed')
      const order = String(options?.query?.sort_order ?? 'asc')
      asked.push({ sort, order, page })

      const all = ids(sort, order)
      const slice = all.slice((page - 1) * PER_PAGE, page * PER_PAGE)

      return schema.parse({
        pagination: { page, pages: Math.ceil(all.length / PER_PAGE), items: total },
        listings: slice.map((id) => ({
          id,
          status: 'For Sale',
          condition: 'Near Mint (NM or M-)',
          price: { value: 12, currency: 'EUR' },
          release: { id, title: `Platte ${id}`, artist: 'Unbekannt', format: '12"' },
        })),
      })
    },
  )

  return { client: { get } as unknown as DiscogsClient, asked }
}

/** Which orderings the run actually asked for, in order, without duplicates. */
function passesUsed(asked: { sort: string; order: string }[]): string[] {
  const seen: string[] = []
  for (const { sort, order } of asked) {
    const key = `${sort} ${order}`
    if (seen[seen.length - 1] !== key) seen.push(key)
  }
  return seen
}

const WALL = PER_PAGE * MAX_PAGES

describe('the deep scan', () => {
  it('walks one ordering when the shop fits behind the wall', async () => {
    const { client, asked } = fakeShop({ total: 300 })

    await runDig({ client, dealer: 'grosser-laden', digId: '01A', depth: 'deep' })

    /*
     * 300 listings fit in three pages of one ordering. Every further pass
     * would be a hundred requests for a set that cannot grow — this is the
     * guard that keeps a deep scan of a small shop from costing 28 minutes
     * to learn nothing.
     */
    expect(passesUsed(asked)).toEqual(['listed asc'])
  })

  it('gives up on an ordering that turns up nothing new', async () => {
    // Every ordering returns the same 300 records, which is the pathological
    // case: a shop that claims 30.000 but only ever shows the same window.
    const { client, asked } = fakeShop({ total: WALL + 5000 })

    await runDig({ client, dealer: 'grosser-laden', digId: '01B', depth: 'deep' })

    /*
     * asc and desc are the ordinary pair and always run. `price asc` is the
     * first pass that could have added something, adds nothing, and stops the
     * run — the ten orderings after it are the most correlated of the set.
     */
    expect(passesUsed(asked)).toEqual(['listed asc', 'listed desc', 'price asc'])
  })

  it('keeps going while the orderings keep finding records', async () => {
    // Each ordering opens onto its own slice, so nothing converges early.
    const { client, asked } = fakeShop({
      total: WALL + 5000,
      windowFor: (sort, order) => {
        const offset = SCAN_PASSES.findIndex((p) => p.sort === sort && p.order === order) * 300
        return Array.from({ length: 300 }, (_, i) => offset + i)
      },
    })

    await runDig({ client, dealer: 'grosser-laden', digId: '01C', depth: 'deep' })

    expect(passesUsed(asked)).toHaveLength(SCAN_PASSES.length)

    const dig = (await openFidelityDb()).get('digs', '01C')
    // 13 disjoint windows of 300.
    expect((await dig)?.uniqueSeen).toBe(SCAN_PASSES.length * 300)
  })

  it('counts coverage in records, not in rows', async () => {
    /*
     * The bug this replaced: `scanned` counts rows, and a shop walked from
     * both ends returns the middle twice. With thirteen orderings over the
     * same 300 records it would have claimed 1.300 % of a 600-record shop.
     */
    const { client } = fakeShop({ total: WALL + 5000 })

    await runDig({ client, dealer: 'grosser-laden', digId: '01D', depth: 'deep' })

    const dig = await (await openFidelityDb()).get('digs', '01D')

    expect(dig?.uniqueSeen).toBe(300)
    expect(dig?.listingsScanned).toBeGreaterThan(300)
    expect(dig?.coverage).toBeCloseTo(300 / (WALL + 5000), 5)
    expect(dig?.coverage).toBeLessThan(1)
  })

  it('leaves an ordinary dig walking exactly the two passes it always did', async () => {
    const { client, asked } = fakeShop({ total: WALL + 5000 })

    await runDig({ client, dealer: 'grosser-laden', digId: '01E' })

    expect(passesUsed(asked)).toEqual(['listed asc', 'listed desc'])
    expect(NORMAL_PASSES).toHaveLength(2)

    const dig = await (await openFidelityDb()).get('digs', '01E')
    expect(dig?.depth).toBe('normal')
  })
})
