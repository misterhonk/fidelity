import { describe, expect, it } from 'vitest'

import type {
  CollectionItem,
  HorizonChunk,
  Kin,
  TasteProfile,
  WantlistItem,
} from '#shared/types'
import { buildIndex, evaluate, type Listing, type MatchFilters } from '~~/worker/match'
import { reasonFor } from '~/i18n/reason'
import { computeTasteProfile } from '~~/worker/match/taste'

/**
 * End-to-end through the engine, on data shaped like the real thing: a small
 * electronic collection, a wantlist, and inventory rows whose format strings
 * are the ones Discogs actually sends.
 */

function record(
  releaseId: number,
  artist: string,
  artistId: number,
  label: string,
  labelId: number,
): CollectionItem {
  return {
    releaseId,
    masterId: 0,
    title: `Release ${releaseId}`,
    artistIds: [artistId],
    artistNorms: [],
    artistNames: [artist],
    labelIds: [labelId],
    labelNorms: [],
    labelNames: [label],
    catnos: [],
    genres: ['Electronic'],
    styles: ['Minimal'],
    formats: ['Vinyl', '12"'],
    year: 2005,
    rating: 0,
    addedAt: '2026-08-01T00:00:00-07:00',
  }
}

const collection: CollectionItem[] = [
  record(1, 'Robag Wruhme', 100, 'Border Community', 500),
  record(2, 'Robag Wruhme', 100, 'Border Community', 500),
  record(3, 'Robag Wruhme', 100, 'Freude Am Tanzen', 501),
  record(4, 'Kollektiv Turmstrasse', 101, 'Border Community', 500),
  record(5, 'Wighnomy Brothers', 102, 'Freude Am Tanzen', 501),
]

const wantlist: WantlistItem[] = [
  {
    ...record(900, 'Stardust', 200, 'Roulé', 600),
    rating: undefined,
  } as unknown as WantlistItem,
]

const taste: TasteProfile = computeTasteProfile(collection, 0)
const index = buildIndex(collection, wantlist, taste)

const filters: MatchFilters = {
  formatsAllow: ['Vinyl'],
  maxPrice: null,
  shipsFromBlock: [],
  prefMediaCondition: 'Very Good Plus (VG+)',
  targetPrice: null,
}

function listing(overrides: Partial<Listing> = {}): Listing {
  return {
    listingId: 1,
    releaseId: 7000,
    title: 'Wuppdeck',
    artist: 'Robag Wruhme',
    label: 'Musik Krause',
    catno: 'MK 12',
    format: '12"',
    year: 2004,
    condition: 'Near Mint (NM or M-)',
    sleeve: 'Near Mint (NM or M-)',
    price: 14,
    currency: 'EUR',
    shipsFrom: 'Germany',
    comments: null,
    thumbUrl: null,
    ...overrides,
  }
}

describe('the signals that M2 can actually fire', () => {
  it('S1 — the exact release sits on the wantlist', () => {
    const result = evaluate(listing({ releaseId: 900, artist: 'Stardust' }), index, filters)

    expect(result?.signals.map((s) => s.type)).toContain('WANTLIST_EXACT')
    expect(result?.score).toBeGreaterThanOrEqual(85)
    expect(reasonFor(result!.signals)).toContain('wantlist')
  })

  it('S1 carries how much it is wanted, and only when Discogs has a number', () => {
    // The priority changes the sentence, never the score (M20 #1).
    const wanted = buildIndex(
      collection,
      [
        { ...wantlist[0]!, want: 5 },
        { ...wantlist[0]!, releaseId: 901, want: 0 },
      ],
      taste,
    )
    const most = evaluate(listing({ releaseId: 900, artist: 'Stardust' }), wanted, filters)
    const plain = evaluate(listing({ releaseId: 901, artist: 'Stardust' }), wanted, filters)

    expect(most?.signals[0]?.evidence).toEqual({ releaseId: 900, want: 5 })
    expect(plain?.signals[0]?.evidence).toEqual({ releaseId: 901 })
    expect(most?.score).toBe(plain?.score)
    expect(reasonFor(most!.signals)).toBe(
      'Exactly this is on your wantlist — one of the ones you want most.',
    )
  })

  it('S3 — an artist already in the collection, this record not', () => {
    const result = evaluate(listing(), index, filters)

    expect(result?.signals.map((s) => s.type)).toContain('ARTIST_KNOWN')
    expect(reasonFor(result!.signals)).toContain('Robag Wruhme')
    expect(reasonFor(result!.signals)).toContain('3 records')
  })

  it('S5 — a label the collection leans on', () => {
    const result = evaluate(listing({ label: 'Border Community' }), index, filters)

    expect(result?.signals.map((s) => s.type)).toContain('LABEL_AFFINITY')
    expect(reasonFor(result!.signals)).toContain('Border Community')
  })

  it('stacks signals, and the strongest one leads the sentence', () => {
    const result = evaluate(
      listing({ releaseId: 900, artist: 'Robag Wruhme', label: 'Border Community' }),
      index,
      filters,
    )

    expect(result?.signals).toHaveLength(3)
    expect(reasonFor(result!.signals)).toMatch(/^Exactly this is on your wantlist\./)
    expect(reasonFor(result!.signals)).toContain('Also:')
  })
})

