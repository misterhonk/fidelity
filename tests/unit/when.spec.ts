import { describe, expect, it } from 'vitest'

import { since } from '~/utils/when'

/**
 * The scale that replaced three of them. What matters is the boundaries: those
 * are where the three old versions disagreed with each other.
 */
const NOW = Date.UTC(2026, 7, 10, 12, 0, 0)
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('since', () => {
  it.each([
    [0, 'gerade eben'],
    [59 * 1000, 'gerade eben'],
    [MINUTE, 'vor 1 Minute'],
    [2 * MINUTE, 'vor 2 Minuten'],
    [HOUR, 'vor 1 Stunde'],
    [23 * HOUR, 'vor 23 Stunden'],
    [DAY, 'gestern'],
    [2 * DAY, 'vor 2 Tagen'],
    [30 * DAY, 'vor 30 Tagen'],
    [31 * DAY, 'vor 1 Monat'],
    [60 * DAY, 'vor 2 Monaten'],
    [720 * DAY, 'vor 2 Jahren'],
  ])('%i ms ago reads as "%s"', (elapsed, expected) => {
    expect(since(NOW - elapsed, NOW)).toBe(expected)
  })

  it('does not count forwards when the clock disagrees', () => {
    // A device whose clock runs a minute fast writes a timestamp in the
    // future. "in 40 Sekunden" for something already done is worse than blunt.
    expect(since(NOW + 40_000, NOW)).toBe('gerade eben')
  })
})
