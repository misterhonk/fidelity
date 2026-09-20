import { afterEach, describe, expect, it } from 'vitest'

import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import type { Dig, Match } from '#shared/types'
import { tempoOf } from '~~/worker/dealers/tempo'

/**
 * The tempo (M34.6): of the finds from one full dig, how many the next full
 * dig no longer saw, and the days between. Full digs only; a new-arrivals
 * dig stops at what it already knew and never sees what left.
 */
afterEach(async () => {
  await deleteFidelityDb()
})

const DAY = 86_400_000

const dig = (id: string, startedAt: number, over: Partial<Dig> = {}): Dig => ({
  id,
  dealer: 'plattenkiste',
  status: 'done',
  startedAt,
  finishedAt: startedAt + 1000,
  expiresAt: startedAt + 6 * 3_600_000,
  listingsTotal: 100,
  listingsScanned: 100,
  coverage: 1,
  ...over,
})

const match = (digId: string, listingId: number): Match => ({
  digId,
  listingId,
  releaseId: listingId + 1000,
  score: 50,
  signals: [],
  title: 'T',
  artist: 'A',
  label: null,
  catno: null,
  format: 'LP',
  year: null,
  condition: null,
  sleeve: null,
  price: null,
  currency: null,
  comments: null,
  thumbUrl: null,
  marketLowestPrice: null,
  marketNumForSale: null,
  expired: true,
})

describe('the tempo of a shop', () => {
  it('counts the finds of the earlier full dig the later one no longer saw', async () => {
    const db = await openFidelityDb()
    await db.put('digs', dig('01A', 10 * DAY, { status: 'expired' }))
    await db.put('digs', dig('01B', 19 * DAY))
    for (const id of [1, 2, 3, 4]) await db.put('matches', match('01A', id))
    for (const id of [3, 4, 5]) await db.put('matches', match('01B', id))

    expect(await tempoOf('plattenkiste')).toEqual({ of: 4, gone: 2, from: 10 * DAY, days: 9 })
  })

  it('needs two full digs, and skips the new-arrivals kind', async () => {
    const db = await openFidelityDb()
    await db.put('digs', dig('01A', 10 * DAY))
    await db.put('matches', match('01A', 1))
    expect(await tempoOf('plattenkiste')).toBeNull()

    await db.put('digs', dig('01B', 12 * DAY, { depth: 'neu' }))
    await db.put('matches', match('01B', 9))
    expect(await tempoOf('plattenkiste')).toBeNull()

    await db.put('digs', dig('01C', 13 * DAY, { dealer: 'other' }))
    expect(await tempoOf('plattenkiste')).toBeNull()
  })
})