describe('the fuzzy cascade', () => {
  it('matches an artist listed together with another', () => {
    const result = evaluate(listing({ artist: 'Robag Wruhme / Ada' }), index, filters)
    expect(result?.signals.find((s) => s.type === 'ARTIST_KNOWN')).toBeDefined()
  })

  it('catches a typo that clears the threshold', () => {
    // 0.870 similarity — over the documented 0.85. Stage three confidence is
    // 0.70, which is 39 points and still worth keeping.
    const result = evaluate(listing({ artist: 'Kollektiv Turmstrase' }), index, filters)
    expect(result?.signals.find((s) => s.type === 'ARTIST_KNOWN')?.confidence).toBe(0.7)
  })

  it('refuses a near miss rather than guessing', () => {
    // "Robag Wruhmme" sits at 0.800. Precision over recall is what the 0.85
    // threshold buys, and a wrong match is worse than a missing one.
    expect(evaluate(listing({ artist: 'Robag Wruhmme' }), index, filters)).toBeNull()
    expect(evaluate(listing({ artist: 'Ricardo Villalobos' }), index, filters)).toBeNull()
  })

  it('never counts Various as an artist', () => {
    const withVarious = buildIndex(
      [...collection, record(6, 'Various', 999, 'Border Community', 500)],
      [],
      computeTasteProfile(
        [...collection, record(6, 'Various', 999, 'Border Community', 500)],
        0,
      ),
    )
    const result = evaluate(
      listing({ artist: 'Various', label: 'Musik Krause' }),
      withVarious,
      filters,
    )
    expect(result).toBeNull()
  })
})

/**
 * The lexicon — stage 0 of the cascade (docs/04 §S3).
 *
 * The inventory gives one string and no id, and the string is often not the
 * name on the shelf. The horizon's artist chunks bring every other name
 * along; here they are handed in directly, the way a dig gets them.
 */
