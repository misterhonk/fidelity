import { beforeEach, describe, expect, it } from 'vitest'

import { useLanguage, type Language } from '~/composables/useMessages'
import { SIGNAL_TYPES, type Signal, type SignalType } from '#shared/types'
import { packs, plateFor, reasonFor } from '~/i18n/reason'

/**
 * The sentence.
 *
 * "A recommendation without a reason is noise." It is not decoration on top of
 * the score — docs/00 calls it the product — and it was the least tested thing
 * in the matcher, at under half its lines.
 *
 * Everything structural below runs in **both** languages. That is not
 * thoroughness for its own sake: the phrase tables are two hand-written
 * objects, and the failure this guards against — a signal that has a phrase in
 * one language and falls through to "fits your collection" in the other —
 * looks like nothing at all in the language you happen to be testing in.
 */

const LANGUAGES = Object.keys(packs) as Language[]

/** Realistic evidence for each signal, the shape the matcher actually emits. */
const EVIDENCE: Record<SignalType, Record<string, unknown>> = {
  WANTLIST_EXACT: { masterId: 12 },
  WANTLIST_PRESSING: { album: 'Dummy', masterId: 12, wantedYear: 1994, pressingYear: 2017 },
  ARTIST_KNOWN: { artist: 'Robag Wruhme', owned: 5 },
  // No `owned` at all, and that is the shape: a followed artist has nought of
  // them, which is why the sentence must never count records (M29).
  ARTIST_FOLLOWED: { artist: 'Exit North' },
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

describe.each(LANGUAGES)('every signal can speak for itself, in %s', (language) => {
  beforeEach(() => useLanguage().apply(language))

  /*
   * The test that matters most here. A signal added to SIGNAL_TYPES without a
   * phrase does not fail anything — it silently falls through to the fallback,
   * which is the noise this module exists to prevent, on every match that
   * signal ever leads.
   */
  it.each(SIGNAL_TYPES)('%s leads with something specific', (type) => {
    const sentence = reasonFor([signal(type)])

    expect(sentence).not.toBe('')
    expect(sentence).not.toBe(packs[language].fallback)
  })

  it.each(SIGNAL_TYPES)('%s can play second fiddle', (type) => {
    // WANTLIST_EXACT outweighs everything, so it always takes the lead and the
    // signal under test is pushed into the trailing clause.
    const sentence = reasonFor([signal('WANTLIST_EXACT'), signal(type)])

    if (type === 'WANTLIST_EXACT') return
    expect(sentence).toContain(packs[language].also('').trim().replace(/\.$/, ''))
  })

  it.each(SIGNAL_TYPES)('%s never writes undefined or NaN', (type) => {
    // Evidence arrives from the matcher, the horizon and the enrichment pass,
    // and any of the three can be missing a field. A sentence that says
    // "undefined" is worse than no sentence.
    for (const evidence of [{}, { artist: null, label: null, album: null }]) {
      const sentence = reasonFor([{ type, confidence: 1, evidence }])
      expect(sentence).not.toMatch(/undefined|NaN|null/)
    }
  })
})

describe('the words themselves, in English', () => {
  beforeEach(() => useLanguage().apply('en'))

  it('says when a want is one of the ones you want most, from four stars up', () => {
    expect(reasonFor([signal('WANTLIST_EXACT', { want: 4 })])).toBe(
      "That's on your wantlist, and one you want most.",
    )
    expect(reasonFor([signal('WANTLIST_EXACT', { want: 3 })])).toBe("That's on your wantlist.")
    expect(reasonFor([signal('WANTLIST_PRESSING', { want: 5 })])).toContain(
      'One you want most.',
    )
  })

  it('says under which name an artist was found', () => {
    // Or the sentence claims the listing said Dinky when it said Miss Dinky.
    const via = { artist: 'Dinky', owned: 4, via: 'Miss Dinky', relation: 'alias' }
    expect(reasonFor([signal('ARTIST_KNOWN', via)])).toBe(
      'Miss Dinky is Dinky. You have 4 records by Dinky, not this one.',
    )
    expect(reasonFor([signal('WANTLIST_EXACT'), signal('ARTIST_KNOWN', via)])).toContain(
      'Dinky is on your shelf, as Miss Dinky',
    )
  })

  it('names both numbers on a price, never the ratio', () => {
    // "0.58×" is arithmetic. "€24 against a market low of €41" is an argument
    // (docs/04 §S10).
    // Intl puts a narrow no-break space around symbols; normalise it, or the
    // assertion tests the space rather than the sentence.
    const sentence = reasonFor([signal('PRICE_SIGNAL')]).replace(/\s/g, ' ')
    expect(sentence).toContain('€24.00')
    expect(sentence).toContain('€41.00')
    expect(sentence).not.toMatch(/×|times as/)
  })

  it('quotes the dealer’s own currency', () => {
    // A shop in London quotes pounds, and "€24" would be a different claim
    // than the one the market made.
    const sentence = reasonFor([signal('PRICE_SIGNAL', { currency: 'GBP' })])
    expect(sentence).toMatch(/£|GBP/)
    expect(sentence).not.toContain('€')
  })

  it('survives a currency code nobody has heard of', () => {
    const sentence = reasonFor([signal('PRICE_SIGNAL', { currency: 'XYZ' })])
    expect(sentence).toContain('XYZ')
  })

  it('counts in words, not in arithmetic', () => {
    expect(reasonFor([signal('SCARCITY', { numForSale: 1 })])).toBe(
      'Exactly one copy for sale worldwide.',
    )
    expect(reasonFor([signal('ARTIST_KNOWN', { owned: 1 })])).toContain('is on your shelf')
    expect(reasonFor([signal('CREDIT_GRAPH', { owned: 1 })])).toBe(
      'Rudy Van Gelder worked on this.',
    )
  })

  it('calls out a reissue when the gap is wide enough', () => {
    // Twenty-three years apart: the collector wants to know before buying.
    expect(reasonFor([signal('WANTLIST_PRESSING')])).toContain('not the 1994 original')

    // Two years apart is the same record for anybody's purposes.
    expect(
      reasonFor([signal('WANTLIST_PRESSING', { wantedYear: 1994, pressingYear: 1996 })]),
    ).toContain('the same album')
  })

  it('keeps three styles at most, because the fourth adds nothing', () => {
    const sentence = reasonFor([
      signal('STYLE_ADJACENT', { styles: ['A', 'B', 'C', 'D', 'E'] }),
    ])
    expect(sentence).toBe('A, B, C: your home ground.')
  })
})

/**
 * The same distinctions in German, unchanged from before the translation.
 *
 * Worth a second block rather than a spot check: every one of these is a place
 * where the sentence makes a decision — singular against plural, a reissue
 * against a repress, three styles rather than five — and those are exactly what
 * a translation flattens if nobody looks.
 */
describe('the words themselves, in German', () => {
  beforeEach(() => useLanguage().apply('de'))

  it('says when a want is at the top of the list', () => {
    expect(reasonFor([signal('WANTLIST_EXACT', { want: 5 })])).toBe(
      'Steht auf deiner Wantlist, und zwar ganz oben.',
    )
    expect(reasonFor([signal('WANTLIST_PRESSING', { want: 4 })])).toContain(
      'Ganz oben auf deiner Liste.',
    )
  })

  it('says under which name an artist was found', () => {
    expect(
      reasonFor([
        signal('ARTIST_KNOWN', {
          artist: 'Can',
          owned: 5,
          via: 'Holger Czukay',
          relation: 'member',
        }),
      ]),
    ).toBe('Holger Czukay gehört zu Can. Du hast 5 Platten von Can, diese nicht.')
    expect(
      reasonFor([
        signal('ARTIST_KNOWN', {
          artist: 'Dinky',
          owned: 1,
          via: 'Miss Dinky',
          relation: 'alias',
        }),
      ]),
    ).toBe('Miss Dinky ist Dinky. Dinky steht bei dir im Regal, diese nicht.')
  })

  it('names both numbers on a price, never the ratio', () => {
    const sentence = reasonFor([signal('PRICE_SIGNAL')]).replace(/\s/g, ' ')
    expect(sentence).toContain('24,00 €')
    expect(sentence).toContain('41,00 €')
    expect(sentence).not.toMatch(/×|mal so/)
  })

  it('counts in words, not in arithmetic', () => {
    expect(reasonFor([signal('SCARCITY', { numForSale: 1 })])).toBe(
      'Weltweit genau eine im Angebot.',
    )
    expect(reasonFor([signal('ARTIST_KNOWN', { owned: 1 })])).toContain(
      'steht bei dir im Regal',
    )
    expect(reasonFor([signal('CREDIT_GRAPH', { owned: 1 })])).toBe(
      'Rudy Van Gelder hat hier mitgearbeitet.',
    )
  })

  it('calls out a reissue when the gap is wide enough', () => {
    expect(reasonFor([signal('WANTLIST_PRESSING')])).toContain('nicht das Original von 1994')
    expect(
      reasonFor([signal('WANTLIST_PRESSING', { wantedYear: 1994, pressingYear: 1996 })]),
    ).toContain('dasselbe Album')
  })

  it('keeps three styles at most', () => {
    expect(reasonFor([signal('STYLE_ADJACENT', { styles: ['A', 'B', 'C', 'D', 'E'] })])).toBe(
      'A, B, C: dein Revier.',
    )
  })
})

/**
 * The ordering is the engine's, not the wording's — it lives in
 * `worker/match/reason.ts` and reads the same `WEIGHTS` the score does. So it
 * is checked in both languages: a lead that differed between them would mean
 * the sentence and the number beside it were making different claims.
 */
describe.each(LANGUAGES)('which signal gets to lead, in %s', (language) => {
  beforeEach(() => useLanguage().apply(language))

  it('is the strongest one, not the first one', () => {
    const sentence = reasonFor([signal('SCARCITY'), signal('WANTLIST_EXACT')])
    const wantlist = packs[language].lead.WANTLIST_EXACT!({})!
    expect(sentence.startsWith(wantlist)).toBe(true)
  })

  it('weighs confidence, not only the signal', () => {
    // A fuzzy artist match at 0.1 should not outrank a certain label match,
    // which is the whole reason the ordering multiplies the two.
    const sentence = reasonFor([
      { ...signal('ARTIST_KNOWN'), confidence: 0.1 },
      { ...signal('LABEL_AFFINITY'), confidence: 1 },
    ])
    expect(sentence).toContain('Freude Am Tanzen')
    expect(sentence).not.toMatch(/^Robag Wruhme|^You have|^Du hast/)
  })

  it('says nothing at all when there is nothing to say', () => {
    // A match with no signals is not a match, and an empty string is how the
    // caller finds that out rather than a sentence with no content.
    expect(reasonFor([])).toBe('')
  })

  it('drops a supporting signal that cannot name its evidence', () => {
    const sentence = reasonFor([
      signal('WANTLIST_EXACT'),
      { type: 'ARTIST_KNOWN', confidence: 1, evidence: {} },
    ])
    // No dangling connector with nothing after it.
    expect(sentence).toBe(packs[language].lead.WANTLIST_EXACT!({}))
  })
})

/**
 * The reason as a plate, for the list that has heard it twenty times (M33 #1).
 *
 * Both languages again, and for the same reason as everything else in this
 * file: the plate table is two hand-written objects, and a signal that names
 * its evidence in one and returns null in the other looks like nothing at all
 * from inside the language you happen to be reading.
 */
describe.each(LANGUAGES)('the reason as a plate, in %s', (language) => {
  beforeEach(() => useLanguage().apply(language))

  /*
   * A plate stands where a sentence was taken away, so every signal has to
   * have one — a card with a blank there has stopped answering the question
   * it exists to answer. And it has to hold with no evidence at all, because
   * evidence arrives from three passes and any of them can be short a field.
   */
  it.each(SIGNAL_TYPES)('%s has a plate, with evidence and without', (type) => {
    expect(plateFor(signal(type))).toBeTruthy()

    const bare = plateFor({ type, confidence: 1, evidence: {} })
    expect(bare).toBeTruthy()
    expect(bare).not.toMatch(/undefined|NaN|null/)
  })

  /*
   * The artist is the card's own first line and the label is in the facts
   * under it. Naming them again is how the first attempt at this read on
   * 2026-09-21: "ARTIST · PROBE 3 · 5" over a card headed "Probe 3", saying
   * the name twice and the point not at all.
   */
  it('says what is the matter, and counts rather than repeating the name', () => {
    const shelf = language === 'de' ? 'Im Regal · 5' : 'On the shelf · 5'
    const label = language === 'de' ? 'Dein Label · 3' : 'Your label · 3'

    expect(plateFor(signal('ARTIST_KNOWN'))).toBe(shelf)
    expect(plateFor(signal('LABEL_AFFINITY'))).toBe(label)
  })

  it('names what the card does not carry anywhere else', () => {
    // A producer, a style: nowhere on the card, so the plate says who and what.
    expect(plateFor(signal('CREDIT_GRAPH'))).toContain('Rudy Van Gelder')
    expect(plateFor(signal('STYLE_ADJACENT'))).toContain('Minimal')
    expect(plateFor(signal('FORMAT_UPGRADE'))).toContain('CD')
  })

  it('leaves off a count of one, which counts nothing', () => {
    const shelf = language === 'de' ? 'Im Regal' : 'On the shelf'
    expect(plateFor(signal('ARTIST_KNOWN', { owned: 1 }))).toBe(shelf)
  })

  it('says a gap and a run as the fraction they are', () => {
    const of = language === 'de' ? 'von' : 'of'
    expect(plateFor(signal('ARTIST_GAP'))).toContain(`5 ${of} 12`)
    expect(plateFor(signal('CATALOG_RUN'))).toContain(`6 ${of} 9`)
  })

  it('tells a plain want from one you want most', () => {
    expect(plateFor(signal('WANTLIST_EXACT'))).not.toBe(
      plateFor(signal('WANTLIST_EXACT', { want: 5 })),
    )
  })

  /*
   * A plate that wraps has turned back into a sentence, which is the thing it
   * was introduced to stop. Generous, because a producer's name is a name and
   * this cannot be a rule about people's names — it catches a phrase growing
   * into prose, not a long one.
   */
  it('stays short enough to be a plate', () => {
    for (const type of SIGNAL_TYPES) {
      expect(plateFor(signal(type)).length).toBeLessThan(40)
    }
  })
})

/**
 * And what the card still has to say once the plate has said the lead.
 */
describe.each(LANGUAGES)('the sentence with its lead taken away, in %s', (language) => {
  beforeEach(() => useLanguage().apply(language))

  it('lets the next strongest signal lead instead', () => {
    const sentence = reasonFor([signal('ARTIST_KNOWN'), signal('CREDIT_GRAPH')], 'ARTIST_KNOWN')

    expect(sentence).toContain('Rudy Van Gelder')
    expect(sentence).not.toContain('Robag Wruhme')
  })

  it('says nothing where the plate said everything', () => {
    // No paragraph at all on the card, rather than a fallback that repeats
    // in prose what the plate just said in three words.
    expect(reasonFor([signal('ARTIST_KNOWN')], 'ARTIST_KNOWN')).toBe('')
    expect(reasonFor([signal('ARTIST_KNOWN')], 'ARTIST_KNOWN')).not.toBe(
      packs[language].fallback,
    )
  })

  it('is the sentence it always was when nothing is taken away', () => {
    const signals = [signal('WANTLIST_EXACT'), signal('ARTIST_KNOWN')]
    expect(reasonFor(signals, undefined)).toBe(reasonFor(signals))
  })
})
