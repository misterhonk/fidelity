import { afterEach, describe, expect, it } from 'vitest'

import { FATPLASTICS, PROSE_WALL } from '../fixtures/shipping-notes'
import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import type { Dealer, ShippingTier } from '#shared/types'
import { ADDITIONAL_UP_TO, parseShippingText } from '~~/worker/basket/parse-shipping'
import { resolveShipping, saveUserShipping } from '~~/worker/basket/profiles'
import {
  shippingAdvice,
  shippingCurve,
  shippingFor,
  sortTiers,
} from '~~/worker/basket/shipping'

const tier = (minItems: number, maxItems: number | null, price: number): ShippingTier => ({
  minItems,
  maxItems,
  price,
  currency: 'EUR',
  source: 'user',
})

// 1 LP 6 €, 2–3 LP 9 €, 4–6 LP 12 €.
const table = [tier(1, 1, 6), tier(2, 3, 9), tier(4, 6, 12)]

describe('what N records cost to ship', () => {
  it('finds the tier a count falls into', () => {
    expect(shippingFor(table, 1)?.price).toBe(6)
    expect(shippingFor(table, 3)?.price).toBe(9)
    expect(shippingFor(table, 5)?.price).toBe(12)
  })

  it('refuses to extrapolate past the end of the table', () => {
    // A table that stops at six says nothing about seven, and inventing the
    // seventh is a number somebody plans a purchase around.
    expect(shippingFor(table, 7)).toBeNull()
  })

  it('handles an open-ended top tier', () => {
    expect(shippingFor([...table, tier(7, null, 15)], 40)?.price).toBe(15)
  })

  it('says nothing about an empty basket or an empty table', () => {
    expect(shippingFor(table, 0)).toBeNull()
    expect(shippingFor([], 3)).toBeNull()
  })

  it('does not care what order the tiers were given in', () => {
    const shuffled = [tier(4, 6, 12), tier(1, 1, 6), tier(2, 3, 9)]
    expect(shippingFor(shuffled, 2)?.price).toBe(9)
    expect(sortTiers(shuffled).map((t) => t.minItems)).toEqual([1, 2, 4])
  })
})

describe('the marginal cost curve', () => {
  it('reports per-record cost, which is what decides anything', () => {
    const curve = shippingCurve(table, 4)
    expect(curve.map((p) => p.perItem)).toEqual([6, 4.5, 3, 3])
  })

  it('reports what the next record adds', () => {
    const curve = shippingCurve(table, 4)
    // 6 → 9 → 9 → 12: the second record costs 3, the third nothing.
    expect(curve.map((p) => p.marginal)).toEqual([3, 0, 3, 0])
  })

  it('goes null rather than flat past the end of the table', () => {
    expect(shippingCurve(table, 8).map((p) => p.total)).toEqual([
      6,
      9,
      9,
      12,
      12,
      12,
      null,
      null,
    ])
  })
})

describe('"eine Platte mehr spart X pro Stück"', () => {
  it('finds the saving at the bottom of a tier', () => {
    // Two records at 4,50 each; three at 3,00 each.
    const advice = shippingAdvice(table, 2)
    expect(advice).toMatchObject({ addItems: 1, perItemNow: 4.5, perItemThen: 3 })
    expect(advice?.savedPerItem).toBe(1.5)
  })

  it('looks past the very next record when that one saves nothing', () => {
    // At three records the fourth costs 3 € more and saves nothing per item;
    // the fifth rides along inside the same tier. Only checking n+1 would
    // report no saving where there plainly is one.
    const advice = shippingAdvice(table, 3)
    expect(advice?.addItems).toBe(2)
    expect(advice?.perItemThen).toBe(2.4)
  })

  it('reports the nearest saving, not the deepest one reachable', () => {
    // Six records would be 2,00 per item, but "noch vier Platten" is a
    // shopping trip, not a decision. The curve is there for the full picture.
    expect(shippingAdvice(table, 2)?.addItems).toBe(1)
  })

  it('says nothing when nothing ahead is cheaper', () => {
    // At six records the table ends. There is no advice to give.
    expect(shippingAdvice(table, 6)).toBeNull()
  })

  it('says nothing without a table', () => {
    expect(shippingAdvice([], 2)).toBeNull()
    expect(shippingAdvice(table, 0)).toBeNull()
  })
})

