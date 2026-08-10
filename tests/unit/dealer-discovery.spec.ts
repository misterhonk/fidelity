import { afterEach, describe, expect, it, vi } from 'vitest'

import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import type { DiscogsClient } from '~~/worker/discogs/client'
import { discoverDealers, MIN_LISTINGS, rememberDealers } from '~~/worker/dealers/discover'

afterEach(async () => {
  await deleteFidelityDb()
})

/**
 * Finding the shops somebody already deals with.
 *
 * Two sources that are not equivalent: orders are documented by Discogs,
 * friends are not (ADR-009). The tests hold the line between them — above all
 * that the undocumented one is never consulted unless the device said so, and
 * that losing either of them costs the import an input rather than the run.
 */
function fakeClient(answers: Record<string, unknown>, { fail = [] as string[] } = {}) {
  const get = vi.fn(async (path: string, schema: { parse: (v: unknown) => unknown }) => {
    if (fail.some((f) => path.includes(f))) throw new Error('502')
    const key = Object.keys(answers).find((k) => path.includes(k))
    if (!key) throw new Error(`404 ${path}`)
    return schema.parse(answers[key])
  })
  return { client: { get } as unknown as DiscogsClient, get }
}

const profile = (username: string, numForSale: number) => ({
  username,
  num_for_sale: numForSale,
  seller_rating: 99,
  seller_num_ratings: 120,
  location: 'Germany',
})

describe('finding shops', () => {
  it('takes the sellers you have ordered from', async () => {
    const { client } = fakeClient({
      '/marketplace/orders': { orders: [{ seller: { username: 'plattenkiste' } }] },
      '/users/plattenkiste': profile('plattenkiste', 900),
    })

    const result = await discoverDealers({ client, username: 'ich', includeFriends: false })

    expect(result.candidates).toHaveLength(1)
    expect(result.candidates[0]).toMatchObject({ username: 'plattenkiste', source: 'order' })
    expect(result.friendsUsed).toBe(false)
  })

  it('does not touch the friends list unless the device asked', async () => {
    const { client, get } = fakeClient({
      '/marketplace/orders': { orders: [] },
      '/friends': { friends: [{ user: { username: 'kumpel' } }] },
    })

    await discoverDealers({ client, username: 'ich', includeFriends: false })

    /*
     * The whole condition ADR-009 rests on. `/users/{u}/friends` is not in the
     * Discogs documentation, which rule 5 forbids relying on — so it is off
     * until somebody switches it on, and off means never requested.
     */
    expect(get.mock.calls.some(([path]) => String(path).includes('/friends'))).toBe(false)
  })

  it('reads it when the device did ask', async () => {
    const { client } = fakeClient({
      '/marketplace/orders': { orders: [] },
      '/friends': { friends: [{ user: { username: 'kumpel' } }] },
      '/users/kumpel': profile('kumpel', 500),
    })

    const result = await discoverDealers({ client, username: 'ich', includeFriends: true })
    expect(result.candidates[0]).toMatchObject({ username: 'kumpel', source: 'friend' })
    expect(result.friendsUsed).toBe(true)
  })

  it('an order outranks a friendship for the same shop', async () => {
    // Having bought there is the stronger claim, and the label says so.
    const { client } = fakeClient({
      '/marketplace/orders': { orders: [{ seller: { username: 'beides' } }] },
      '/friends': { friends: [{ user: { username: 'beides' } }] },
      '/users/beides': profile('beides', 500),
    })

    const result = await discoverDealers({ client, username: 'ich', includeFriends: true })
    expect(result.candidates).toHaveLength(1)
    expect(result.candidates[0]?.source).toBe('order')
  })

  it('a friend with no stock is a person, not a shop', async () => {
    const { client } = fakeClient({
      '/marketplace/orders': { orders: [] },
      '/friends': {
        friends: [{ user: { username: 'sammler' } }, { user: { username: 'laden' } }],
      },
      '/users/sammler': profile('sammler', MIN_LISTINGS - 1),
      '/users/laden': profile('laden', MIN_LISTINGS),
    })

    const result = await discoverDealers({ client, username: 'ich', includeFriends: true })
    expect(result.candidates.map((c) => c.username)).toEqual(['laden'])
  })

  it('never offers you yourself', async () => {
    const { client } = fakeClient({
      '/marketplace/orders': { orders: [{ seller: { username: 'ich' } }] },
      '/friends': { friends: [{ user: { username: 'ich' } }] },
    })

    const result = await discoverDealers({ client, username: 'ich', includeFriends: true })
    expect(result.candidates).toEqual([])
  })

  it('survives either source failing', async () => {
    // A token without marketplace access answers 401 on orders. The day
    // Discogs removes the friends endpoint it answers something else. Neither
    // is the run failing — that is the point of ADR-009's third condition.
    const withoutOrders = fakeClient(
      {
        '/friends': { friends: [{ user: { username: 'laden' } }] },
        '/users/laden': profile('laden', 300),
      },
      { fail: ['/marketplace/orders'] },
    )
    const a = await discoverDealers({
      client: withoutOrders.client,
      username: 'ich',
      includeFriends: true,
    })
    expect(a.candidates).toHaveLength(1)

    const withoutFriends = fakeClient(
      {
        '/marketplace/orders': { orders: [{ seller: { username: 'laden' } }] },
        '/users/laden': profile('laden', 300),
      },
      { fail: ['/friends'] },
    )
    const b = await discoverDealers({
      client: withoutFriends.client,
      username: 'ich',
      includeFriends: true,
    })
    expect(b.candidates).toHaveLength(1)
  })

  it('marks what is already in your list', async () => {
    const db = await openFidelityDb()
    await db.put('dealers', {
      username: 'bekannt',
      displayName: 'bekannt',
      shipsFrom: '',
      sellerRating: 0,
      ratingCount: 0,
      numForSale: 0,
      minOrderTotal: 0,
      shippingNote: '',
      lastScannedAt: null,
      affinity: null,
      fingerprint: null,
      shippingTiers: [],
    })

    const { client } = fakeClient({
      '/marketplace/orders': { orders: [{ seller: { username: 'bekannt' } }] },
      '/users/bekannt': profile('bekannt', 400),
    })

    const result = await discoverDealers({ client, username: 'ich', includeFriends: false })
    expect(result.candidates[0]?.known).toBe(true)
  })

  it('puts the biggest shop first', async () => {
    const { client } = fakeClient({
      '/marketplace/orders': {
        orders: [{ seller: { username: 'klein' } }, { seller: { username: 'gross' } }],
      },
      '/users/klein': profile('klein', 50),
      '/users/gross': profile('gross', 5000),
    })

    const result = await discoverDealers({ client, username: 'ich', includeFriends: false })
    expect(result.candidates.map((c) => c.username)).toEqual(['gross', 'klein'])
  })
})

