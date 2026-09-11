import { describe, expect, it } from 'vitest'

import { isEu, passesOrigin, readOrigin, sameCountry } from '#shared/countries'

/**
 * "Only from Germany / the EU" (docs/06 M20 #2).
 *
 * The list is the customs union, not the continent — Switzerland, Norway and
 * the UK are exactly the cases the question is asked about.
 */
describe('where a shop ships from', () => {
  it('reads Discogs’ English names, whatever the case', () => {
    expect(isEu('Germany')).toBe(true)
    expect(isEu(' netherlands ')).toBe(true)
    expect(isEu('Czech Republic')).toBe(true)
    expect(isEu('United Kingdom')).toBe(false)
    expect(isEu('Switzerland')).toBe(false)
    expect(isEu('Norway')).toBe(false)
    expect(isEu('')).toBe(false)
    expect(isEu(null)).toBe(false)
  })

  it('matches the home country by name, never an empty one', () => {
    expect(sameCountry('Germany', 'germany')).toBe(true)
    expect(sameCountry('', '')).toBe(false)
    expect(sameCountry(undefined, 'Germany')).toBe(false)
  })

  it('lets an unknown origin through only when nothing is asked', () => {
    expect(passesOrigin('', 'any', 'Germany')).toBe(true)
    expect(passesOrigin('', 'home', 'Germany')).toBe(false)
    expect(passesOrigin('', 'eu', 'Germany')).toBe(false)
    expect(passesOrigin('Germany', 'home', 'Germany')).toBe(true)
    expect(passesOrigin('France', 'home', 'Germany')).toBe(false)
    expect(passesOrigin('France', 'eu', 'Germany')).toBe(true)
  })

  it('falls back to "any" for anything the address does not spell', () => {
    expect(readOrigin('eu')).toBe('eu')
    expect(readOrigin('home')).toBe('home')
    expect(readOrigin('mars')).toBe('any')
    expect(readOrigin(undefined)).toBe('any')
  })
})