describe('reading a shipping table out of free text', () => {
  it('reads the common German table', () => {
    const { tiers } = parseShippingText('1 LP: 6,00 €, 2-3 LP: 9,00 €, 4-6 LP: 12,00 €')
    expect(tiers).toEqual([
      { minItems: 1, maxItems: 1, price: 6, currency: 'EUR', source: 'parsed' },
      { minItems: 2, maxItems: 3, price: 9, currency: 'EUR', source: 'parsed' },
      { minItems: 4, maxItems: 6, price: 12, currency: 'EUR', source: 'parsed' },
    ])
  })

  it('understands an open top tier', () => {
    const { tiers } = parseShippingText('1 LP: 6 EUR, ab 4 LP: 12 EUR')
    expect(tiers.at(-1)).toMatchObject({ minItems: 4, maxItems: null, price: 12 })
  })

  it('understands the German shorthand for round amounts', () => {
    const { tiers } = parseShippingText('Porto: 1-2 LPs 7,- EUR / 3-5 LPs 10,- EUR')
    expect(tiers.map((t) => t.price)).toEqual([7, 10])
  })

  it('tells German and English decimals apart', () => {
    expect(parseShippingText('1 LP: 1.234,50 €').tiers[0]?.price).toBe(1234.5)
    expect(parseShippingText('1 LP: $1,234.50').tiers[0]?.price).toBe(1234.5)
  })

  it('reads the currency from either side of the number', () => {
    expect(parseShippingText('1 record £5').tiers[0]?.currency).toBe('GBP')
    expect(parseShippingText('1 record 5 GBP').tiers[0]?.currency).toBe('GBP')
  })

  it('expands "each additional" into real tiers', () => {
    const { tiers } = parseShippingText('1 record 5 EUR, each additional 1 EUR')
    expect(tiers[0]).toMatchObject({ minItems: 1, price: 5 })
    expect(tiers[1]).toMatchObject({ minItems: 2, price: 6 })
    expect(tiers[2]).toMatchObject({ minItems: 3, price: 7 })
    expect(tiers.at(-1)).toMatchObject({ minItems: ADDITIONAL_UP_TO })
  })

  it('marks everything it produces as parsed, never as fact', () => {
    const { tiers } = parseShippingText('1 LP: 6 €, 2-3 LP: 9 €')
    expect(tiers.every((t) => t.source === 'parsed')).toBe(true)
  })

  it('refuses a number with no currency', () => {
    // "1 LP: 6" could be six of anything, and assuming euros because the shop
    // is German is exactly the guess that produces an untraceable number.
    expect(parseShippingText('1 LP: 6').tiers).toEqual([])
  })

  it('refuses prose it does not understand', () => {
    expect(parseShippingText('Versand nach Absprache, schreib mich an!').tiers).toEqual([])
    expect(parseShippingText('Combined shipping available.').tiers).toEqual([])
    expect(parseShippingText('').tiers).toEqual([])
    expect(parseShippingText(null).tiers).toEqual([])
  })

  it('drops a range that runs backwards', () => {
    expect(parseShippingText('6-2 LP: 9 €').tiers).toEqual([])
  })

  it('keeps the first of two rules covering the same count', () => {
    // Picking the cheaper would bias every ambiguous table optimistic.
    const { tiers } = parseShippingText('1 LP: 6 €, 1 LP: 4 €')
    expect(tiers).toHaveLength(1)
    expect(tiers[0]?.price).toBe(6)
  })

  it('reports what it thought it recognised', () => {
    const { matched } = parseShippingText('1 LP: 6,00 €, 2-3 LP: 9,00 €')
    expect(matched).toHaveLength(2)
    expect(matched[0]).toContain('1 LP')
  })

  it('reads a ceiling with no floor', () => {
    expect(parseShippingText('Up to 15 records: 6 EUR').tiers[0]).toMatchObject({
      minItems: 1,
      maxItems: 15,
      price: 6,
    })
    expect(parseShippingText('bis 5 LPs 8 €').tiers[0]).toMatchObject({
      minItems: 1,
      maxItems: 5,
      price: 8,
    })
  })

  it('does not read a delivery time as a count', () => {
    // "up to 14 days" is the shape a ceiling rule has, and it is not one.
    expect(parseShippingText('Delivery up to 14 days, 1 LP: 6 €').tiers).toEqual([
      { minItems: 1, maxItems: 1, price: 6, currency: 'EUR', source: 'parsed' },
    ])
  })
})

