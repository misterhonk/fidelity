import { afterEach, describe, expect, it, vi } from 'vitest'

import { blankDealer } from '~~/db/dealer'
import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import type { DiscogsClient } from '~~/worker/discogs/client'
import { runDig } from '~~/worker/dig/scan'
import { StaleStockCounter } from '~~/worker/dig/stale'

afterEach(async () => {
  await deleteFidelityDb()
})

/** A shop of `total` listings, every one put up in 2010 — so any count says 100 %. */
function shop(total: number) {
  const get = vi.fn(
    async (path: string, schema: { parse: (v: unknown) => unknown }, options) => {
      if (!path.includes('/inventory')) {
        return schema.parse({ username: 'kiste', num_for_sale: total })
      }
      const page = (options?.query?.page as number) ?? 1
      const base = options?.query?.sort_order === 'desc' ? 1_000_000 : 0
      const count = Math.max(0, Math.min(100, total - (page - 1) * 100))
      return schema.parse({
        pagination: { page, pages: Math.ceil(total / 100), items: total },
        listings: Array.from({ length: count }, (_, i) => ({
          id: base + page * 1000 + i,
          status: 'For Sale',
          condition: 'Near Mint (NM or M-)',
          price: { value: 12, currency: 'EUR' },
          posted: '2010-01-01T00:00:00Z',
          release: {
            id: 1,
            title: 'Platte',
            artist: 'X',
            format: 'LP',
            label: 'Y',
            year: 2003,
          },
        })),
      })
    },
  )
  return { get } as unknown as DiscogsClient
}

const NOW = Date.parse('2026-11-02T12:00:00Z')

describe('counting stale stock (#244)', () => {
  it('counts listings put up more than five years before the dig', () => {
    const counter = new StaleStockCounter(NOW)
    counter.add('2021-11-01T10:00:00-07:00') // a day past five years
    counter.add('2016-03-14T10:00:00-07:00')
    counter.add('2021-11-03T10:00:00-07:00') // a day short of it
    counter.add('2026-10-30T10:00:00-07:00')

    expect(counter.build()).toEqual({ old: 2, dated: 4, asOf: NOW })
  })

  it('leaves listings without a date out of the denominator', () => {
    const counter = new StaleStockCounter(NOW)
    counter.add('2010-01-01T00:00:00Z')
    counter.add(undefined)
    counter.add('not a date')

    expect(counter.build()).toEqual({ old: 1, dated: 1, asOf: NOW })
  })

  it('says nothing rather than 0 of 0', () => {
    expect(new StaleStockCounter(NOW).build()).toBeNull()
  })
})

describe('which dig may say how stale a shop is (#244)', () => {
  const earlier = { old: 4, dated: 10, asOf: 1 }

  it('a whole dig writes its count', async () => {
    await runDig({ client: shop(200), dealer: 'kiste', digId: '01A' })

    const dealer = await (await openFidelityDb()).get('dealers', 'kiste')
    expect(dealer?.staleStock).toMatchObject({ old: 200, dated: 200 })
  })

  it('a truncated dig keeps the last honest count', async () => {
    const db = await openFidelityDb()
    await db.put('dealers', { ...blankDealer('kiste'), staleStock: earlier })

    // 30.000 listings: the two windows are the oldest and newest 10.000 — not the shop.
    await runDig({ client: shop(30_000), dealer: 'kiste', digId: '01B' })

    const dealer = await db.get('dealers', 'kiste')
    expect(dealer?.lastScannedAt).not.toBeNull()
    expect(dealer?.staleStock).toEqual(earlier)
    // 200 pages through fake-indexeddb: a few seconds, more on a busy runner.
  }, 30_000)
})
