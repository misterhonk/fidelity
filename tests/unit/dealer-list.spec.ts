import { afterEach, describe, expect, it } from 'vitest'

import { blankDealer } from '~~/db/dealer'
import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import type { Dealer, DealerFingerprint } from '#shared/types'
import { bandOf, fitOf, rankedDealers } from '~~/worker/dealers/list'

/**
 * The verdict pair on a list row (M34.4): the profile's two sentences as two
 * plate words, measured the same way so a row and its profile never disagree.
 */
const print = (medianPrice: number): DealerFingerprint => ({
  sampledItems: 100,
  totalItems: 100,
  coverage: 1,
  labelDist: {},
  styleDist: {},
  decadeDist: {},
  medianPrice,
  priceCurrency: 'EUR',
})

const shop = (username: string, affinity: number | null, median: number): Dealer => ({
  ...blankDealer(username),
  affinity,
  lastScannedAt: affinity === null ? null : 1,
  fingerprint: median > 0 ? print(median) : null,
})

afterEach(async () => {
  await deleteFidelityDb()
})

describe('the thresholds', () => {
  it('are the profile’s', () => {
    expect(fitOf(null)).toBeNull()
    expect(fitOf(1.5)).toBe('above')
    expect(fitOf(0.8)).toBe('same')
    expect(fitOf(0.79)).toBe('below')
    expect(bandOf(null)).toBeNull()
    expect(bandOf(1.25)).toBe('high')
    expect(bandOf(0.8)).toBe('low')
    expect(bandOf(1)).toBe('middle')
  })
})

describe('the ranked list', () => {
  it('stands each shop against the median of the others', async () => {
    const db = await openFidelityDb()
    await db.put('dealers', shop('cheap', 3, 8))
    await db.put('dealers', shop('middle', 1, 12))
    await db.put('dealers', shop('dear', 0.5, 30))
    await db.put('dealers', shop('unknown', null, 0))

    const rows = await rankedDealers()
    const by = (name: string) => rows.find((row) => row.username === name)!

    // `cheap`: rate 3 against the median of {1, 0.5} = 0.75 → 4× → above;
    // price 8 against the median of {12, 30} = 21 → low.
    expect(by('cheap').fit).toBe('above')
    expect(by('cheap').priceBand).toBe('low')
    // `middle`: 1 against {3, 0.5} = 1.75 → 0.57 → below; 12 against {8, 30} = 19 → low.
    expect(by('middle').fit).toBe('below')
    expect(by('middle').priceBand).toBe('low')
    expect(by('dear').priceBand).toBe('high')
    // Never dug: nothing to stand against anything.
    expect(by('unknown').fit).toBeNull()
    expect(by('unknown').priceBand).toBeNull()

    // Dug shops first, best rate first, the name-only one last.
    expect(rows.map((row) => row.username)).toEqual(['cheap', 'middle', 'dear', 'unknown'])
  })

  it('has nothing to say with one shop', async () => {
    const db = await openFidelityDb()
    await db.put('dealers', shop('alone', 2, 10))
    const [row] = await rankedDealers()
    expect(row!.fit).toBeNull()
    expect(row!.priceBand).toBeNull()
  })
})
