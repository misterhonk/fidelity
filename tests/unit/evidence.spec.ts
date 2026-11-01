import { describe, expect, it } from 'vitest'

import en from '~/i18n/en'
import { evidenceOf } from '~/utils/evidence'

/**
 * The sheet's evidence line, by the kind of number it holds.
 *
 * Every number used to go through `decimal(value, 2)`, so the shelf read
 * "on the shelf: 14.00" — a count with cents, and a price without its currency.
 */
describe('evidence in the release sheet', () => {
  const label = en.evidence

  it('writes counts as whole numbers', () => {
    expect(evidenceOf({ artist: 'Can', owned: 14, total: 1200 }, label)).toBe(
      'Artist: Can · on the shelf: 14 · discography: 1,200',
    )
    expect(evidenceOf({ numForSale: 3 }, label)).toBe('for sale: 3')
  })

  it('writes years and catalogue numbers as they are, without a separator', () => {
    expect(evidenceOf({ wantedYear: 1972, pressingYear: 1989 }, label)).toBe(
      'wanted: 1972 · this pressing: 1989',
    )
    expect(evidenceOf({ prefix: 'BST', number: 4003, owned: 5, inRun: 9 }, label)).toBe(
      'Series: BST · Number: 4003 · on the shelf: 5 · in the series: 9',
    )
  })

  it('writes prices as money in their own currency', () => {
    expect(
      evidenceOf({ price: 14, marketLowest: 22.5, currency: 'GBP', ratio: 0.62 }, label),
    ).toBe('Price: £14.00 · market low: £22.50 · Ratio: 0.62')
  })

  it('keeps factors at two decimals', () => {
    expect(evidenceOf({ label: 'ECM', owned: 8, lift: 3.456 }, label)).toBe(
      'Label: ECM · on the shelf: 8 · Lift: 3.46',
    )
  })

  it('leaves out internal handles', () => {
    expect(evidenceOf({ releaseId: 10147986, masterId: 3, role: 'Producer' }, label)).toBe('')
  })
})
