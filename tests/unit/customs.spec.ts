import { describe, expect, it } from 'vitest'

import { importCharges, inEu } from '~~/worker/basket/customs'

/**
 * A parcel from outside the EU (2026-10-21).
 *
 * Since 1 July 2026: €3 customs per tariff sub-heading under €150, and import
 * VAT at the destination's rate. Discogs shows neither in what the API hands
 * out; a UK shop that looks two euros cheaper can be four dearer.
 */
const LP = 'Vinyl, LP, Album'
const CD = 'CD, Album'

const parcel = (over: Partial<Parameters<typeof importCharges>[0]> = {}) =>
  importCharges({
    from: 'United Kingdom',
    to: 'Germany',
    currency: 'EUR',
    subtotal: 40,
    shipping: 12,
    formats: [LP, LP],
    ...over,
  })

describe('customs and import VAT', () => {
  it('charges €3 for two LPs — one tariff line — and VAT on records and postage', () => {
    expect(parcel()).toEqual({
      duty: 3,
      dutyLines: 1,
      vat: 9.88,
      vatRate: 19,
      vatAtCheckout: true,
      overThreshold: false,
    })
  })

  it('counts an LP and a CD as two lines', () => {
    expect(parcel({ formats: [LP, CD] })?.duty).toBe(6)
  })

  it('says nothing about duty over €150, and the VAT is paid at import then', () => {
    const big = parcel({ subtotal: 150 })
    expect(big?.duty).toBeNull()
    expect(big?.overThreshold).toBe(true)
    expect(big?.vatAtCheckout).toBe(false)
  })

  it('uses the rate of the country the parcel goes to', () => {
    expect(parcel({ to: 'Hungary' })?.vatRate).toBe(27)
    expect(parcel({ to: 'Czechia' })?.vatRate).toBe(21)
  })

  it('leaves the VAT unknown when the postage is', () => {
    expect(parcel({ shipping: null })?.vat).toBeNull()
  })

  it('applies to nothing that does not cross into the EU', () => {
    expect(parcel({ from: 'Netherlands' })).toBeNull()
    expect(parcel({ to: 'United Kingdom' })).toBeNull()
    expect(parcel({ from: '' })).toBeNull()
  })

  it('does not convert: a basket in pounds gets no figure', () => {
    expect(parcel({ currency: 'GBP' })).toBeNull()
  })

  it('knows the 27 by the names Discogs and the browser use', () => {
    expect(inEu('Czech Republic')).toBe(true)
    expect(inEu('Switzerland')).toBe(false)
    expect(inEu('Norway')).toBe(false)
  })
})