/**
 * Ein Händlertext, der nach Zielländern sortiert ist.
 *
 * The failure that produced this block: a basket of two records at fatplastics
 * was quoted 13,00 € where the real Discogs checkout charged 6,00 €. The text
 * carries three rate tables under `Germany:`, `Europe:` and `Non-Europe:`, the
 * parser flattened all three into one, and the European two-to-eight rule won
 * for a buyer in Germany.
 *
 * Postage is the number the whole basket screen exists to produce. Reading it
 * off the wrong continent is worse than not reading it at all.
 */
describe('a shipping text sorted by destination', () => {
  it('reads the domestic rate for a domestic buyer', () => {
    const { tiers, section } = parseShippingText(FATPLASTICS, 'Germany')

    expect(section).toBe('Germany')
    expect(tiers).toEqual([
      { minItems: 1, maxItems: 15, price: 6, currency: 'EUR', source: 'parsed' },
    ])
  })

  it('never quotes the European rate to a German buyer', () => {
    // The exact regression: 13 EUR is the `2-8 Records` rule under `Europe:`.
    const { tiers } = parseShippingText(FATPLASTICS, 'Germany')
    expect(tiers.map((t) => t.price)).not.toContain(13)
    expect(shippingFor(tiers, 2)?.price).toBe(6)
  })

  it('reads the European block for a European buyer', () => {
    const { tiers, section } = parseShippingText(FATPLASTICS, 'Austria')

    expect(section).toBe('Europe')
    expect(shippingFor(tiers, 2)?.price).toBe(13)
  })

  it('reads the overseas block for an overseas buyer', () => {
    const { tiers, section } = parseShippingText(FATPLASTICS, 'Japan')

    expect(section).toBe('Non-Europe')
    expect(shippingFor(tiers, 2)?.price).toBe(23)
  })

  it('understands the German name of the destination', () => {
    expect(parseShippingText(FATPLASTICS, 'Deutschland').tiers[0]?.price).toBe(6)
  })

  it('refuses when no block covers the destination', () => {
    // A dealer who names Germany and Austria has said nothing about Japan.
    const text = 'Germany:\n1 LP: 6 €\n\nAustria:\n1 LP: 9 €'
    expect(parseShippingText(text, 'Japan')).toEqual({ tiers: [], matched: [], section: null })
  })

  it('refuses a sorted text when it is not told where the parcel goes', () => {
    // Reading every block would mix rates from three continents.
    expect(parseShippingText(FATPLASTICS).tiers).toEqual([])
  })

  it('falls back to a catch-all block', () => {
    const text = 'Germany:\n1 LP: 6 €\n\nRest of World:\n1 LP: 25 €'
    expect(parseShippingText(text, 'Brazil')).toMatchObject({
      section: 'Rest of World',
      tiers: [{ minItems: 1, maxItems: 1, price: 25, currency: 'EUR', source: 'parsed' }],
    })
  })

  it('reads an unsorted text as one table, as before', () => {
    // `Porto:` and `Shipping:` are headings in shape and not destinations.
    // Treating them as ones would cut a readable table into unreadable pieces.
    const { tiers, section } = parseShippingText('Porto:\n1 LP: 6 €\n2-3 LP: 9 €', 'Germany')

    expect(section).toBeNull()
    expect(tiers.map((t) => t.price)).toEqual([6, 9])
  })

  it('ignores an aside about the courier', () => {
    // `(DHL-Paket,1-2 days)` carries a comma, and a comma separates rules.
    const { tiers } = parseShippingText(
      'Up to 15 records (DHL-Paket,1-2 days): 6 EUR',
      'Germany',
    )
    expect(tiers).toHaveLength(1)
  })

  it('keeps a parenthesis that holds the price', () => {
    expect(parseShippingText('1 LP (6 EUR)', 'Germany').tiers[0]?.price).toBe(6)
  })

  it('finds nothing in a wall of terms and conditions', () => {
    const { tiers, section } = parseShippingText(PROSE_WALL, 'Germany')
    expect(tiers).toEqual([])
    // Bold headings are not destinations, so the text stays one block.
    expect(section).toBeNull()
  })
})

