import { afterEach, describe, expect, it, vi } from 'vitest'

import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import type { Dig, Match } from '#shared/types'
import type { DiscogsClient } from '~~/worker/discogs/client'
import { FOR_SALE, refreshDig } from '~~/worker/dig/refresh'

afterEach(async () => {
  await deleteFidelityDb()
})

const NOW = 1_800_000_000_000

const dig: Dig = {
  id: '01A',
  dealer: '430AM_Studio',
  status: 'expired',
  startedAt: NOW - 12 * 3600_000,
  finishedAt: NOW - 12 * 3600_000,
  expiresAt: NOW - 6 * 3600_000,
  listingsTotal: 20_000,
  listingsScanned: 20_000,
  coverage: 1,
  matchCount: 2,
  apiRequests: 200,
  cursor: null,
}

function match(over: Partial<Match> = {}): Match {
  return {
    digId: '01A',
    listingId: 1,
    releaseId: 10,
    score: 87,
    signals: [{ type: 'WANTLIST_EXACT', confidence: 1, evidence: {} }],
    reason: 'Steht genau so auf deiner Wantlist.',
    title: 'Dummy',
    artist: 'Portishead',
    label: null,
    catno: null,
    format: 'LP',
    year: 2017,
    // Expired: the marketplace half was already stripped.
    condition: null,
    sleeve: null,
    price: null,
    currency: null,
    comments: null,
    thumbUrl: null,
    marketLowestPrice: null,
    marketNumForSale: null,
    expired: true,
    ...over,
  }
}

function client(listings: Record<number, unknown>) {
  const get = vi.fn(async (path: string, schema: { parse: (v: unknown) => unknown }) => {
    const id = Number(/\/marketplace\/listings\/(\d+)/.exec(path)?.[1] ?? 0)
    const body = listings[id]
    if (body === undefined) throw new Error('404')
    return schema.parse(body)
  })
  return { client: { get } as unknown as DiscogsClient, get }
}

const forSale = (id: number, price: number) => ({
  id,
  status: FOR_SALE,
  condition: 'Mint (M)',
  sleeve_condition: 'Mint (M)',
  comments: 'sealed',
  price: { value: price, currency: 'EUR' },
})

async function seed(...matches: Match[]) {
  const db = await openFidelityDb()
  await db.put('digs', dig)
  for (const m of matches) await db.put('matches', m)
  return db
}

describe('bringing an expired dig back', () => {
  it('costs one request per match, not a rescan', async () => {
    const db = await seed(match({ listingId: 1 }), match({ listingId: 2, score: 60 }))
    const { client: api, get } = client({ 1: forSale(1, 33.99), 2: forSale(2, 5.99) })

    const result = await refreshDig({ client: api, digId: '01A', currency: 'EUR', now: NOW })

    // A full rescan of this dealer was two hundred requests and four minutes.
    expect(get).toHaveBeenCalledTimes(2)
    expect(result).toMatchObject({ refreshed: 2, sold: 0, requests: 2, gone: 0 })
    expect((await db.get('matches', ['01A', 1]))?.price).toBe(33.99)
  })

  it('asks in the currency the account uses', async () => {
    await seed(match())
    const { client: api, get } = client({ 1: forSale(1, 10) })
    await refreshDig({ client: api, digId: '01A', currency: 'GBP', now: NOW })

    expect(get).toHaveBeenCalledWith(
      '/marketplace/listings/1',
      expect.anything(),
      expect.objectContaining({ query: { curr_abbr: 'GBP' } }),
    )
  })

  it('marks a record that sold, and does not keep its old price', async () => {
    const db = await seed(
      match({ listingId: 1, price: 33.99, currency: 'EUR', expired: false }),
    )
    const { client: api } = client({ 1: { id: 1, status: 'Sold', price: { value: 33.99 } } })

    const result = await refreshDig({ client: api, digId: '01A', currency: 'EUR', now: NOW })

    expect(result.sold).toBe(1)
    const updated = await db.get('matches', ['01A', 1])
    expect(updated?.price).toBeNull()
    expect(updated?.expired).toBe(true)
    // What the app worked out itself survives — that is ours, not Discogs'.
    expect(updated?.score).toBe(87)
    expect(updated?.reason).toContain('Wantlist')
  })

  it('treats a listing that will not load as gone', async () => {
    const db = await seed(match({ listingId: 1 }))
    const { client: api } = client({})

    expect(
      await refreshDig({ client: api, digId: '01A', currency: 'EUR', now: NOW }),
    ).toMatchObject({ gone: 1, refreshed: 0 })
    expect((await db.get('matches', ['01A', 1]))?.expired).toBe(true)
  })

  it('restarts the six-hour clock, because the data is new', async () => {
    const db = await seed(match())
    const { client: api } = client({ 1: forSale(1, 10) })

    await refreshDig({ client: api, digId: '01A', currency: 'EUR', now: NOW })
    expect((await db.get('digs', '01A'))?.expiresAt).toBe(NOW + 6 * 3600_000)
  })

  it('leaves the clock alone when everything sold', async () => {
    // A dig with nothing still for sale has nothing to show and should not
    // look fresh.
    const db = await seed(match())
    const { client: api } = client({ 1: { id: 1, status: 'Sold' } })

    await refreshDig({ client: api, digId: '01A', currency: 'EUR', now: NOW })
    expect((await db.get('digs', '01A'))?.expiresAt).toBe(dig.expiresAt)
  })

  it('does the strongest matches first, so an interruption costs the weakest', async () => {
    await seed(match({ listingId: 1, score: 40 }), match({ listingId: 2, score: 90 }))
    const { client: api, get } = client({ 1: forSale(1, 5), 2: forSale(2, 30) })

    await refreshDig({ client: api, digId: '01A', currency: 'EUR', now: NOW })
    expect(get.mock.calls[0]?.[0]).toBe('/marketplace/listings/2')
  })

  it('reports progress while it runs', async () => {
    await seed(match({ listingId: 1 }), match({ listingId: 2, score: 50 }))
    const { client: api } = client({ 1: forSale(1, 5), 2: { id: 2, status: 'Sold' } })

    const seen: number[] = []
    await refreshDig({
      client: api,
      digId: '01A',
      currency: 'EUR',
      now: NOW,
      report: (p) => seen.push(p.done),
    })
    expect(seen.at(-1)).toBe(2)
  })

  it('refuses a dig that is not there', async () => {
    const { client: api } = client({})
    await expect(
      refreshDig({ client: api, digId: 'weg', currency: 'EUR', now: NOW }),
    ).rejects.toThrow()
  })
})
