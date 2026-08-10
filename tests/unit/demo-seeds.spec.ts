import { describe, expect, it } from 'vitest'

import { DEMO_SEEDS, seedsForToday, SEEDS_SHOWN } from '~/utils/demo-seeds'

/**
 * Drei Platten, die einladend aussehen sollen.
 *
 * The pool is offered three at a time, taken consecutively, and rotated by the
 * date. Grouped by genre — which is how it was first written — that produced
 * three German new-wave singles from one shop on the day it was built, and
 * would have produced three techno twelve-inches on another. A demo meant to
 * welcome anybody cannot look like one person's record collection on any given
 * day.
 */
describe('the records somebody can start from', () => {
  it('offers three', () => {
    expect(seedsForToday()).toHaveLength(SEEDS_SHOWN)
  })

  it('shows the same three all day, and different ones tomorrow', () => {
    // Random would reshuffle on every reload, which reads as unreliable and
    // makes a link somebody sent to a friend show something else.
    const morning = new Date('2026-08-10T08:00:00Z')
    const evening = new Date('2026-08-10T21:00:00Z')
    const tomorrow = new Date('2026-08-11T08:00:00Z')

    expect(seedsForToday(morning)).toEqual(seedsForToday(evening))
    expect(seedsForToday(tomorrow)).not.toEqual(seedsForToday(morning))
  })

  it('never offers three from the same shop', () => {
    // The failure that produced this test: three from schoenwettermusik, all
    // German new wave, on the first day it ran.
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
    for (const seed of DEMO_SEEDS) {
      expect(Object.keys(seed).sort()).toEqual(
        ['artist', 'dealer', 'label', 'listingId', 'promise', 'title', 'year'].sort(),
      )
    }
  })

  it('says what each one is meant to show', () => {
    // The promise is the reason it is in the list: the shop demonstrably holds
    // neighbours. A seed with nothing around it produces an empty demo.
    for (const seed of DEMO_SEEDS) {
      expect(seed.promise.length).toBeGreaterThan(20)
    }
  })
})
