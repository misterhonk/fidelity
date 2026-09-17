import { describe, expect, it } from 'vitest'

import { BRITISH_TIERS } from '../fixtures/shipping-notes'
import { parseShippingText } from '~~/worker/basket/parse-shipping'

/**
 * The seller text behind listing 4156697547, read on 2026-09-17 (M34.3).
 *
 * It is the shape the first parser missed on five of six shops: ordinals
 * ("1st LP"), two unit words ("LP discs"), a dash between the count and the
 * price, "upto" without a space, and free postage above an order value per
 * destination. Discogs names the postage for one record with a token; this
 * text is what says the rest.
 */
describe('a British shop with three destination blocks', () => {
  it('reads the EU block for a German buyer: 1st LP plus a step per record', () => {
    const parsed = parseShippingText(BRITISH_TIERS, 'Germany')
    expect(parsed.section).toBe('THE EUROPEAN UNION')
    expect(parsed.tiers[0]).toMatchObject({
      minItems: 1,
      maxItems: 1,
      price: 12,
      currency: 'GBP',
    })
    expect(parsed.tiers.find((tier) => tier.minItems === 2)?.price).toBe(13.5)
    expect(parsed.tiers.find((tier) => tier.minItems === 7)?.price).toBe(21)
    expect(parsed.byWeight).toBe(false)
  })

  it('reads the UK block for a British buyer: ranges, an open end, two unit words', () => {
    const parsed = parseShippingText(BRITISH_TIERS, 'United Kingdom')
    expect(parsed.section).toBe('UK (INCLUDING NORTHERN IRELAND)')
    expect(parsed.tiers).toEqual([
      { minItems: 1, maxItems: 3, price: 4, currency: 'GBP', source: 'parsed' },
      { minItems: 4, maxItems: 7, price: 5.5, currency: 'GBP', source: 'parsed' },
      { minItems: 8, maxItems: null, price: 8, currency: 'GBP', source: 'parsed' },
    ])
  })

  it('reads the rest-of-world block for an American buyer', () => {
    const parsed = parseShippingText(BRITISH_TIERS, 'United States')
    expect(parsed.tiers[0]).toMatchObject({ minItems: 1, price: 15, currency: 'GBP' })
    expect(parsed.tiers.find((tier) => tier.minItems === 3)?.price).toBe(21)
  })

  it('never reads the bulk quotes by the kilo as a table', () => {
    const parsed = parseShippingText(BRITISH_TIERS, 'United States')
    expect(parsed.tiers.every((tier) => tier.price < 50)).toBe(true)
  })

  it('reads the free-over threshold for the block it read, and no other', () => {
    expect(parseShippingText(BRITISH_TIERS, 'Germany').freeOver).toEqual({
      amount: 300,
      currency: 'GBP',
    })
    expect(parseShippingText(BRITISH_TIERS, 'United Kingdom').freeOver).toEqual({
      amount: 75,
      currency: 'GBP',
    })
    expect(parseShippingText(BRITISH_TIERS, 'United States').freeOver).toBeNull()
  })

  it('reads a threshold written in the German shapes too', () => {
    expect(
      parseShippingText('1 LP 6 €, 2-3 LP 9 €\nVersandkostenfrei ab 100 €', 'Germany').freeOver,
    ).toEqual({
      amount: 100,
      currency: 'EUR',
    })
    expect(parseShippingText('1 LP 6 €, ab 4 LP 12 €', 'Germany').freeOver).toBeNull()
  })
})
