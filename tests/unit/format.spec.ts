import { describe, expect, it } from 'vitest'

import { matchesFormat } from '~~/worker/match/format'

/**
 * The strings here are real, taken from the RushHour inventory during the
 * first live dig. That dig returned zero matches partly because a Vinyl
 * filter was testing for the word "Vinyl", which an inventory listing never
 * contains — the collection says "Vinyl", the marketplace says 12".
 */
describe('format matching against real inventory strings', () => {
  it.each([
    '12", RE, RM',
    '2xLP, Album',
    '12"',
    '12", EP, Ltd',
    'LP, Album, RE',
    '7", Single',
    '10", EP',
    '2x12", Album',
    '3xLP, Compilation',
  ])('%s passes a Vinyl filter', (format) => {
    expect(matchesFormat(format, ['Vinyl'])).toBe(true)
  })

  it.each(['CD, Album', 'CDr, Compilation', 'Cassette, Album', 'File, FLAC, Album'])(
    '%s does not',
    (format) => {
      expect(matchesFormat(format, ['Vinyl'])).toBe(false)
    },
  )

  it('does not let "Album" alone carry a CD past a Vinyl filter', () => {
    expect(matchesFormat('CD, Album', ['Vinyl'])).toBe(false)
  })

  it('keeps a hybrid: a 2xLP sold with a bonus CD is still a record', () => {
    expect(matchesFormat('2xLP, Album + CD', ['Vinyl'])).toBe(true)
  })

  it('filters nothing when the user set no preference', () => {
    expect(matchesFormat('CD, Album', [])).toBe(true)
  })

  it('keeps a listing whose format Discogs did not state', () => {
    expect(matchesFormat(null, ['Vinyl'])).toBe(true)
  })

  it('accepts several media at once', () => {
    expect(matchesFormat('CD, Album', ['Vinyl', 'CD'])).toBe(true)
  })

  it('falls back to a substring test for a medium we have not modelled', () => {
    expect(matchesFormat('Lathe Cut, 7"', ['Lathe Cut'])).toBe(true)
  })
})
