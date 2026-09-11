import { afterEach, describe, expect, it, vi } from 'vitest'

import { getMeta, updatePreferences } from '~~/db/meta'
import { deleteFidelityDb } from '~~/db/open'
import type { DiscogsClient } from '~~/worker/discogs/client'
import {
  dayOf,
  parseMoney,
  recordValue,
  refreshCollectionValue,
  valueHistory,
} from '~~/worker/collection/value'

afterEach(async () => {
  await deleteFidelityDb()
})

/**
 * Discogs' estimate, kept day by day (docs/06 M19 #3).
 *
 * Two things can go wrong and neither shows on a green screen: a formatted
 * amount read as the wrong number, and two fetches on one day becoming two
 * points on the line. Both are pinned here.
 */

describe('reading a formatted amount', () => {
  it('reads the formats Discogs writes', () => {
    expect(parseMoney('€668.62')).toBe(66862)
    expect(parseMoney('$1,234.56')).toBe(123456)
    expect(parseMoney('£12.00')).toBe(1200)
    expect(parseMoney('1.941,57 €')).toBe(194157)
    expect(parseMoney('¥1,234')).toBe(123400)
    expect(parseMoney('CHF1,234.5')).toBe(123450)
  })

  it('says nothing rather than something wrong', () => {
    expect(parseMoney('')).toBeNull()
    expect(parseMoney('n/a')).toBeNull()
    expect(parseMoney('€')).toBeNull()
  })
})

describe('keeping the estimate', () => {
  it('one row a day, the later fetch winning', async () => {
    const noon = Date.UTC(2026, 8, 11, 12)
    await recordValue({ minimum: '€1.00', median: '€2.00', maximum: '€3.00', fetchedAt: noon })
    await recordValue({
      minimum: '€1.50',
      median: '€2.50',
      maximum: '€3.50',
      fetchedAt: noon + 60 * 60 * 1000,
    })

    const rows = await valueHistory()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ median: '€2.50', medianCents: 250, currency: 'EUR' })
  })

  it('a new day, a new row — oldest first', async () => {
    const noon = Date.UTC(2026, 8, 11, 12)
    const DAY = 24 * 60 * 60 * 1000
    await recordValue({ minimum: '€1', median: '€2', maximum: '€3', fetchedAt: noon + DAY })
    await recordValue({ minimum: '€1', median: '€2', maximum: '€3', fetchedAt: noon })

    expect((await valueHistory()).map((row) => row.day)).toEqual([
      dayOf(noon),
      dayOf(noon + DAY),
    ])
  })

  it('carries the currency the account is set to, not a guess from the string', async () => {
    await updatePreferences({ currency: 'GBP' })
    await recordValue({ minimum: '£1.00', median: '£2.00', maximum: '£3.00', fetchedAt: 0 })
    expect((await valueHistory())[0]?.currency).toBe('GBP')
  })

  it('is written by the same fetch that fills the number on the map', async () => {
    const get = vi.fn(async (_path: string, schema: { parse: (v: unknown) => unknown }) =>
      schema.parse({ minimum: '€10.00', median: '€20.00', maximum: '€30.00' }),
    )
    const now = Date.UTC(2026, 8, 11, 12)

    await refreshCollectionValue({ get } as unknown as DiscogsClient, 'ich', now)

    expect((await getMeta('collectionValue'))?.median).toBe('€20.00')
    expect(await valueHistory()).toMatchObject([{ day: dayOf(now), medianCents: 2000 }])
  })
})
