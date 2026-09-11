import { afterEach, describe, expect, it, vi } from 'vitest'

import { blankDealer } from '~~/db/dealer'
import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import type { DiscogsClient } from '~~/worker/discogs/client'
import { discoverDealers } from '~~/worker/dealers/discover'
import { hiddenDealers, setHidden, visibleDealers } from '~~/worker/dealers/hide'
import { homeOverview } from '~~/worker/home'
import { stackOverview } from '~~/worker/stack'
import { setWatching } from '~~/worker/watch/check'

afterEach(async () => {
  await deleteFidelityDb()
})

/**
 * "Never show this one again" (docs/06 M19 #2).
 *
 * The promise is about *every* list, not one screen: a shop hidden on the
 * shops page that still turns up on the start page or in the suggestions is a
 * setting that does not work. So each list is checked here, against the
 * worker function the screen calls — not against the screen.
 */

async function shop(username: string, over: Partial<ReturnType<typeof blankDealer>> = {}) {
  const db = await openFidelityDb()
  await db.put('dealers', {
    ...blankDealer(username),
    lastScannedAt: 1_800_000_000_000,
    affinity: 2,
    numForSale: 500,
    ...over,
  })
}

describe('hiding a shop', () => {
  it('marks the row and leaves the others alone', async () => {
    await shop('a')
    await shop('b')

    await setHidden('a', true, 1_800_000_000_000)

    expect((await visibleDealers()).map((d) => d.username)).toEqual(['b'])
    expect((await hiddenDealers()).map((d) => d.username)).toEqual(['a'])
  })

  it('stops watching it — a notification about a hidden shop would be the app contradicting itself', async () => {
    await shop('a')
    await setWatching('a', true)

    const hidden = await setHidden('a', true)

    expect(hidden.watching).toBe(false)
    expect(hidden.watchNumForSale).toBeNull()
  })

  it('creates a row for a suggestion that never had one, so the next run leaves it out', async () => {
    await setHidden('stranger', true)
    expect((await hiddenDealers()).map((d) => d.username)).toEqual(['stranger'])
  })

  it('and is undone the same way', async () => {
    await shop('a')
    await setHidden('a', true)
    await setHidden('a', false)

    expect((await visibleDealers()).map((d) => d.username)).toEqual(['a'])
    expect(await hiddenDealers()).toEqual([])
  })
})

describe('where a hidden shop no longer appears', () => {
  it('the start page — its shop list and its count', async () => {
    await shop('a')
    await shop('b')
    await setHidden('a', true)

    const home = await homeOverview()
    expect(home.shops.map((s) => s.username)).toEqual(['b'])
    expect(home.library.dealers).toBe(1)
  })

  it('the stack, even with a fresh dig', async () => {
    const db = await openFidelityDb()
    await shop('a')
    await setHidden('a', true)
    const now = 1_800_000_000_000
    await db.put('digs', {
      id: '01J0000000000000000000DIG1',
      dealer: 'a',
      status: 'done',
      startedAt: now,
      finishedAt: now + 1000,
      expiresAt: now + 6 * 60 * 60 * 1000,
      listingsTotal: 1,
      listingsScanned: 1,
      coverage: 1,
      truncated: false,
      matchCount: 1,
      apiRequests: 1,
      cursor: null,
    } as never)
    await db.put('matches', {
      digId: '01J0000000000000000000DIG1',
      listingId: 1,
      releaseId: 1,
      score: 50,
      signals: [],
      title: 'Platte',
      artist: 'Someone',
      thumbUrl: null,
      price: 10,
      currency: 'EUR',
      expired: false,
    } as never)

    expect(await stackOverview(now + 1)).toEqual([])
  })

  it('the suggestions — not "already there", not there at all', async () => {
    await setHidden('plattenkiste', true)

    const get = vi.fn(async (path: string, schema: { parse: (v: unknown) => unknown }) => {
      if (path.includes('/marketplace/orders')) {
        return schema.parse({
          orders: [{ seller: { username: 'plattenkiste' } }, { seller: { username: 'other' } }],
        })
      }
      const username = path.includes('plattenkiste') ? 'plattenkiste' : 'other'
      return schema.parse({
        username,
        num_for_sale: 900,
        seller_rating: 99,
        seller_num_ratings: 120,
        location: 'Germany',
      })
    })
    const result = await discoverDealers({
      client: { get } as unknown as DiscogsClient,
      username: 'ich',
      includeFriends: false,
    })

    expect(result.candidates.map((c) => c.username)).toEqual(['other'])
  })
})
