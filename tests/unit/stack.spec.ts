import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import type { StackShop } from '#shared/types'

/**
 * Der Stapel — und die vier Entscheidungen, die ihn von einem Spielautomaten
 * unterscheiden (`docs/06` M15).
 *
 * 1. **Die Reihenfolge bleibt die Punktzahl.** Zu mischen, damit es länger
 *    spannend bleibt, würde das Einzige wegwerfen, was diese App kann.
 * 2. **Der Begründungssatz steht auf jeder Karte.** Ohne ihn sind es Bilder.
 * 3. **Er hört auf.** Ein Laden ist irgendwann durch, und dann sagt der
 *    Bildschirm das.
 * 4. **Preise verschwinden nach sechs Stunden.** Ein Stapel, durch den man
 *    schnell wischt, ist der leichteste Ort, an dem ein alter Preis
 *    unbemerkt stehen bleibt (Regel 4).
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
   * Die wichtigste Zusage des ganzen Bildschirms.
   *
   * Bei 1,2 s pro Discogs-Anfrage wäre ein Feed, der beim Wischen nachlädt,
   * unbenutzbar — und bei dreihundert Funden wäre er genau die Schleife, die
   * Regel 2 verbietet. Der Stapel zeigt nur, was der Dig schon geholt hat.
   */
  it('asks Discogs for nothing', () => {
    expect(code(WORKER)).not.toMatch(/fetch\(|DiscogsClient|discogs\.com/)
    expect(code(PAGE)).not.toMatch(/fetch\(|discogs\.com\/(?!sell)/)
  })

  /** Cover kommen aus dem gemeinsamen Speicher, und nur die nächsten paar. */
  it('asks for the next few covers, not the whole stack', () => {
    expect(code(PAGE)).toMatch(/slice\(at\.value, at\.value \+ 5\)/)
  })
})

describe('the four decisions', () => {
  it('keeps the score order the dig produced', () => {
    // Keine eigene Sortierung der Karten: `dig.get` liefert sie nach Punkten,
    // und eine zweite Meinung darüber wäre eine zweite Wahrheit.
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

  /** Und abgelaufene Digs kommen gar nicht erst in die obere Reihe. */
  it('keeps an expired dig out of the row entirely', () => {
    expect(code(WORKER)).toMatch(/if \(dig\.expiresAt <= now\) continue/)
  })
})

describe('what the card shows', () => {
  /**
   * Ein Cover gehört zu einem Titel, und zwar sofort.
   *
   * Ohne `key` behält Vue dasselbe `<img>` und tauscht nur die Adresse — bis
   * das neue Bild geladen ist, steht das vorige über dem neuen Titel. In einer
   * Liste fällt das nicht auf, weil jede Zeile ihr eigenes Bild hat; hier
   * wechselt ein einzelnes Element zwischen zwei Platten.
   */
  it('builds a fresh card per record, so no cover outlives its title', () => {
    expect(code(PAGE)).toMatch(/<StackCard\s+:key="card\.listingId"/)
  })
})

describe('the way back', () => {
  /**
   * Tinder kann sich ein verlorenes Nein leisten, eine seltene Platte nicht.
   *
   * Deshalb ist jeder Wisch umkehrbar — und zwar sichtbar, nicht als
   * verstecktes Kürzel.
   */
  it('undoes a swipe', () => {
    expect(code(PAGE)).toMatch(/go\(-1\)/)
    expect(code(PAGE)).toMatch(/d\.stack\.back/)
  })

  /**
   * Der Fortschritt zählt aber nur vorwärts.
   *
   * Wer zurückwischt, hat die Karten trotzdem gesehen. Den Zähler zu senken
   * würde den Ring wieder anschalten und dem Bildschirm eine Behauptung
   * aufdrücken, die nicht stimmt.
   */
  it('never counts the progress back down', () => {
    expect(code(WORKER)).toMatch(/Math\.max\(dig\.stackSeen \?\? 0/)
    expect(code(PAGE)).toMatch(/if \(!current \|\| seen <= current\.seen\) return/)
  })
})

/**
 * Und er ist zu finden.
 *
 * Bis zum 2026-09-11 führte **kein einziger Link** von der Startseite in den
 * Stapel: der eine, den es gab, stand auf der Dig-Seite und dort nur
 * innerhalb von `v-if="result"`. Im Browser nachgezählt — null Treffer auf
 * `/stack`. Ein Bildschirm, den man kennen muss, um ihn zu erreichen,
 * existiert für die meisten nicht, und das sieht man keinem Test an, der nur
 * den Bildschirm selbst prüft.
 */
describe('the way in', () => {
  const INDEX = readFileSync('app/pages/index.vue', 'utf8')

  it('is on the start page', () => {
    expect(code(INDEX)).toMatch(/<StackShops/)
  })

  /** Und zwar auf den Laden, auf den jemand gezeigt hat. */
  it('opens the shop that was tapped, not the first one', () => {
    const SHOPS = readFileSync('app/components/StackShops.vue', 'utf8')
    expect(code(SHOPS)).toMatch(/query: \{ dealer: shop\.dealer \}/)
    expect(code(PAGE)).toMatch(/route\.query\.dealer/)
    expect(code(PAGE)).toMatch(/findIndex\(\(s\) => s\.dealer === wanted\)/)
  })
})

describe('the row of shops', () => {
  /** Der Ring ist eine Zahl und keine zweite Wahrheit. */
  it('lights the ring from the same count the stack works through', () => {
    expect(code(PAGE)).toMatch(/s\.matches - s\.seen > 0/)
  })

  it('can be worked with a keyboard alone', () => {
    // Ein Stapel, den nur ein Daumen bedienen kann, ist ein Bildschirm, den
    // ein Teil der Leute nicht hat.
    expect(code(PAGE)).toMatch(/ArrowRight/)
    expect(code(PAGE)).toMatch(/ArrowLeft/)
  })
})

/**
 * Und die Sortierung selbst, als Rechnung statt als Form.
 *
 * Sie ist die eine Stelle in diesem Modul, die etwas entscheidet: wo noch
 * etwas liegt, steht vorn. Rein nach Datum zu sortieren hieße, dass ein
 * durchgesehener Laden einen anderen verdeckt, in dem dreißig Funde warten.
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
