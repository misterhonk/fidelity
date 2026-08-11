import { globSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { useLanguage } from '~/composables/useMessages'
import { money } from '~/utils/money'
import { UNDERSTOOD_SHAPES as SHOWN } from '~/utils/shipping-shapes'
import { UNDERSTOOD_SHAPES as PARSED } from '~~/worker/basket/parse-shipping'

/**
 * One amount, in one place.
 *
 * There were ten: six `money()` functions in six files and four more built
 * inline. Nine agreed. The tenth defaulted the currency to euros, which is not
 * a formatting difference — it is a pound price under a euro sign, on the one
 * number this whole app exists to produce.
 */
describe('a price', () => {
  it('is written the way this app writes prices', () => {
    expect(money(14, 'EUR')).toBe('€14.00')
    expect(money(6.5, 'GBP')).toBe('£6.50')
  })

  /**
   * The decimal mark is not decoration.
   *
   * `14,00` and `14.00` are the same amount to two different readers and a
   * factor of a hundred to each other's. This is the test that would have
   * caught a formatter built once at import time and frozen in whichever
   * language happened to be active — which is what every one of the ten was.
   */
  it('follows the interface language', async () => {
    const { apply } = useLanguage()

    await apply('de')
    // The gap is U+00A0, not a space. `Intl` puts a non-breaking one there so
    // the amount never wraps away from its symbol, and a test written with an
    // ordinary space fails while looking identical in the diff.
    expect(money(14, 'EUR')).toBe('14,00\u00a0€')
    expect(money(6.5, 'GBP')).toBe('6,50\u00a0£')

    await apply('en')
    expect(money(14, 'EUR')).toBe('€14.00')
  })

  it('says nothing rather than guessing a currency', () => {
    // The failure that made this file: a number with no unit, printed with a
    // euro sign because euros are what the author had in mind.
    expect(money(11.5, null)).toBeNull()
    expect(money(11.5, undefined)).toBeNull()
  })

  it('says nothing rather than inventing a zero', () => {
    // Six hours after a dig the price is gone by design (rule 4). "€0.00"
    // would be a number where there is none.
    expect(money(null, 'EUR')).toBeNull()
    expect(money(undefined, 'EUR')).toBeNull()
  })

  it('keeps a real zero', () => {
    expect(money(0, 'EUR')).toBe('€0.00')
  })
})

/**
 * And nobody builds themselves another one.
 *
 * The helper only helps where it is used. What went wrong was never that
 * somebody could not write `Intl.NumberFormat` — it was that ten places each
 * wrote it alone, and one of them wrote it differently.
 *
 * Widened from money to every `Intl` formatter, because the language switch
 * gave the rule a second edge. A formatter built at the top of a component is
 * built once, in whichever language was active when the file first loaded, and
 * then never again: switch to German and that one screen keeps printing English
 * dates until it is reloaded. Both helper modules build theirs per call for
 * exactly that reason.
 */
describe('no screen formats a number or a date on its own', () => {
  const HELPERS = ['app/utils/money.ts', 'app/utils/when.ts']
  const FILES = [...globSync('app/**/*.vue'), ...globSync('app/**/*.ts')].filter(
    (file) => !HELPERS.includes(file),
  )

  it('finds no second implementation', () => {
    const offenders = FILES.filter((file) =>
      /new Intl\.(NumberFormat|DateTimeFormat|RelativeTimeFormat)|toLocale(String|DateString|TimeString)\(/.test(
        readFileSync(file, 'utf8'),
      ),
    )
    expect(offenders).toEqual([])
  })
})

/**
 * Die Liste, die endlich jemand sieht.
 *
 * `UNDERSTOOD_SHAPES` lived in the parser with the comment "for the interface
 * to show when it fails". No interface showed it, and a fourth entry was added
 * without anybody noticing nobody would read it. Now the basket shows it — from
 * its own copy, because reaching into a worker module for four strings would
 * cost a chunk for a caption. Two copies need a reason to stay identical.
 */
describe('the shapes the postage parser understands', () => {
  it('are the same list the basket offers', () => {
    expect(SHOWN).toEqual(PARSED)
  })
})
