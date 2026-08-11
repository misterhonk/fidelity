import { beforeAll, describe, expect, it } from 'vitest'

import { useLanguage } from '~/composables/useMessages'
import { since } from '~/utils/when'

/**
 * The scale that replaced three of them. What matters is the boundaries: those
 * are where the three old versions disagreed with each other.
 */
const NOW = Date.UTC(2026, 7, 10, 12, 0, 0)
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('since, in English', () => {
  it.each([
    [0, 'just now'],
    [59 * 1000, 'just now'],
    [MINUTE, '1 minute ago'],
    [2 * MINUTE, '2 minutes ago'],
    [HOUR, '1 hour ago'],
    [23 * HOUR, '23 hours ago'],
    [DAY, 'yesterday'],
    [2 * DAY, '2 days ago'],
    [30 * DAY, '30 days ago'],
    [31 * DAY, '1 month ago'],
    [60 * DAY, '2 months ago'],
    [720 * DAY, '2 years ago'],
  ])('%i ms ago reads as "%s"', (elapsed, expected) => {
    expect(since(NOW - elapsed, NOW)).toBe(expected)
  })

  it('does not count forwards when the clock disagrees', () => {
    // A device whose clock runs a minute fast writes a timestamp in the
    // future. "in 40 seconds" for something already done is worse than blunt.
    expect(since(NOW + 40_000, NOW)).toBe('just now')
  })
})

/**
 * The same scale in German, unchanged from before the language switch existed.
 *
 * Worth keeping as a second full list rather than a spot check: the counted
 * forms come from `Intl.RelativeTimeFormat` now, and this is the evidence that
 * handing that job to the browser did not quietly reword the German that was
 * already there. Every string below is what the hand-written table produced.
 */
describe('since, in German', () => {
  beforeAll(() => useLanguage().apply('de'))

  it.each([
    [0, 'gerade eben'],
    [MINUTE, 'vor 1 Minute'],
    [2 * MINUTE, 'vor 2 Minuten'],
    [HOUR, 'vor 1 Stunde'],
    [23 * HOUR, 'vor 23 Stunden'],
    [DAY, 'gestern'],
    // `numeric: 'auto'` renders this as "vorgestern" — the day before
    // yesterday, which is a claim about the calendar and wrong for anything
    // 2.9 days old. That is why the formatter is built with 'always'.
    [2 * DAY, 'vor 2 Tagen'],
    [30 * DAY, 'vor 30 Tagen'],
    // And this one as "letzten Monat", which is a calendar month rather than
    // an elapsed one.
    [31 * DAY, 'vor 1 Monat'],
    [60 * DAY, 'vor 2 Monaten'],
    [720 * DAY, 'vor 2 Jahren'],
  ])('%i ms ago reads as "%s"', (elapsed, expected) => {
    expect(since(NOW - elapsed, NOW)).toBe(expected)
  })
})
