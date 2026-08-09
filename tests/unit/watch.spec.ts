import { afterEach, describe, expect, it, vi } from 'vitest'

import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import type { Dealer } from '#shared/types'
import type { DiscogsClient } from '~~/worker/discogs/client'
import {
  checkWatched,
  MIN_CHECK_INTERVAL_MS,
  setWatching,
  watchedDealers,
} from '~~/worker/watch/check'

afterEach(async () => {
  await deleteFidelityDb()
})

const dealer = (username: string, over: Partial<Dealer> = {}): Dealer => ({
  username,
  displayName: username,
  shipsFrom: 'Germany',
  sellerRating: 99,
  ratingCount: 10,
  numForSale: 1000,
  minOrderTotal: 0,
  shippingNote: '',
  lastScannedAt: 1,
  affinity: null,
  fingerprint: null,
  shippingTiers: [],
  ...over,
})

function client(numForSale: Record<string, number>) {
  const get = vi.fn(async (path: string, schema: { parse: (v: unknown) => unknown }) => {
    const username = decodeURIComponent(/\/users\/([^/?]+)/.exec(path)?.[1] ?? '')
    if (!(username in numForSale)) throw new Error('404')
    return schema.parse({ username, num_for_sale: numForSale[username] })
  })
  return { client: { get } as unknown as DiscogsClient, get }
}

const NOW = 1_000_000_000_000

async function seed(...dealers: Dealer[]) {
  const db = await openFidelityDb()
  for (const d of dealers) await db.put('dealers', d)
  return db
}

describe('watching a dealer', () => {
  it('takes the current count as the baseline when watching starts', async () => {
    await seed(dealer('vinyl-tom', { numForSale: 1000 }))
    const updated = await setWatching('vinyl-tom', true)

    // The first check should compare against the shop as it was when you
    // asked, not against zero.
    expect(updated).toMatchObject({ watching: true, watchNumForSale: 1000 })
  })

  it('has no baseline for a shop that was never scanned', async () => {
    // A dealer row created by hand — entering a shipping table for a shop
    // never scanned — has numForSale 0. Using that as the baseline would make
    // the first check report the shop's whole stock as new.
    await seed(dealer('nur-versand', { numForSale: 0, lastScannedAt: null }))
    expect(await setWatching('nur-versand', true)).toMatchObject({
      watching: true,
      watchNumForSale: null,
    })

    const { client: api } = client({ 'nur-versand': 35_903 })
    expect((await checkWatched({ client: api, now: NOW })).alerts).toEqual([])

    const db = await openFidelityDb()
    expect((await db.get('dealers', 'nur-versand'))?.watchNumForSale).toBe(35_903)
  })

  it('forgets the baseline when watching stops', async () => {
    await seed(dealer('vinyl-tom', { watching: true, watchNumForSale: 900 }))
    expect(await setWatching('vinyl-tom', false)).toMatchObject({
      watching: false,
      watchNumForSale: null,
    })
    expect(await watchedDealers()).toEqual([])
  })

  it('cannot watch a dealer that was never scanned', async () => {
    expect(await setWatching('nie-gesehen', true)).toBeNull()
  })
})

