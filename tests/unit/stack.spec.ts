import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import type { StackShop } from '#shared/types'

/**
 * The stack — and the four decisions that separate it from a slot machine
 * (`docs/06` M15).
 *
 * 1. **The order stays the score.** Shuffling to keep it exciting for longer
 *    would throw away the one thing this app can do.
 * 2. **The reason sentence is on every card.** Without it they are pictures.
 * 3. **It stops.** A shop runs out eventually, and then the screen says so.
 * 4. **Prices disappear after six hours.** A stack somebody swipes through
 *    quickly is the easiest place for an old price to stand unnoticed
 *    (rule 4).
 */
const PAGE = readFileSync('app/pages/stack.vue', 'utf8')
const CARD = readFileSync('app/components/StackCard.vue', 'utf8')
const WORKER = readFileSync('worker/stack.ts', 'utf8')

const code = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/<!--[\s\S]*?-->/g, '')

describe('what a swipe costs', () => {
  /**
   * The most important promise of the whole screen.
   *
   * At 1.2 s per Discogs request, a feed that loaded as you swiped would be
   * unusable — and with three hundred finds it would be exactly the loop rule
   * 2 forbids. The stack shows only what the dig has already fetched.
   */
  it('asks Discogs for nothing', () => {
    expect(code(WORKER)).not.toMatch(/fetch\(|DiscogsClient|discogs\.com/)
    expect(code(PAGE)).not.toMatch(/fetch\(|discogs\.com\/(?!sell)/)
  })

  /** Covers come from the shared store, and only the next few. */
  it('asks for the next few covers, not the whole stack', () => {
    expect(code(PAGE)).toMatch(/slice\(at\.value, at\.value \+ 5\)/)
  })
})

describe('the four decisions', () => {
  it('keeps the score order the dig produced', () => {
    // No sorting of the cards here: `dig.get` returns them by score, and a
    // second opinion about that would be a second truth.
    expect(code(PAGE)).toMatch(/dig\.value\?\.matches \?\? \[\]/)
    expect(code(PAGE)).not.toMatch(/\.sort\(|shuffle|Math\.random/)
  })

  it('puts the reason on every card', () => {
    expect(code(CARD)).toMatch(/reasonFor\(match\.signals\)/)
  })

  it('stops, and says so', () => {
    expect(code(PAGE)).toMatch(/done\.value = true/)
    expect(code(PAGE)).toMatch(/d\.stack\.through/)
  })

  /** Preis weg, Fund bleibt — die Begründung überlebt die sechs Stunden. */
  it('drops the price once the dig is stale, and keeps the find', () => {
    expect(code(CARD)).toMatch(/v-if="!expired && match\.price !== null"/)
    expect(code(PAGE)).toMatch(/Date\.now\(\) >= dig\.value\.dig\.expiresAt/)
  })

  /** And expired digs do not reach the top row at all. */
  it('keeps an expired dig out of the row entirely', () => {
    expect(code(WORKER)).toMatch(/if \(dig\.expiresAt <= now\) continue/)
  })
})

describe('what the card shows', () => {
  /**
   * A cover belongs to a title, and at once.
   *
   * Without `key`, Vue keeps the same `<img>` and only swaps the address —
   * until the new image has loaded, the previous one stands above the new
   * title. In a list this does not show, because each row has its own picture;
   * here a single element changes between two records.
   */
  it('builds a fresh card per record, so no cover outlives its title', () => {
    expect(code(PAGE)).toMatch(/<StackCard\s+:key="card\.listingId"/)
  })
})

describe('the way back', () => {
  /**
   * Tinder can afford a lost no; a rare record cannot.
   *
   * So every swipe is reversible — and visibly so, not as a hidden shortcut.
   */
  it('undoes a swipe', () => {
    expect(code(PAGE)).toMatch(/go\(-1\)/)
    expect(code(PAGE)).toMatch(/d\.stack\.back/)
  })

  /**
   * The progress counts forwards only, though.
   *
   * Anyone swiping back has seen the cards all the same. Lowering the counter
   * would switch the ring back on and press a claim onto the screen that is
   * not true.
   */
  it('never counts the progress back down', () => {
    expect(code(WORKER)).toMatch(/Math\.max\(dig\.stackSeen \?\? 0/)
    expect(code(PAGE)).toMatch(/if \(!current \|\| seen <= current\.seen\) return/)
  })
})

/**
 * And it can be found.
 *
 * Until 2026-09-11 **not one link** led from the start page into the stack:
 * the one that existed stood on the dig page and there only inside
 * `v-if="result"`. Counted in the browser — zero hits on `/stack`. A screen
 * you have to know about to reach does not exist for most people, and no test
 * that checks only the screen itself shows that.
 */
describe('the way in', () => {
  const INDEX = readFileSync('app/pages/index.vue', 'utf8')

  it('is on the start page', () => {
    expect(code(INDEX)).toMatch(/<StackShops/)
  })

  /** And at the shop somebody pointed at. */
  it('opens the shop that was tapped, not the first one', () => {
    const SHOPS = readFileSync('app/components/StackShops.vue', 'utf8')
    expect(code(SHOPS)).toMatch(/query: \{ dealer: shop\.dealer \}/)
    expect(code(PAGE)).toMatch(/route\.query\.dealer/)
    expect(code(PAGE)).toMatch(/findIndex\(\(s\) => s\.dealer === wanted\)/)
  })
})

describe('the row of shops', () => {
  /** The ring is a number and not a second truth. */
  it('lights the ring from the same count the stack works through', () => {
    expect(code(PAGE)).toMatch(/s\.matches - s\.seen > 0/)
  })

  it('can be worked with a keyboard alone', () => {
    // A stack only a thumb can operate is a screen some people do not have.
    expect(code(PAGE)).toMatch(/ArrowRight/)
    expect(code(PAGE)).toMatch(/ArrowLeft/)
  })
})

/**
 * And the sorting itself, as a computation rather than as a shape.
 *
 * It is the one place in this module that decides something: wherever
 * something is still waiting stands at the front. Sorting purely by date would
 * mean a shop you have been through hiding one where thirty finds are waiting.
 */
describe('which shop comes first', () => {
  const shop = (over: Partial<StackShop>): StackShop => ({
    dealer: 'x',
    displayName: 'X',
    digId: 'd',
    scannedAt: 0,
    expiresAt: Number.MAX_SAFE_INTEGER,
    matches: 10,
    seen: 0,
    ...over,
  })

  /** Dieselbe Rechnung wie in `stackOverview`, hier isoliert. */
  const order = (shops: StackShop[]) =>
    [...shops].sort((a, b) => {
      const openA = a.matches - a.seen > 0
      const openB = b.matches - b.seen > 0
      if (openA !== openB) return openA ? -1 : 1
      return b.scannedAt - a.scannedAt
    })

  it('puts a shop with something waiting above a newer one that is done', () => {
    const alt = shop({ dealer: 'alt', scannedAt: 1, seen: 0 })
    const neuDurch = shop({ dealer: 'neu', scannedAt: 999, seen: 10 })
    expect(order([neuDurch, alt]).map((s) => s.dealer)).toEqual(['alt', 'neu'])
  })

  it('sorts by recency among equals', () => {
    const a = shop({ dealer: 'a', scannedAt: 5 })
    const b = shop({ dealer: 'b', scannedAt: 9 })
    expect(order([a, b]).map((s) => s.dealer)).toEqual(['b', 'a'])
  })
})