describe('keeping them', () => {
  const candidate = (username: string) => ({
    username,
    source: 'order' as const,
    numForSale: 400,
    sellerRating: 99,
    ratingCount: 120,
    location: 'Germany',
    known: false,
  })

  it('writes a row a scan can fill in later', async () => {
    const added = await rememberDealers([candidate('neu')])
    expect(added).toBe(1)

    const db = await openFidelityDb()
    const dealer = await db.get('dealers', 'neu')
    // Not scanned yet, and the screens say so honestly rather than guessing.
    expect(dealer?.lastScannedAt).toBeNull()
    expect(dealer?.numForSale).toBe(400)
  })

  it('does not overwrite what a scan already learned', async () => {
    const db = await openFidelityDb()
    await db.put('dealers', {
      username: 'alt',
      displayName: 'Der Laden',
      shipsFrom: 'Netherlands',
      sellerRating: 100,
      ratingCount: 900,
      numForSale: 35_900,
      minOrderTotal: 20,
      shippingNote: '1 LP 6 EUR',
      lastScannedAt: 5000,
      affinity: 0.5,
      fingerprint: null,
      shippingTiers: [],
      watching: true,
    } as never)

    const added = await rememberDealers([candidate('alt')])

    expect(added).toBe(0)
    const dealer = await db.get('dealers', 'alt')
    expect(dealer?.numForSale).toBe(35_900)
    expect(dealer?.lastScannedAt).toBe(5000)
    expect(dealer?.watching).toBe(true)
    expect(dealer?.minOrderTotal).toBe(20)
  })
})
