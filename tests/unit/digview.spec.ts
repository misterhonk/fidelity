import { describe, expect, it } from 'vitest'

import type { Match } from '#shared/types'
import {
  arrange,
  availableSignals,
  parseDensity,
  parseSignals,
  parseSort,
} from '~/utils/digview'

function match(over: Partial<Match> = {}): Match {
  return {
    digId: '01A',
    listingId: 1,
    releaseId: 1,
    score: 50,
    signals: [{ type: 'ARTIST_KNOWN', confidence: 1, evidence: {} }],
    reason: 'Weil.',
    title: 'Platte',
    artist: 'Beta',
    label: null,
    catno: null,
    format: '12"',
    year: 2000,
    condition: null,
    sleeve: null,
    price: 10,
    currency: 'EUR',
    comments: null,
    thumbUrl: null,
    marketLowestPrice: null,
    marketNumForSale: null,
    expired: false,
    ...over,
  }
}

describe('reading the view out of the URL', () => {
  const matches = [
    match({ signals: [{ type: 'WANTLIST_EXACT', confidence: 1, evidence: {} }] }),
  ]

  it('ignores a signal that fired nowhere in this dig', () => {
    // A hand-edited or stale URL degrades to "no filter", never to an empty
    // screen with no obvious way back.
    expect(parseSignals('SCARCITY', matches)).toEqual([])
  })

  it('keeps the ones that are really there', () => {
    expect(parseSignals('WANTLIST_EXACT,SCARCITY', matches)).toEqual(['WANTLIST_EXACT'])
  })

  it('falls back to score for a sort key it does not know', () => {
    expect(parseSort('bogus')).toBe('score')
    expect(parseSort('price')).toBe('price')
  })

  it('is comfortable unless the URL asks for compact', () => {
    expect(parseDensity('')).toBe('comfortable')
    expect(parseDensity('kompakt')).toBe('compact')
  })
})

describe('the chips on offer', () => {
  it('counts how many matches carry each signal, commonest first', () => {
    const matches = [
      match({ listingId: 1 }),
      match({ listingId: 2 }),
      match({
        listingId: 3,
        signals: [{ type: 'WANTLIST_EXACT', confidence: 1, evidence: {} }],
      }),
    ]

    expect(availableSignals(matches)).toEqual([
      { type: 'ARTIST_KNOWN', n: 2 },
      { type: 'WANTLIST_EXACT', n: 1 },
    ])
  })

  it('offers nothing for an empty dig', () => {
    expect(availableSignals([])).toEqual([])
  })
})

describe('filtering and sorting', () => {
  const wantlist = match({
    listingId: 1,
    score: 90,
    price: 30,
    year: 1994,
    artist: 'Alpha',
    signals: [{ type: 'WANTLIST_EXACT', confidence: 1, evidence: {} }],
  })
  const artist = match({ listingId: 2, score: 60, price: 5, year: 2010, artist: 'Zeta' })
  const both = match({
    listingId: 3,
    score: 70,
    price: 20,
    year: 1978,
    artist: 'Mu',
    signals: [
      { type: 'ARTIST_KNOWN', confidence: 1, evidence: {} },
      { type: 'WANTLIST_EXACT', confidence: 1, evidence: {} },
    ],
  })
  const all = [wantlist, artist, both]

  it('shows everything when no chip is active', () => {
    expect(arrange(all, [], 'score').map((m) => m.listingId)).toEqual([1, 3, 2])
  })

  it('treats two chips as OR, not AND', () => {
    // AND would return only listing 3 here, which is the reading that makes
    // the filter bar look broken on a shop with mixed reasons.
    expect(
      arrange(all, ['WANTLIST_EXACT', 'ARTIST_KNOWN'], 'score').map((m) => m.listingId),
    ).toEqual([1, 3, 2])
  })

  it('narrows to one signal when only one chip is active', () => {
    expect(arrange(all, ['WANTLIST_EXACT'], 'score').map((m) => m.listingId)).toEqual([1, 3])
  })

  it('sorts by price ascending, cheapest first', () => {
    expect(arrange(all, [], 'price').map((m) => m.listingId)).toEqual([2, 3, 1])
  })

  it('sorts by year descending, newest first', () => {
    expect(arrange(all, [], 'year').map((m) => m.listingId)).toEqual([2, 1, 3])
  })

  it('sorts by artist the way German expects', () => {
    expect(arrange(all, [], 'artist').map((m) => m.artist)).toEqual(['Alpha', 'Mu', 'Zeta'])
  })

  it('breaks ties on score, so equal prices keep the engine ordering', () => {
    const cheap = [
      match({ listingId: 7, price: 5, score: 40 }),
      match({ listingId: 8, price: 5, score: 80 }),
    ]
    expect(arrange(cheap, [], 'price').map((m) => m.listingId)).toEqual([8, 7])
  })

  it('does not mutate the list it was handed', () => {
    const order = all.map((m) => m.listingId)
    arrange(all, [], 'price')
    expect(all.map((m) => m.listingId)).toEqual(order)
  })
})

