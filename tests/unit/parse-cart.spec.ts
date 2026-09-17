import { describe, expect, it } from 'vitest'

import {
  CART_FORTYFIVE,
  CART_GREEN_HELL,
  CART_THREE_SHOPS,
  CART_WITH_FREE_POSTAGE,
} from '../fixtures/cart-text'
import { parseCartText, readMoney } from '~~/worker/basket/parse-cart'

/**
 * The pasted cart page (M34.3), read against the pages Martin copied on
 * 2026-09-17. The table in `tests/fixtures/cart-text.ts` is the contract.
 */
describe('readMoney', () => {
  it('reads both decimal marks and the code over the symbol', () => {
    expect(readMoney('€7,00 EUR')).toEqual({ value: 7, currency: 'EUR' })
    expect(readMoney('€72.00 EUR')).toEqual({ value: 72, currency: 'EUR' })
    expect(readMoney('€391,99 EUR')).toEqual({ value: 391.99, currency: 'EUR' })
    expect(readMoney('€1.234,56 EUR')).toEqual({ value: 1234.56, currency: 'EUR' })
    expect(readMoney('£1,234.56')).toEqual({ value: 1234.56, currency: 'GBP' })
    expect(readMoney('12.00 GBP')).toEqual({ value: 12, currency: 'GBP' })
    expect(readMoney('Standard - €3,90')).toEqual({ value: 3.9, currency: 'EUR' })
  })

  it('leaves delivery times and rating counts alone', () => {
    expect(readMoney('Delivery in 3 - 5 business days')).toBeNull()
    expect(readMoney('99.9% positiv (7,681)')).toBeNull()
    expect(readMoney('')).toBeNull()
  })
})

describe('parseCartText', () => {
  it('reads three shops off one page, recommendations not counted', () => {
    const blocks = parseCartText(CART_THREE_SHOPS)
    expect(blocks.map((b) => b.dealer)).toEqual([
      'fatplastics',
      'MonsieurEdd',
      'spirax.records',
    ])

    const [fat, edd, spirax] = blocks
    expect(fat).toMatchObject({
      records: 8,
      subtotal: { value: 72, currency: 'EUR' },
      postage: { value: 6, currency: 'EUR' },
      total: { value: 78, currency: 'EUR' },
      method: 'Standard - Deutsche Post / DHL',
      moreAtNoExtra: 42,
      freeOver: null,
      minOrderShort: null,
    })
    expect(edd).toMatchObject({
      records: 4,
      postage: { value: 7, currency: 'EUR' },
      freeOver: { value: 250, currency: 'EUR' },
      moreAtNoExtra: null,
    })
    expect(spirax).toMatchObject({
      records: 1,
      subtotal: { value: 2.88, currency: 'EUR' },
      postage: { value: 6, currency: 'EUR' },
      moreAtNoExtra: 2,
      freeOver: { value: 150, currency: 'EUR' },
      minOrderShort: { value: 12.12, currency: 'EUR' },
    })
  })

  it('reads free postage off the method line when the sum has no shipping row', () => {
    const [munich, recordsale, hhv] = parseCartText(CART_WITH_FREE_POSTAGE)
    expect(munich).toMatchObject({
      dealer: 'MunichSchall',
      records: 3,
      subtotal: { value: 93.7, currency: 'EUR' },
      postage: { value: 0, currency: 'EUR' },
      total: null,
      method: 'Free Shipping',
    })
    expect(recordsale).toMatchObject({
      dealer: 'recordsale-de',
      records: 1,
      postage: { value: 3.9, currency: 'EUR' },
      total: { value: 395.89, currency: 'EUR' },
    })
    expect(hhv).toMatchObject({
      dealer: 'www.hhv.de',
      records: 3,
      postage: { value: 4.99, currency: 'EUR' },
      method: 'Standard',
    })
  })

  it('reads the summary rows whether they copy on one line or two', () => {
    const [green] = parseCartText(CART_GREEN_HELL)
    expect(green).toMatchObject({
      dealer: 'green_hell',
      records: 2,
      postage: { value: 8, currency: 'EUR' },
      total: { value: 112.8, currency: 'EUR' },
      method: 'Standard - DHL',
    })
    const [forty] = parseCartText(CART_FORTYFIVE)
    expect(forty).toMatchObject({
      dealer: 'wheniamfortyfive',
      records: 4,
      postage: { value: 2.5, currency: 'EUR' },
    })
  })

  it('reads the English interface by the same labels', () => {
    const text = [
      'Order from londonwax 100.0% positive (12)',
      'Artist - Title (12")',
      'Media: Mint (M) / Sleeve: Mint (M)',
      '£12.00 GBP',
      'Shipping',
      'Standard - Royal Mail - £4.50',
      'Payment',
      'Subtotal\t£12.00 GBP',
      'Shipping\t£4.50 GBP',
      'Total\t£16.50 GBP',
    ].join('\n')
    expect(parseCartText(text)).toMatchObject([
      { dealer: 'londonwax', records: 1, postage: { value: 4.5, currency: 'GBP' } },
    ])
  })

  it('finds no shop in links or prose', () => {
    expect(parseCartText('https://www.discogs.com/sell/item/1260275694')).toEqual([])
    expect(parseCartText('Booka Shade, 2006, 14,99 € — zwei Platten')).toEqual([])
    expect(parseCartText('')).toEqual([])
  })
})
