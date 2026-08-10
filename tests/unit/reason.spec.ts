import { describe, expect, it } from 'vitest'

import { SIGNAL_TYPES, type Signal, type SignalType } from '#shared/types'
import { buildReason } from '~~/worker/match/reason'

/**
 * The sentence.
 *
 * "Eine Empfehlung ohne Begründung ist Rauschen." It is not decoration on top
 * of the score — docs/00 calls it the product — and it was the least tested
 * thing in the matcher, at under half its lines.
 */

/** Realistic evidence for each signal, the shape the matcher actually emits. */
const EVIDENCE: Record<SignalType, Record<string, unknown>> = {
  WANTLIST_EXACT: { masterId: 12 },
  WANTLIST_PRESSING: { album: 'Dummy', masterId: 12, wantedYear: 1994, pressingYear: 2017 },
  ARTIST_KNOWN: { artist: 'Robag Wruhme', owned: 5 },
  ARTIST_GAP: { artist: 'Robag Wruhme', owned: 5, total: 12 },
  LABEL_AFFINITY: { label: 'Freude Am Tanzen', owned: 3, lift: 4 },
  CATALOG_RUN: { label: 'Kompakt', prefix: 'KOM', owned: 6, inRun: 9 },
  STYLE_ADJACENT: { styles: ['Minimal', 'Tech House', 'Deep House'] },
  CREDIT_GRAPH: { person: 'Rudy Van Gelder', owned: 4 },
  FORMAT_UPGRADE: { album: 'Kid A', ownedAs: 'CD' },
  PRICE_SIGNAL: { price: 24, marketLowest: 41, currency: 'EUR' },
  SCARCITY: { numForSale: 3 },
}

const signal = (type: SignalType, over: Record<string, unknown> = {}): Signal => ({
  type,
  confidence: 1,
  evidence: { ...EVIDENCE[type], ...over },
})

describe('every signal can speak for itself', () => {
  /*
   * The test that matters most here. A signal added to SIGNAL_TYPES without a
   * phrase does not fail anything — it silently produces "Passt zu deiner
   * Sammlung", which is the noise this module exists to prevent, on every
   * match that signal ever leads.
   */
  it.each(SIGNAL_TYPES)('%s leads with something specific', (type) => {
    const sentence = buildReason([signal(type)])

    expect(sentence).not.toBe('')
    expect(sentence).not.toBe('Passt zu deiner Sammlung.')
  })

  it.each(SIGNAL_TYPES)('%s can play second fiddle', (type) => {
    // WANTLIST_EXACT outweighs everything, so it always takes the lead and the
    // signal under test is pushed into the "Außerdem" clause.
    const sentence = buildReason([signal('WANTLIST_EXACT'), signal(type)])

    if (type === 'WANTLIST_EXACT') return
    expect(sentence).toContain('Außerdem:')
  })

  it.each(SIGNAL_TYPES)('%s never writes undefined or NaN', (type) => {
    // Evidence arrives from the matcher, the horizon and the enrichment pass,
    // and any of the three can be missing a field. A sentence that says
    // "undefined" is worse than no sentence.
    for (const evidence of [{}, { artist: null, label: null, album: null }]) {
      const sentence = buildReason([{ type, confidence: 1, evidence }])
      expect(sentence).not.toMatch(/undefined|NaN|null/)
    }
  })
})

describe('the words themselves', () => {
  it('names both numbers on a price, never the ratio', () => {
    // "0,58×" is arithmetic. "24 € bei einem Markt-Tiefstpreis von 41 €" is an
    // argument (docs/04 §S10).
    // Intl puts a narrow no-break space before the symbol; normalise it, or
    // the assertion tests the space rather than the sentence.
    const sentence = buildReason([signal('PRICE_SIGNAL')]).replace(/\s/g, ' ')
    expect(sentence).toContain('24,00 €')
    expect(sentence).toContain('41,00 €')
    expect(sentence).not.toMatch(/×|mal so/)
  })

  it('quotes the dealer’s own currency', () => {
    // A shop in London quotes pounds, and "24 €" would be a different claim
    // than the one the market made.
    const sentence = buildReason([signal('PRICE_SIGNAL', { currency: 'GBP' })])
    expect(sentence).toMatch(/£|GBP/)
    expect(sentence).not.toContain('€')
  })

  it('survives a currency code nobody has heard of', () => {
    const sentence = buildReason([signal('PRICE_SIGNAL', { currency: 'XYZ' })])
    expect(sentence).toContain('XYZ')
  })

  it('counts in German, not in arithmetic', () => {
    expect(buildReason([signal('SCARCITY', { numForSale: 1 })])).toBe(
      'Weltweit genau ein Exemplar im Angebot.',
    )
    expect(buildReason([signal('ARTIST_KNOWN', { owned: 1 })])).toContain(
      'steht schon in deiner Sammlung',
    )
    expect(buildReason([signal('CREDIT_GRAPH', { owned: 1 })])).toBe(
      'Rudy Van Gelder hat hier mitgewirkt.',
    )
  })

  it('calls out a reissue when the gap is wide enough', () => {
    // Twenty-three years apart: the collector wants to know before buying.
    expect(buildReason([signal('WANTLIST_PRESSING')])).toContain('nicht das Original von 1994')

    // Two years apart is the same record for anybody's purposes.
    expect(
      buildReason([signal('WANTLIST_PRESSING', { wantedYear: 1994, pressingYear: 1996 })]),
    ).toContain('dasselbe Album')
  })

  it('keeps three styles at most, because the fourth adds nothing', () => {
    const sentence = buildReason([
      signal('STYLE_ADJACENT', { styles: ['A', 'B', 'C', 'D', 'E'] }),
    ])
    expect(sentence).toBe('A, B, C – dein Kernrevier.')
  })
})

describe('which signal gets to lead', () => {
  it('is the strongest one, not the first one', () => {
    const sentence = buildReason([signal('SCARCITY'), signal('WANTLIST_EXACT')])
    expect(sentence.startsWith('Steht genau so auf deiner Wantlist.')).toBe(true)
  })

  it('weighs confidence, not only the signal', () => {
    // A fuzzy artist match at 0.3 should not outrank a certain label match,
    // which is the whole reason the ordering multiplies the two.
    const sentence = buildReason([
      { ...signal('ARTIST_KNOWN'), confidence: 0.1 },
      { ...signal('LABEL_AFFINITY'), confidence: 1 },
    ])
    expect(sentence.startsWith('Freude Am Tanzen')).toBe(true)
  })

  it('says nothing at all when there is nothing to say', () => {
    // A match with no signals is not a match, and an empty string is how the
    // caller finds that out rather than a sentence with no content.
    expect(buildReason([])).toBe('')
  })

  it('drops a supporting signal that cannot name its evidence', () => {
    const sentence = buildReason([
      signal('WANTLIST_EXACT'),
      { type: 'ARTIST_KNOWN', confidence: 1, evidence: {} },
    ])
    // No dangling "Außerdem:" with nothing after it.
    expect(sentence).toBe('Steht genau so auf deiner Wantlist.')
  })
})