describe('the free-text filter', () => {
  const all = [
    match({
      listingId: 1,
      artist: 'Robag Wruhme',
      title: 'Wuzzelbud KK',
      label: 'Musik Krause',
    }),
    match({
      listingId: 2,
      artist: 'Trentemøller',
      title: 'The Last Resort',
      label: 'Poker Flat',
    }),
    match({ listingId: 3, artist: 'Various', title: 'Poker Flat Vol. 5', label: 'Poker Flat' }),
  ]

  it('finds by artist, title, label and catalogue number alike', () => {
    expect(arrange(all, [], 'score', 'robag').map((m) => m.listingId)).toEqual([1])
    expect(arrange(all, [], 'score', 'resort').map((m) => m.listingId)).toEqual([2])
    expect(arrange(all, [], 'score', 'poker').map((m) => m.listingId)).toEqual([2, 3])
  })

  it('requires every word, so two words narrow instead of widen', () => {
    expect(arrange(all, [], 'score', 'poker vol').map((m) => m.listingId)).toEqual([3])
  })

  it('does not care about case or surrounding whitespace', () => {
    expect(arrange(all, [], 'score', '  ROBAG  ').map((m) => m.listingId)).toEqual([1])
  })

  it('shows everything for an empty query', () => {
    expect(arrange(all, [], 'score', '   ')).toHaveLength(3)
  })

  it('narrows on top of the chips rather than replacing them', () => {
    const mixed = [
      match({
        listingId: 4,
        artist: 'Robag Wruhme',
        signals: [{ type: 'WANTLIST_EXACT', confidence: 1, evidence: {} }],
      }),
      ...all,
    ]
    expect(
      arrange(mixed, ['WANTLIST_EXACT'], 'score', 'robag').map((m) => m.listingId),
    ).toEqual([4])
  })

  it('finds nothing in an expired dig, where the text is gone', () => {
    // Not a bug: six hours on there is no title left to search.
    const expired = [match({ listingId: 9, artist: null, title: null, label: null })]
    expect(arrange(expired, [], 'score', 'robag')).toHaveLength(0)
  })
})

describe('an expired dig, where half the fields are gone', () => {
  // Six hours after the scan, title, artist, price and year are nulled by
  // design (docs/03 §6). Sorting still has to produce something sane.
  const expired = [
    match({ listingId: 1, score: 40, price: null, year: null, artist: null, expired: true }),
    match({ listingId: 2, score: 80, price: null, year: null, artist: null, expired: true }),
  ]

  it('falls back to the score under every key', () => {
    for (const key of ['price', 'year', 'artist'] as const) {
      expect(arrange(expired, [], key).map((m) => m.listingId)).toEqual([2, 1])
    }
  })

  it('puts records missing the sort key behind ones that have it', () => {
    const mixed = [...expired, match({ listingId: 3, score: 10, price: 99 })]
    expect(arrange(mixed, [], 'price').map((m) => m.listingId)).toEqual([3, 2, 1])
  })

  it('sorts a nameless record last, not first', () => {
    const mixed = [...expired, match({ listingId: 3, score: 10, artist: 'Alpha' })]
    expect(arrange(mixed, [], 'artist').map((m) => m.listingId)).toEqual([3, 2, 1])
  })
})
