import { afterEach, describe, expect, it, vi } from 'vitest'

import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import type { Dig, StockRow } from '#shared/types'
import type { DiscogsClient } from '~~/worker/discogs/client'
import { findGifts, freshDigs, pickIdeas } from '~~/worker/gift'

/**
 * A present for a friend (#245): the cheapest fresh copy of each of their
 * wants, within the budget. The friend's own data never reaches this part —
 * it only sees stock rows already filtered to their wants.
 */

const NOW = 1_800_000_000_000

const dig = (id: string, dealer: string, startedAt: number, expiresAt = NOW + 1000): Dig =>
  ({ id, dealer, startedAt, expiresAt }) as Dig

const row = (digId: string, releaseId: number, price: number | null, currency = 'EUR') =>
  ({
    digId,
    listingId: releaseId * 10 + digId.length,
    releaseId,
    title: `T${releaseId}`,
    artist: `A${releaseId}`,
    condition: null,
    price,
    currency,
  }) as StockRow

describe('freshDigs', () => {
  it('keeps the newest dig per shop inside its six hours', () => {
    const fresh = freshDigs(
      [dig('old', 'a', 1), dig('new', 'a', 2), dig('gone', 'b', 3, NOW - 1)],
      NOW,
    )
    expect([...fresh.keys()]).toEqual(['new'])
  })
})

describe('pickIdeas', () => {
  const fresh = freshDigs([dig('d1', 'a', 1), dig('d2', 'b', 1)], NOW)
  const names = new Map([['a', 'Shop A']])

  it('takes the cheapest copy under the budget, cheapest first', () => {
    const { ideas, overBudget } = pickIdeas(
      [row('d1', 1, 18), row('d2', 1, 15), row('d1', 2, 9), row('d1', 3, 40)],
      fresh,
      names,
      20,
      'EUR',
    )
    expect(ideas.map((i) => [i.releaseId, i.price, i.displayName])).toEqual([
      [2, 9, 'Shop A'],
      [1, 15, 'b'],
    ])
    expect(overBudget).toBe(1)
  })

  it('leaves out stale digs, missing prices and other currencies', () => {
    const { ideas, overBudget } = pickIdeas(
      [row('expired', 1, 5), row('d1', 2, null), row('d1', 3, 5, 'USD')],
      fresh,
      names,
      20,
      'EUR',
    )
    expect(ideas).toEqual([])
    expect(overBudget).toBe(0)
  })

  it('does not count a want as over budget when a copy fits', () => {
    const { overBudget } = pickIdeas(
      [row('d1', 1, 50), row('d2', 1, 10)],
      fresh,
      names,
      20,
      'EUR',
    )
    expect(overBudget).toBe(0)
  })
})

describe('findGifts', () => {
  afterEach(async () => {
    await deleteFidelityDb()
  })

  it('counts as owned only the wants in stock it left out', async () => {
    const db = await openFidelityDb()
    await db.put('digs', dig('d1', 'a', 1))
    await db.put('stock', row('d1', 1, 10))
    await db.put('stock', row('d1', 2, 12))
    const page = (key: string, ids: number[]) => ({
      pagination: { page: 1, pages: 1, per_page: 100, items: ids.length, urls: {} },
      [key]: ids.map((id) => ({ id })),
    })
    // They want 1, 2 and 3 and own 2 and 3 — but only 2 is in a shop.
    const get = vi.fn(async (path: string) =>
      path.endsWith('/wants') ? page('wants', [1, 2, 3]) : page('releases', [2, 3]),
    )

    const result = await findGifts(
      { get } as unknown as DiscogsClient,
      'friend',
      20,
      NOW,
      new AbortController().signal,
    )

    expect(result.ideas.map((idea) => idea.releaseId)).toEqual([1])
    expect(result.owned).toBe(1)
  })
})