describe('the lexicon', () => {
  const lexicon = (entityId: number, name: string, kin: Kin[]): HorizonChunk => ({
    key: `artist:${entityId}`,
    kind: 'artist',
    entityId,
    name,
    fetchedAt: 0,
    complete: true,
    requests: 2,
    releaseIds: new Int32Array(0),
    roles: new Uint8Array(0),
    years: new Int16Array(0),
    kin,
  })

  const known = (artist: string, chunks: HorizonChunk[]) =>
    evaluate(
      listing({ artist, label: null }),
      buildIndex(collection, wantlist, taste, chunks),
      filters,
    )?.signals.find((s) => s.type === 'ARTIST_KNOWN')

  it('reads an alias as the artist, as surely as the name itself', () => {
    const chunks = [lexicon(100, 'Robag Wruhme', [{ name: 'Wuppdeck', relation: 'alias' }])]
    const signal = known('Wuppdeck', chunks)

    expect(signal?.confidence).toBe(1)
    expect(signal?.evidence).toEqual({
      artist: 'Robag Wruhme',
      owned: 3,
      via: 'Wuppdeck',
      relation: 'alias',
    })
    // The sentence says under which name it was found, or it would claim the
    // listing said Robag Wruhme.
    expect(reasonFor([signal!])).toBe(
      'Wuppdeck is Robag Wruhme — you have 3 records by Robag Wruhme, not this one.',
    )
  })

  it('takes a member as a related act, never more certain than containment', () => {
    const chunks = [
      lexicon(102, 'Wighnomy Brothers', [{ name: 'Gabor Schablitzki', relation: 'member' }]),
    ]
    const signal = known('Gabor Schablitzki', chunks)

    expect(signal?.confidence).toBe(0.85)
    expect(reasonFor([signal!])).toBe(
      'Gabor Schablitzki is part of Wighnomy Brothers — Wighnomy Brothers is already on your shelf, not this one.',
    )
  })

  it('and the group of somebody you collect the same way round', () => {
    const chunks = [lexicon(100, 'Robag Wruhme', [{ name: 'Zimt', relation: 'group' }])]
    const signal = known('Zimt', chunks)

    expect(signal?.confidence).toBe(0.85)
    expect(reasonFor([signal!])).toBe(
      'Robag Wruhme is part of Zimt — you have 3 records by Robag Wruhme, not this one.',
    )
  })

  it('lets the name on the shelf win over an alias that spells it', () => {
    const chunks = [
      lexicon(100, 'Robag Wruhme', [{ name: 'Kollektiv Turmstrasse', relation: 'alias' }]),
    ]
    const signal = known('Kollektiv Turmstrasse', chunks)

    expect(signal?.evidence).toEqual({ artist: 'Kollektiv Turmstrasse', owned: 1 })
  })

  it('still runs the fuzzy stage over the other names', () => {
    const chunks = [
      lexicon(100, 'Robag Wruhme', [{ name: 'Wuppdeckmischmampflow', relation: 'alias' }]),
    ]
    expect(known('Wuppdeckmischmampflo', chunks)?.confidence).toBe(0.7)
  })

  it('never lets an alias be Various', () => {
    const chunks = [lexicon(100, 'Robag Wruhme', [{ name: 'Various', relation: 'alias' }])]
    expect(known('Various', chunks)).toBeUndefined()
  })

  it('has no names for somebody the collection does not know', () => {
    // A credit person has an artist chunk too, and is not on the shelf.
    const chunks = [lexicon(555, 'Conny Plank', [{ name: 'Konrad Plank', relation: 'alias' }])]
    expect(known('Konrad Plank', chunks)).toBeUndefined()
  })
})

describe('the hard filters', () => {
  it('drops a record already in the collection', () => {
    expect(evaluate(listing({ releaseId: 1 }), index, filters)).toBeNull()
  })

  it('keeps vinyl whatever Discogs calls it', () => {
    for (const format of ['12"', '2xLP, Album', 'LP', '7", Single']) {
      expect(evaluate(listing({ format }), index, filters), format).not.toBeNull()
    }
  })

  it('drops a CD when the preference is vinyl', () => {
    expect(evaluate(listing({ format: 'CD, Album' }), index, filters)).toBeNull()
  })

  it('drops anything over budget', () => {
    expect(evaluate(listing({ price: 99 }), index, { ...filters, maxPrice: 30 })).toBeNull()
  })

  it('drops a blocked shipping origin', () => {
    expect(evaluate(listing(), index, { ...filters, shipsFromBlock: ['Germany'] })).toBeNull()
  })
})

describe('the soft dampeners', () => {
  it('dampens a wantlist hit to 40 % but keeps it', () => {
    const good = evaluate(listing({ releaseId: 900 }), index, filters)!
    const poor = evaluate(listing({ releaseId: 900, condition: 'Good (G)' }), index, filters)!

    expect(poor.score).toBe(Math.round(good.score * 0.4))
    expect(poor.score).toBeGreaterThanOrEqual(30)
  })

  it('shows what the 0.40 dampener costs everything short of a wantlist hit', () => {
    // Artist plus label scores 60. Times 0.40 that is 24, under the 30 below
    // which nothing is stored — so with M2's three signals, a worn copy
    // survives only if it is on the wantlist. That follows from the documented
    // numbers, not from a decision taken here, and it is worth knowing before
    // someone reports the matches as missing.
    const clean = evaluate(listing({ label: 'Border Community' }), index, filters)!
    expect(clean.score).toBeGreaterThanOrEqual(50)
    expect(
      evaluate(listing({ label: 'Border Community', condition: 'Good (G)' }), index, filters),
    ).toBeNull()
  })

  it('drops a match whose score falls under 30 after dampening', () => {
    const result = evaluate(
      listing({ artist: 'Wighnomy Brothers', label: 'Musik Krause', condition: 'Poor (P)' }),
      index,
      filters,
    )
    expect(result).toBeNull()
  })
})

describe('a dealer with nothing for you', () => {
  it('returns nothing rather than something weak', () => {
    const result = evaluate(
      listing({ artist: 'Ricardo Villalobos', label: 'Perlon', releaseId: 8888 }),
      index,
      filters,
    )
    expect(result).toBeNull()
  })
})