describe("where a dealer's table comes from", () => {
  afterEach(async () => {
    await deleteFidelityDb()
  })

  const dealer = (over: Partial<Dealer> = {}): Dealer => ({
    username: 'shop',
    displayName: 'Der Laden',
    shipsFrom: 'Germany',
    sellerRating: 99,
    ratingCount: 5,
    numForSale: 100,
    minOrderTotal: 0,
    shippingNote: '',
    lastScannedAt: 1,
    affinity: null,
    fingerprint: null,
    shippingTiers: [],
    ...over,
  })

  it('prefers what a person typed over what a regex guessed', async () => {
    const resolved = await resolveShipping(
      dealer({
        shippingTiers: [tier(1, 1, 5)],
        shippingNote: '1 LP: 99 EUR',
      }),
      'Germany',
    )
    expect(resolved.source).toBe('user')
    expect(resolved.tiers[0]?.price).toBe(5)
  })

  it('falls back to the dealer text, clearly labelled', async () => {
    const resolved = await resolveShipping(dealer({ shippingNote: '1 LP: 6 EUR' }), 'Germany')
    expect(resolved.source).toBe('parsed')
    expect(resolved.matched).toHaveLength(1)
  })

  it('admits it knows nothing rather than guessing', async () => {
    const resolved = await resolveShipping(
      dealer({ shippingNote: 'Versand nach Absprache' }),
      'Germany',
    )
    expect(resolved.source).toBeNull()
    expect(resolved.tiers).toEqual([])
  })

  it('saves a table for a dealer that was never scanned', async () => {
    // A basket outlives the dig it came from, and a dig from before the
    // fingerprint existed never wrote a dealer row at all. Refusing here would
    // be a save button that silently does nothing.
    const saved = await saveUserShipping('nie-gescannt', [
      { minItems: 1, maxItems: 1, price: 6, currency: 'EUR' },
    ])
    expect(saved.username).toBe('nie-gescannt')
    expect(saved.lastScannedAt).toBeNull()

    const db = await openFidelityDb()
    expect((await db.get('dealers', 'nie-gescannt'))?.shippingTiers[0]).toMatchObject({
      price: 6,
      source: 'user',
    })
  })

  it('replaces an earlier hand-entered table rather than merging into it', async () => {
    const db = await openFidelityDb()
    await db.put('dealers', dealer({ shippingTiers: [tier(1, 1, 6), tier(2, 3, 9)] }))

    await saveUserShipping('shop', [{ minItems: 1, maxItems: null, price: 4, currency: 'EUR' }])

    // A half-updated postage table is worse than either version of it.
    const stored = await db.get('dealers', 'shop')
    expect(stored?.shippingTiers).toHaveLength(1)
    expect(stored?.shippingTiers[0]?.price).toBe(4)
  })
})
