import { describe, expect, it } from 'vitest'

import type { Match } from '#shared/types'
import {
  arrange,
  availableSignals,
  DEFAULT_DIRECTION,
  parseDensity,
  parseDirection,
  parseSignals,
  parseSort,
  parseUpTo,
} from '~/utils/digview'

function match(over: Partial<Match> = {}): Match {
  return {
    digId: '01A',
    listingId: 1,
    releaseId: 1,
    score: 50,
    signals: [{ type: 'ARTIST_KNOWN', confidence: 1, evidence: {} }],
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

  /*
   * Three ways to look at the same finds, and the default is the one that
   * carries the sentence saying why a record is in the list — the app's whole
   * product. Anything the address does not recognise lands there.
   */
  it('is comfortable unless the URL asks for another density', () => {
    expect(parseDensity('')).toBe('comfortable')
    expect(parseDensity('kompakt')).toBe('compact')
    expect(parseDensity('kiste')).toBe('crate')
    expect(parseDensity('crate')).toBe('comfortable')
  })
})

/**
 * Turning an ordering round (M32.2).
 *
 * Every key had exactly one direction until 2026-09-14 — the arrow sat inside
 * the label — and "I want to sort the price from cheap to expensive or the
 * other way round" had no other way round to offer.
 */
describe('the direction', () => {
  const priced = [
    match({ listingId: 1, price: 30, score: 10 }),
    match({ listingId: 2, price: 10, score: 10 }),
    match({ listingId: 3, price: 20, score: 10 }),
  ]

  it('runs the key its own way by default, and the other way when asked', () => {
    expect(arrange(priced, [], 'price').map((m) => m.listingId)).toEqual([2, 3, 1])
    expect(arrange(priced, [], 'price', '', null, 'desc').map((m) => m.listingId)).toEqual([
      1, 3, 2,
    ])
  })

  /*
   * The half that is easy to get wrong: a record whose price expired belongs
   * at the end of "cheapest first" *and* at the end of "dearest first".
   * Flipping the whole comparison would float the blanks to the top the
   * moment somebody turned the arrow, and an expired dig would look like the
   * cheapest shop in town from the other end.
   */
  it('keeps the missing ones last from either end', () => {
    const mixed = [...priced, match({ listingId: 4, price: null, score: 99 })]

    expect(arrange(mixed, [], 'price').at(-1)?.listingId).toBe(4)
    expect(arrange(mixed, [], 'price', '', null, 'desc').at(-1)?.listingId).toBe(4)
  })

  it('reads a direction out of the address, and falls back to the key-s own', () => {
    expect(parseDirection('', 'price')).toBe('asc')
    expect(parseDirection('desc', 'price')).toBe('desc')
    expect(parseDirection('sideways', 'year')).toBe('desc')
    expect(DEFAULT_DIRECTION.artist).toBe('asc')
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

describe('with postage', () => {
  // A €4 record from a shop that charges €9 to ship is not cheaper than a €7
  // one that rides in a parcel already paid for. The list can say so only
  // when it knows the shop's postage; `landedPrice` is tested on its own in
  // `landed.spec.ts`, this is the sort and the ceiling built on it.
  const all = [
    match({ listingId: 1, score: 10, price: 4 }),
    match({ listingId: 2, score: 20, price: 7 }),
    match({ listingId: 3, score: 30, price: null }),
  ]
  const postage: Record<number, number | null> = { 1: 9, 2: 0, 3: null }
  const landed = {
    of: (m: Match) =>
      m.price === null || postage[m.listingId] === null
        ? null
        : {
            total: m.price + postage[m.listingId]!,
            postage: postage[m.listingId]!,
            currency: 'EUR',
            items: 1,
            source: 'parsed' as const,
          },
    upTo: null,
  }

  it('sorts by price plus postage, the unpriced last', () => {
    expect(arrange(all, [], 'landed', '', landed).map((m) => m.listingId)).toEqual([2, 1, 3])
  })

  it('keeps only what fits under the ceiling, postage counted', () => {
    // €7 fits under €10; €4 + €9 does not; a record with no number is not
    // "under €10" either — it is unknown.
    const capped = { ...landed, upTo: 10 }
    expect(arrange(all, [], 'score', '', capped).map((m) => m.listingId)).toEqual([2])
  })

  it('changes nothing when nobody asked', () => {
    // No context, or a context with no ceiling under a different sort: the
    // list is exactly what it was.
    expect(arrange(all, [], 'score').map((m) => m.listingId)).toEqual([3, 2, 1])
    expect(arrange(all, [], 'score', '', landed).map((m) => m.listingId)).toEqual([3, 2, 1])
  })

  it('offers the sort key and reads a ceiling out of the URL', () => {
    expect(parseSort('landed')).toBe('landed')
    expect(parseUpTo('30')).toBe(30)
    expect(parseUpTo('12,50')).toBe(12.5)
    expect(parseUpTo('')).toBeNull()
    expect(parseUpTo('-3')).toBeNull()
    expect(parseUpTo('lots')).toBeNull()
  })
})
