import { afterEach, describe, expect, it, vi } from 'vitest'

import { blankDealer } from '~~/db/dealer'
import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import type { DiscogsClient } from '~~/worker/discogs/client'
import { NoAnchorYet, PER_PAGE, runDig } from '~~/worker/dig/scan'

afterEach(async () => {
  await deleteFidelityDb()
})

/**
 * „Nur das Neue" — der Besuch, der zwei Abfragen kostet statt zweihundert.
 *
 * The watchlist can say a shop's total moved; until now the only answer to
 * that was a full rescan, four minutes of somebody's rate limit to find twelve
 * records. `sort=listed&sort_order=desc` hands the shop back newest first, so a
 * walk that stops at the first listing it already knows has seen everything new
 * and nothing else.
 *
 * The dangerous failure is stopping too early and silently missing arrivals,
 * so that is what most of this is about.
 */

/** A shop whose listings are `count` records, newest first, one per hour. */
function fakeShop(count: number) {
  const asked: { sort: string; order: string; page: number }[] = []

  const all = Array.from({ length: count }, (_, index) => ({
    id: 9000 + index,
    // index 0 is the newest; each one an hour older than the last.
    posted: new Date(Date.parse('2026-08-05T12:00:00Z') - index * 3_600_000).toISOString(),
  }))

  const get = vi.fn(
    async (path: string, schema: { parse: (v: unknown) => unknown }, options) => {
      if (!path.includes('/inventory')) {
        return schema.parse({ username: 'stammladen', num_for_sale: count })
      }

      const page = (options?.query?.page as number) ?? 1
      asked.push({
        sort: String(options?.query?.sort),
        order: String(options?.query?.sort_order),
        page,
      })

      const slice = all.slice((page - 1) * PER_PAGE, page * PER_PAGE)
      return schema.parse({
        pagination: { page, pages: Math.ceil(count / PER_PAGE), items: count },
        listings: slice.map((row) => ({
          id: row.id,
          posted: row.posted,
          status: 'For Sale',
          condition: 'Near Mint (NM or M-)',
          price: { value: 12, currency: 'EUR' },
          release: {
            id: row.id,
            title: `Platte ${row.id}`,
            artist: 'Wer auch immer',
            format: '12"',
          },
        })),
      })
    },
  )

  return { client: { get } as unknown as DiscogsClient, asked }
}

async function remember(newestListedAt: string | null) {
  const db = await openFidelityDb()
  await db.put('dealers', { ...blankDealer('stammladen'), numForSale: 4000, newestListedAt })
}

describe('nur das Neue', () => {
  it('refuses when no full dig has been run here yet', async () => {
    const { client, asked } = fakeShop(300)

    await expect(
      runDig({ client, dealer: 'stammladen', digId: '01A', depth: 'neu' }),
    ).rejects.toBeInstanceOf(NoAnchorYet)

    // And spends nothing finding that out.
    expect(asked).toEqual([])
  })

  it('falls back to the last scan for shops dug before the anchor existed', async () => {
    /*
     * Every shop already in somebody's database has `lastScannedAt` and no
     * `newestListedAt`. Without a fallback the feature would only work on
     * shops dug from today on, which for a collector who has spent a week
     * building a list of shops is the wrong half.
     *
     * The hour of slack is why this reads six records rather than five: the
     * scan takes minutes, and a record listed while it ran would otherwise sit
     * just under a finish-time anchor and never be seen again.
     */
    const db = await openFidelityDb()
    await db.put('dealers', {
      ...blankDealer('stammladen'),
      numForSale: 4000,
      lastScannedAt: Date.parse('2026-08-05T12:00:00Z') - 5 * 3_600_000,
      newestListedAt: null,
    })

    const { client, asked } = fakeShop(4000)
    const dig = await runDig({ client, dealer: 'stammladen', digId: '01G', depth: 'neu' })

    expect(asked).toHaveLength(1)
    expect(dig.uniqueSeen).toBe(6)
  })

  it('reads one page for a handful of new records', async () => {
    // Twelve records are newer than the anchor; the rest the shop already had.
    await remember(new Date(Date.parse('2026-08-05T12:00:00Z') - 12 * 3_600_000).toISOString())
    const { client, asked } = fakeShop(4000)

    const dig = await runDig({ client, dealer: 'stammladen', digId: '01B', depth: 'neu' })

    expect(asked).toEqual([{ sort: 'listed', order: 'desc', page: 1 }])
    expect(dig.uniqueSeen).toBe(12)
    /*
     * One request, and not the two a full dig would start with: the shop's
     * total and the anchor are both on the dealer record already, so the
     * pre-check has nothing to find out.
     */
    expect(dig.apiRequests).toBe(1)
  })

  it('keeps reading while a whole page is new', async () => {
    // Everything is newer than a very old anchor, so page 1 cannot end it.
    await remember('2020-01-01T00:00:00Z')
    const { client, asked } = fakeShop(250)

    const dig = await runDig({ client, dealer: 'stammladen', digId: '01C', depth: 'neu' })

    expect(asked.map((call) => call.page)).toEqual([1, 2, 3])
    expect(dig.uniqueSeen).toBe(250)
  })

  it('finds nothing when nothing has been listed since', async () => {
    await remember('2026-08-05T12:00:00Z')
    const { client } = fakeShop(4000)

    const dig = await runDig({ client, dealer: 'stammladen', digId: '01D', depth: 'neu' })

    expect(dig.uniqueSeen).toBe(0)
    expect(dig.matchCount).toBe(0)
    // Complete, not empty-because-it-failed.
    expect(dig.coverage).toBe(1)
  })

  it('leaves the shop profile that the full digs built alone', async () => {
    const db = await openFidelityDb()
    await db.put('dealers', {
      ...blankDealer('stammladen'),
      numForSale: 4000,
      affinity: 7.5,
      lastScannedAt: 1_700_000_000_000,
      newestListedAt: new Date(Date.parse('2026-08-05T12:00:00Z') - 3_600_000).toISOString(),
    })

    const { client } = fakeShop(4000)
    await runDig({ client, dealer: 'stammladen', digId: '01E', depth: 'neu' })

    const dealer = await db.get('dealers', 'stammladen')

    /*
     * A visit that read one record off the top knows nothing about the hit
     * rate of a four-thousand-record shop, and writing one would quietly
     * corrupt what the full digs measured.
     */
    expect(dealer?.affinity).toBe(7.5)
    expect(dealer?.numForSale).toBe(4000)
    expect(dealer?.lastScannedAt).toBe(1_700_000_000_000)
    // The one thing it does know, and nothing else does.
    expect(dealer?.newestListedAt).toBe('2026-08-05T12:00:00.000Z')
  })

  it('writes the anchor on an ordinary dig, so the next visit can be cheap', async () => {
    const { client } = fakeShop(150)

    await runDig({ client, dealer: 'stammladen', digId: '01F' })

    const dealer = await (await openFidelityDb()).get('dealers', 'stammladen')
    expect(dealer?.newestListedAt).toBe('2026-08-05T12:00:00.000Z')
  })
})
