import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { blankDealer, repairShipsFrom } from '~~/db/dealer'
import type { Dealer } from '#shared/types'
import {
  countryIn,
  forgetHomeCountry,
  guessHomeCountry,
  isEu,
  isEurope,
  passesOrigin,
  readOrigin,
  sameCountry,
} from '#shared/countries'

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

/**
 * Where this device is (M30 #5).
 *
 * The default used to be the string `'Germany'`, written once by somebody
 * sitting in Germany — so every other user got a chip about the wrong country
 * and a postage estimate for the wrong border, until they found a setting that
 * was already filled in and therefore looked settled.
 */
describe('the home country, guessed', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    // The answer is memoised per process, so each case starts from nothing.
    forgetHomeCountry()
  })

  beforeEach(() => forgetHomeCountry())

  const withLanguages = (languages: string[]) =>
    vi.stubGlobal('navigator', { languages, language: languages[0] ?? '' })

  it('reads the region out of the browser’s own preference', () => {
    withLanguages(['de-CH', 'de'])
    expect(guessHomeCountry()).toBe('Switzerland')
  })

  it('skips a tag that carries no region rather than guessing one', () => {
    // "de" says what somebody reads, not where they are.
    withLanguages(['de', 'en-GB'])
    expect(guessHomeCountry()).toBe('United Kingdom')
  })

  it('falls back rather than leaving the filter matching nothing', () => {
    withLanguages([])
    expect(guessHomeCountry()).toBe('Germany')
  })

  it('survives a language tag the runtime will not parse', () => {
    withLanguages(['not a tag', 'en-US'])
    expect(guessHomeCountry()).toBe('United States')
  })
})

/**
 * Europe is not the EU, and the difference is the point (M30 #5).
 *
 * "From the EU" is about a customs border. For somebody in Zurich, London or
 * Oslo that border runs the wrong way round — what they are asking is "near
 * me", and the EU is the group they pay duty to.
 */
describe('Europe beside the EU', () => {
  it('takes the ones the customs union leaves out', () => {
    for (const country of ['Switzerland', 'United Kingdom', 'Norway', 'Iceland', 'Serbia']) {
      expect(isEu(country), country).toBe(false)
      expect(isEurope(country), country).toBe(true)
    }
  })

  it('still takes the members', () => {
    expect(isEurope('Germany')).toBe(true)
    expect(isEurope('Portugal')).toBe(true)
  })

  it('leaves the rest of the world out', () => {
    for (const country of ['Japan', 'United States', 'Brazil']) {
      expect(isEurope(country), country).toBe(false)
    }
  })

  it('passes the filter through', () => {
    expect(passesOrigin('Switzerland', 'europe', 'Germany')).toBe(true)
    expect(passesOrigin('Switzerland', 'eu', 'Germany')).toBe(false)
    expect(passesOrigin('Japan', 'europe', 'Germany')).toBe(false)
    // Unknown is out under every filter but "any", as before.
    expect(passesOrigin(null, 'europe', 'Germany')).toBe(false)
  })

  it('reads the new filter out of an address', () => {
    expect(readOrigin('europe')).toBe('europe')
    expect(readOrigin('nonsense')).toBe('any')
  })
})

/**
 * Two fields say where a shop is, and only one of them is a country (M31).
 *
 * A **listing** carries `ships_from`, an English country name and nothing else
 * (docs/02). A **user profile** carries `location`, a free-text box —
 * `fatplastics` has "Schillergäßchen 5, 07745 Jena, Thuringia, Germany -
 * phone: ++49-3641-35.38.00" in it. The shops screen compared that whole
 * string against "Germany" and filtered every shop away.
 */
describe('the country inside a line of free text', () => {
  it('finds it at the end of a postal address', () => {
    expect(
      countryIn(
        'Schillergäßchen 5, 07745 Jena, Thuringia, Germany - phone: ++49-3641-35.38.00',
      ),
    ).toBe('Germany')
  })

  it('reads a multi-word name as one country', () => {
    expect(countryIn('London, United Kingdom')).toBe('United Kingdom')
    expect(countryIn('Brooklyn, NY, United States')).toBe('United States')
  })

  it('will not find a country inside a longer word', () => {
    // "India" inside "Indiana", "Chad" inside a street name.
    expect(countryIn('Indianapolis, Indiana')).not.toBe('India')
    expect(countryIn('Chadwick Street, Leeds')).not.toBe('Chad')
  })

  /*
   * Null rather than a guess: a location nobody can place is not a country,
   * and the filter then leaves the shop out under everything but "anywhere" —
   * exactly as it does for a shop that said nothing at all.
   */
  it('answers nothing where there is no country to find', () => {
    expect(countryIn('somewhere nice')).toBeNull()
    expect(countryIn('')).toBeNull()
    expect(countryIn(null)).toBeNull()
  })

  it('does not care about the case Discogs wrote it in', () => {
    expect(countryIn('jena, GERMANY')).toBe('Germany')
  })

  it('feeds the filter the way the shops screen needs it', () => {
    const location = 'Schillergäßchen 5, 07745 Jena, Thuringia, Germany'
    const country = countryIn(location)!

    expect(passesOrigin(country, 'home', 'Germany')).toBe(true)
    expect(passesOrigin(country, 'eu', 'Germany')).toBe(true)
    expect(passesOrigin(country, 'europe', 'Germany')).toBe(true)
    // And the raw line, which is what was being compared before, never did.
    expect(passesOrigin(location, 'home', 'Germany')).toBe(false)
  })
})

/**
 * And the rows that already hold the wrong field (v14).
 *
 * Code alone does not fix a device that has them, and waiting for every shop
 * to be dug again would leave the screen broken for as long as that takes.
 */
describe('repairing a dealer row', () => {
  const row = (shipsFrom: string, location?: string) =>
    ({ ...blankDealer('shop'), shipsFrom, location }) as Dealer

  it('pulls the country out and keeps the line it came from', () => {
    const fixed = repairShipsFrom(
      row('Schillergäßchen 5, 07745 Jena, Thuringia, Germany - phone: ++49-3641-35.38.00'),
    )

    expect(fixed.shipsFrom).toBe('Germany')
    expect(fixed.location).toContain('Schillergäßchen')
  })

  it('leaves a row that already holds a country untouched', () => {
    const already = row('United Kingdom')
    expect(repairShipsFrom(already)).toBe(already)
  })

  it('leaves an empty row untouched rather than inventing a country', () => {
    const blank = row('')
    expect(repairShipsFrom(blank)).toBe(blank)
  })

  /*
   * A line nobody can place keeps its place and only stops being mistaken for
   * a country. The filter then leaves the shop out under everything but
   * "anywhere", exactly as it does for a shop that said nothing.
   */
  it('empties the country where the line names none, and keeps the line', () => {
    const fixed = repairShipsFrom(row('somewhere nice'))

    expect(fixed.shipsFrom).toBe('')
    expect(fixed.location).toBe('somewhere nice')
  })

  it('does not overwrite a location that is already there', () => {
    const fixed = repairShipsFrom(row('Jena, Germany', 'what the shop wrote'))
    expect(fixed.location).toBe('what the shop wrote')
  })
})
