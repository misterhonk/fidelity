import { afterEach, describe, expect, it } from 'vitest'

import { blankDealer } from '~~/db/dealer'
import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import { recentStands, STAND_WINDOW_MS } from '~~/worker/stands'

afterEach(async () => {
  await deleteFidelityDb()
})

/**
 * The stands at a record fair (docs/06 M19 #4).
 *
 * What makes a stand: a shop scanned in the last day with something found,
 * its newest dig — expired or not, because at a fair the morning's scan is
 * usually past its six hours by the time you reach the stand, and the finds
 * stay while the prices go.
 */

const NOW = 1_800_000_000_000
const HOUR = 60 * 60 * 1000

async function dig(id: string, dealer: string, startedAt: number, matchCount = 3) {
  const db = await openFidelityDb()
  await db.put('digs', {
    id,
    dealer,
    status: 'done',
    startedAt,
    finishedAt: startedAt + 1000,
    expiresAt: startedAt + 6 * HOUR,
    listingsTotal: 100,
    listingsScanned: 100,
    coverage: 1,
    truncated: false,
    matchCount,
    apiRequests: 1,
    cursor: null,
  } as never)
}

async function shop(username: string, over: Partial<ReturnType<typeof blankDealer>> = {}) {
  const db = await openFidelityDb()
  await db.put('dealers', {
    ...blankDealer(username),
    displayName: username.toUpperCase(),
    ...over,
  })
}

describe('the stands', () => {
  it('are the newest dig per shop from the last day, newest shop first', async () => {
    await shop('a')
    await shop('b')
    await dig('01A-OLD', 'a', NOW - 20 * HOUR)
    await dig('01A-NEW', 'a', NOW - 2 * HOUR)
    await dig('01B', 'b', NOW - 8 * HOUR)

    const stands = await recentStands(NOW)

    expect(stands.map((s) => [s.dealer, s.digId])).toEqual([
      ['a', '01A-NEW'],
      ['b', '01B'],
    ])
    expect(stands[0]).toMatchObject({ displayName: 'A', matches: 3, status: 'done' })
  })

  it('keep a dig that has passed its six hours — the finds stay, the prices go', async () => {
    await dig('01B', 'b', NOW - 8 * HOUR)
    expect((await recentStands(NOW)).map((s) => s.digId)).toEqual(['01B'])
  })

  it('leave out yesterday, an empty dig, and a hidden shop', async () => {
    await dig('01OLD', 'old', NOW - STAND_WINDOW_MS - 1)
    await dig('01EMPTY', 'empty', NOW - HOUR, 0)
    await shop('hidden', { hiddenAt: NOW })
    await dig('01HIDDEN', 'hidden', NOW - HOUR)
    await dig('01KEPT', 'kept', NOW - HOUR)

    expect((await recentStands(NOW)).map((s) => s.dealer)).toEqual(['kept'])
  })

  it('name a shop nobody has a row for by its username', async () => {
    await dig('01X', 'stranger', NOW - HOUR)
    expect((await recentStands(NOW))[0]?.displayName).toBe('stranger')
  })
})
