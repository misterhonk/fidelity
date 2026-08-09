import { describe, expect, it } from 'vitest'

import type { Signal, SignalType } from '#shared/types'
import {
  barryScore,
  BAND_LABEL,
  MIN_STORED_SCORE,
  scoreBand,
  SCALE,
  SECONDARY,
} from '~~/worker/match/score'

const signal = (type: SignalType, confidence = 1): Signal => ({
  type,
  confidence,
  evidence: {},
})

/**
 * The calibration table from docs/04-MATCHING-ENGINE.md §4, verbatim.
 *
 * This is the most important test in the project. Every weight change has to
 * update it, and the diff has to be explained in the pull request — otherwise
 * score development is flying blind.
 */
describe('the Barry score, against the calibration table', () => {
  it.each([
    ['Wantlist exakt allein', [signal('WANTLIST_EXACT')], 87],
    ['Wantlist exakt + Preis-Signal', [signal('WANTLIST_EXACT'), signal('PRICE_SIGNAL')], 96],
    [
      'Credit 1.0 + Serie 0.95 + Label 0.9 + Preis 1.0',
      [
        signal('CREDIT_GRAPH'),
        signal('CATALOG_RUN', 0.95),
        signal('LABEL_AFFINITY', 0.9),
        signal('PRICE_SIGNAL'),
      ],
      91,
    ],
    [
      'Diskografie-Lücke 0.8 + Serie 0.9',
      [signal('ARTIST_GAP', 0.8), signal('CATALOG_RUN', 0.9)],
      63,
    ],
    [
      'Künstler bekannt + Label 0.8',
      [signal('ARTIST_KNOWN'), signal('LABEL_AFFINITY', 0.8)],
      57,
    ],
    ['Künstler bekannt allein', [signal('ARTIST_KNOWN')], 48],
    ['Stil-Adjazenz allein', [signal('STYLE_ADJACENT')], 26],
  ])('%s → %i', (_label, signals, expected) => {
    expect(barryScore(signals)).toBe(expected)
  })

  it('keeps the constants fixed — retuning them makes scores incomparable', () => {
    expect(SCALE).toBe(115)
    expect(SECONDARY).toBe(0.3)
  })
})

describe('how the score is shaped', () => {
  it('lets one perfect reason beat five mediocre ones', () => {
    const perfect = barryScore([signal('WANTLIST_EXACT')])
    const five = barryScore(Array.from({ length: 5 }, () => signal('STYLE_ADJACENT')))

    expect(perfect).toBeGreaterThan(five)
  })

  it('scores nothing when there is no reason', () => {
    expect(barryScore([])).toBe(0)
  })

  it('caps at 100 however many signals pile up', () => {
    const everything = (
      [
        'WANTLIST_EXACT',
        'WANTLIST_PRESSING',
        'ARTIST_GAP',
        'CREDIT_GRAPH',
        'CATALOG_RUN',
        'ARTIST_KNOWN',
        'LABEL_AFFINITY',
      ] satisfies SignalType[]
    ).map((type) => signal(type))

    expect(barryScore(everything)).toBe(100)
  })

  it('respects per-user weights', () => {
    const signals = [signal('ARTIST_KNOWN')]
    expect(barryScore(signals, { userWeights: { ARTIST_KNOWN: 0 } })).toBe(0)
    expect(barryScore(signals, { userWeights: { ARTIST_KNOWN: 2 } })).toBeGreaterThan(
      barryScore(signals),
    )
  })
})

describe('the soft dampeners', () => {
  const wantlist = [signal('WANTLIST_EXACT')]

  it('drops a match below the preferred condition to 40 %', () => {
    expect(barryScore(wantlist, { conditionBelowPreference: true })).toBe(35)
  })

  it('drops a match above the comfortable price to 55 %', () => {
    expect(barryScore(wantlist, { priceAboveTarget: true })).toBe(48)
  })

  it('zeroes anything already in the basket', () => {
    expect(barryScore(wantlist, { alreadyInBasket: true })).toBe(0)
  })

  it('multiplies dampeners rather than picking one', () => {
    const both = barryScore(wantlist, {
      conditionBelowPreference: true,
      priceAboveTarget: true,
    })
    expect(both).toBe(Math.round(87 * 0.4 * 0.55))
  })
})

describe('score bands', () => {
  it.each([
    [100, 'S'],
    [85, 'S'],
    [84, 'A'],
    [70, 'A'],
    [69, 'B'],
    [50, 'B'],
    [49, 'C'],
    [30, 'C'],
  ] as const)('%i is band %s', (score, band) => {
    expect(scoreBand(score)).toBe(band)
  })

  it('refuses to keep anything under 30', () => {
    expect(scoreBand(MIN_STORED_SCORE - 1)).toBeNull()
    expect(scoreBand(0)).toBeNull()
  })

  it('names the top band after the film', () => {
    expect(BAND_LABEL.S).toBe('Side One, Track One')
    expect(BAND_LABEL.A).toBe('Top Five')
  })
})

describe('what M2 can actually reach', () => {
  it('tops out around 100 with only the three free signals', () => {
    const best = barryScore([
      signal('WANTLIST_EXACT'),
      signal('ARTIST_KNOWN'),
      signal('LABEL_AFFINITY'),
    ])
    expect(best).toBeGreaterThanOrEqual(100 - 15)

    // And the common case is a B, not an S. That is honest: with three
    // signals we know less, and SCALE must not be bent to hide it.
    expect(barryScore([signal('ARTIST_KNOWN'), signal('LABEL_AFFINITY', 0.8)])).toBe(57)
  })
})
