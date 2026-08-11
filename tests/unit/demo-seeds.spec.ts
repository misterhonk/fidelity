import { describe, expect, it } from 'vitest'

import { DEALER_LOGOS, DEMO_SEEDS, seedsForToday, SEEDS_SHOWN } from '~/utils/demo-seeds'

/**
 * Vier Platten, die einladend aussehen sollen.
 *
 * The pool is offered four at a time, taken consecutively, and rotated by the
 * date. Grouped by genre — which is how it was first written — that produced
 * three German new-wave singles from one shop on the day it was built, and
 * would have produced three techno twelve-inches on another. A demo meant to
 * welcome anybody cannot look like one person's record collection on any given
 * day.
 */
describe('the records somebody can start from', () => {
  it('offers four', () => {
    expect(seedsForToday()).toHaveLength(SEEDS_SHOWN)
  })

  it('shows the same four all day, and different ones tomorrow', () => {
    // Random would reshuffle on every reload, which reads as unreliable and
    // makes a link somebody sent to a friend show something else.
    const morning = new Date('2026-08-10T08:00:00Z')
    const evening = new Date('2026-08-10T21:00:00Z')
    const tomorrow = new Date('2026-08-11T08:00:00Z')

    expect(seedsForToday(morning)).toEqual(seedsForToday(evening))
    expect(seedsForToday(tomorrow)).not.toEqual(seedsForToday(morning))
  })

  it('never offers a whole row from the same shop', () => {
    // The failure that produced this test: three from schoenwettermusik, all
    // German new wave, on the first day it ran. Four at a time makes it easier
    // to hit, not harder — one shop holds seven of the thirteen.
    for (let day = 0; day < DEMO_SEEDS.length; day++) {
      const shown = seedsForToday(new Date(Date.UTC(2026, 0, 1 + day)))
      const shops = new Set(shown.map((seed) => seed.dealer))
      expect(
        shops.size,
        shown.map((s) => `${s.artist} (${s.dealer})`).join(', '),
      ).toBeGreaterThan(1)
    }
  })

  it('spans more than one decade in every rotation', () => {
    for (let day = 0; day < DEMO_SEEDS.length; day++) {
      const shown = seedsForToday(new Date(Date.UTC(2026, 0, 1 + day)))
      const decades = new Set(shown.map((seed) => Math.floor(seed.year / 10)))
      expect(
        decades.size,
        shown.map((s) => `${s.artist} ${s.year}`).join(', '),
      ).toBeGreaterThan(1)
    }
  })

  it('carries no price and no condition', () => {
    // Marketplace data may not be shown once it is six hours old (rule 4). A
    // price frozen into the source would be stale the same afternoon.
    //
    // The two cover addresses are not marketplace data and are allowed here:
    // they describe the *release*, not the offer, and a sleeve does not change
    // when the record sells. An allow-list rather than a deny-list, so the next
    // field somebody freezes in has to be argued for here first.
    for (const seed of DEMO_SEEDS) {
      expect(Object.keys(seed).sort()).toEqual(
        [
          'artist',
          'coverUrl',
          'dealer',
          'label',
          'listingId',
          'promise',
          'thumbUrl',
          'title',
          'year',
        ].sort(),
      )
    }
  })

  it('every one has a sleeve to show', () => {
    /*
     * The screen is a row of covers, so a seed without one is a grey square in
     * the middle of it — which is what sent Audion's "Suckfish" out of this
     * list. Both sizes, because both are used: 150 px on a phone, 600 px on a
     * desktop tile and every retina screen.
     */
    for (const seed of DEMO_SEEDS) {
      expect(seed.thumbUrl).toMatch(/^https:\/\/i\.discogs\.com\/.+\.jpeg$/)
      expect(seed.coverUrl).toMatch(/^https:\/\/i\.discogs\.com\/.+\.jpeg$/)
      expect(seed.coverUrl).not.toBe(seed.thumbUrl)
    }
  })

  it('knows a logo for every shop it names', () => {
    // A shop tile with no logo falls back to nothing here — the demo draws the
    // badge only when it has one, so a missing entry is silently a plain cover.
    for (const seed of DEMO_SEEDS) {
      expect(DEALER_LOGOS[seed.dealer]).toMatch(/^https:\/\/i\.discogs\.com\//)
    }
  })

  it('says what each one is meant to show, in every language', () => {
    // The promise is the reason it is in the list: the shop demonstrably holds
    // neighbours. A seed with nothing around it produces an empty demo.
    //
    // Both languages, because a promise is per record — "seven more Clash
    // records on the rack" — and a translation that quietly dropped one would
    // leave a blank line under a cover rather than a missing key anywhere.
    for (const seed of DEMO_SEEDS) {
      for (const language of ['en', 'de'] as const) {
        expect(seed.promise[language].length, `${seed.title} in ${language}`).toBeGreaterThan(
          20,
        )
      }
    }
  })
})
