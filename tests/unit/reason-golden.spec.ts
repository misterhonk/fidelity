import { describe, expect, it } from 'vitest'

import { useLanguage, type Language } from '~/composables/useMessages'
import { SIGNAL_TYPES, type Signal, type SignalType } from '#shared/types'
import { packs, plateFor, reasonFor } from '~/i18n/reason'

/**
 * The sentences themselves, frozen per language (#251).
 *
 * `reason.spec.ts` checks the structure: every signal leads with something,
 * nothing says "undefined". What it cannot see is the wording, and the wording
 * is the product. Each language builds its own sentence now, with its own list
 * grammar and its own elision ("d’Aphex Twin"), so a change to one pack shows
 * up here as a diff in that language and nowhere else.
 *
 * A diff in this snapshot is a decision about prose, not a test to make pass:
 * explain it in the PR, like a change to the scoring snapshot.
 *
 * Which signals fire is the engine's business and is pinned by golden.spec.ts;
 * this file feeds hand-made signals in and only reads the words out.
 */

const LANGUAGES = Object.keys(packs) as Language[]

const EVIDENCE: Record<SignalType, Record<string, unknown>> = {
  WANTLIST_EXACT: { masterId: 12 },
  WANTLIST_PRESSING: { album: 'Dummy', masterId: 12, wantedYear: 1994, pressingYear: 2017 },
  ARTIST_KNOWN: { artist: 'Robag Wruhme', owned: 5 },
  ARTIST_FOLLOWED: { artist: 'Exit North' },
  ARTIST_GAP: { artist: 'Aphex Twin', owned: 5, total: 12 },
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

/** The shapes a sentence takes beyond one signal alone. */
const CASES: Record<string, Signal[]> = {
  'want most': [signal('WANTLIST_EXACT', { want: 5 })],
  'alias, one record': [
    signal('ARTIST_KNOWN', { artist: 'Dinky', owned: 1, via: 'Miss Dinky', relation: 'alias' }),
  ],
  'group member, several records': [
    signal('ARTIST_KNOWN', {
      artist: 'Orbital',
      owned: 4,
      via: 'Paul Hartnoll',
      relation: 'member',
    }),
  ],
  'artist, one record': [signal('ARTIST_KNOWN', { artist: 'Aphex Twin', owned: 1 })],
  'same pressing era': [signal('WANTLIST_PRESSING', { wantedYear: 1994, pressingYear: 1996 })],
  'one copy left': [signal('SCARCITY', { numForSale: 1 })],
  'one runner-up': [signal('WANTLIST_EXACT'), signal('ARTIST_KNOWN')],
  'three runners-up': [
    signal('WANTLIST_EXACT'),
    signal('LABEL_AFFINITY'),
    signal('ARTIST_GAP'),
    signal('SCARCITY'),
  ],
  'runner-up under another name': [
    signal('WANTLIST_EXACT'),
    signal('ARTIST_KNOWN', { artist: 'Dinky', via: 'Miss Dinky', relation: 'alias' }),
  ],
  'nothing specific': [signal('WANTLIST_PRESSING', { album: '' })],
}

/*
 * `Intl` spaces currencies and French punctuation with no-break spaces, and
 * which one depends on the ICU the runtime ships. The snapshot pins the words.
 */
const plain = (text: string) => text.replace(/[\u00a0\u202f]/g, ' ')

describe.each(LANGUAGES)('the reason, word for word, in %s', (language) => {
  it('leads with each signal', async () => {
    await useLanguage().apply(language)
    const sentences = Object.fromEntries(
      SIGNAL_TYPES.map((type) => [type, plain(reasonFor([signal(type)]))]),
    )
    expect(sentences).toMatchSnapshot()
  })

  it('carries the cases that change the grammar', async () => {
    await useLanguage().apply(language)
    const sentences = Object.fromEntries(
      Object.entries(CASES).map(([name, signals]) => [name, plain(reasonFor(signals))]),
    )
    expect(sentences).toMatchSnapshot()
  })

  it('names each signal on a plate', async () => {
    await useLanguage().apply(language)
    const plates = Object.fromEntries(
      SIGNAL_TYPES.map((type) => [type, plain(plateFor(signal(type)))]),
    )
    expect(plates).toMatchSnapshot()
  })
})