describe('the cheap change detector', () => {
  it('asks one request per shop, not a hundred', async () => {
    await seed(
      dealer('a', { watching: true, watchNumForSale: 100 }),
      dealer('b', { watching: true, watchNumForSale: 200 }),
    )

    const { client: api, get } = client({ a: 100, b: 200 })
    const result = await checkWatched({ client: api, now: NOW })

    // A full rescan is a hundred requests. This is the whole reason the
    // watchlist is affordable at all (docs/06 M6).
    expect(get).toHaveBeenCalledTimes(2)
    expect(result.requests).toBe(2)
  })

  it('reports a shop whose count grew', async () => {
    await seed(dealer('vinyl-tom', { watching: true, watchNumForSale: 1000 }))

    const { client: api } = client({ 'vinyl-tom': 1040 })
    const { alerts } = await checkWatched({ client: api, now: NOW })

    expect(alerts).toEqual([{ dealer: 'vinyl-tom', newListings: 40, seenAt: NOW }])
  })

  it('says nothing when a shop shrank or stood still', async () => {
    await seed(
      dealer('a', { watching: true, watchNumForSale: 1000 }),
      dealer('b', { watching: true, watchNumForSale: 1000 }),
    )

    const { client: api } = client({ a: 1000, b: 900 })
    expect((await checkWatched({ client: api, now: NOW })).alerts).toEqual([])
  })

  it('stays quiet on the very first sighting', async () => {
    // An alert on the first check would be every shop, every time.
    await seed(dealer('vinyl-tom', { watching: true, watchNumForSale: null }))

    const { client: api } = client({ 'vinyl-tom': 1040 })
    const { alerts } = await checkWatched({ client: api, now: NOW })
    expect(alerts).toEqual([])

    // …but the baseline is written, so the next change is caught.
    const db = await openFidelityDb()
    expect((await db.get('dealers', 'vinyl-tom'))?.watchNumForSale).toBe(1040)
  })

  it('ignores dealers that are not watched', async () => {
    await seed(dealer('a'), dealer('b', { watching: false }))
    const { client: api, get } = client({ a: 5000, b: 5000 })

    await checkWatched({ client: api, now: NOW })
    expect(get).not.toHaveBeenCalled()
  })

  it('does not re-check a shop it looked at an hour ago', async () => {
    await seed(
      dealer('vinyl-tom', {
        watching: true,
        watchNumForSale: 1000,
        watchCheckedAt: NOW - 60 * 60 * 1000,
      }),
    )

    const { client: api, get } = client({ 'vinyl-tom': 2000 })
    const result = await checkWatched({ client: api, now: NOW })

    expect(get).not.toHaveBeenCalled()
    expect(result.skipped).toBe(1)
  })

  it('checks anyway when asked directly', async () => {
    await seed(
      dealer('vinyl-tom', {
        watching: true,
        watchNumForSale: 1000,
        watchCheckedAt: NOW - 60 * 1000,
      }),
    )

    const { client: api } = client({ 'vinyl-tom': 1040 })
    const { alerts } = await checkWatched({ client: api, now: NOW, force: true })
    expect(alerts).toHaveLength(1)
  })

  it('re-checks once the interval has passed', async () => {
    await seed(
      dealer('vinyl-tom', {
        watching: true,
        watchNumForSale: 1000,
        watchCheckedAt: NOW - MIN_CHECK_INTERVAL_MS - 1,
      }),
    )

    const { client: api } = client({ 'vinyl-tom': 1040 })
    expect((await checkWatched({ client: api, now: NOW })).alerts).toHaveLength(1)
  })

  it('keeps going when one shop will not answer', async () => {
    await seed(
      dealer('kaputt', { watching: true, watchNumForSale: 100 }),
      dealer('heil', { watching: true, watchNumForSale: 100 }),
    )

    const { client: api } = client({ heil: 140 })
    const { alerts } = await checkWatched({ client: api, now: NOW })
    expect(alerts.map((a) => a.dealer)).toEqual(['heil'])

    // The broken one keeps its old watermark, so the next start tries again.
    const db = await openFidelityDb()
    expect((await db.get('dealers', 'kaputt'))?.watchCheckedAt).toBeUndefined()
  })

  it('puts the biggest change first', async () => {
    await seed(
      dealer('klein', { watching: true, watchNumForSale: 100 }),
      dealer('gross', { watching: true, watchNumForSale: 100 }),
    )

    const { client: api } = client({ klein: 105, gross: 400 })
    const { alerts } = await checkWatched({ client: api, now: NOW })
    expect(alerts.map((a) => a.dealer)).toEqual(['gross', 'klein'])
  })
})
