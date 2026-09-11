import { describe, expect, it } from 'vitest'

import { addPoint, judge, MAX_POINTS, WINDOW_MS } from '~~/worker/watched/judge'
import type { WatchedRelease, WatchPoint } from '#shared/types'

/**
 * Wann eine beobachtete Platte eine Meldung wert ist (M11).
 *
 * Die einzige Rechnung des Features, und deshalb reine Funktionen: sie lassen
 * sich prüfen, ohne eine Datenbank aufzumachen — dasselbe Prinzip wie bei
 * `worker/match/`.
 *
 * Die Richtung hängt daran, wem die Platte gehört. Bei einer eigenen ist der
 * **Anstieg** die Neuigkeit, bei einer gesuchten der **Fall**.
 */
const TAG = 24 * 60 * 60 * 1000
const JETZT = 1_800_000_000_000

const punkt = (
  tageZurueck: number,
  lowestPrice: number | null,
  numForSale = 3,
): WatchPoint => ({
  at: JETZT - tageZurueck * TAG,
  lowestPrice,
  currency: 'EUR',
  numForSale,
})

const beobachtet = (over: Partial<WatchedRelease>): WatchedRelease => ({
  releaseId: 1,
  kind: 'shelf',
  artist: 'The Persuader',
  title: 'Stockholm',
  since: JETZT - 90 * TAG,
  threshold: null,
  points: [],
  checkedAt: null,
  notifiedAt: null,
  ...over,
})

describe('a record of your own', () => {
  /** Die Frage, die sonst niemand beantwortet. */
  it('says when it has become worth more', () => {
    const news = judge(
      beobachtet({ points: [punkt(60, 40), punkt(0, 95)], threshold: 25 }),
      JETZT,
    )
    expect(news).toEqual({ kind: 'rose', from: 40, to: 95, percent: 138, currency: 'EUR' })
  })

  it('stays quiet about noise', () => {
    // 40 auf 44 sind zehn Prozent und keine Nachricht.
    expect(
      judge(beobachtet({ points: [punkt(60, 40), punkt(0, 44)], threshold: 25 }), JETZT),
    ).toBeNull()
  })

  /**
   * Verglichen wird mit dem **ältesten** Punkt im Fenster, nicht mit dem
   * vorletzten.
   *
   * Ein Anstieg von vierzig auf fünfundneunzig kommt in dreißig kleinen
   * Schritten. Wer nur Nachbarn vergleicht, sieht ihn nie — jeder einzelne
   * Schritt liegt unter jeder vernünftigen Schwelle.
   */
  it('sees a slow climb that no two neighbours would show', () => {
    const langsam = Array.from({ length: 30 }, (_, i) => punkt(60 - i * 2, 40 + i * 2))
    expect(judge(beobachtet({ points: langsam, threshold: 25 }), JETZT)).toMatchObject({
      kind: 'rose',
      from: 40,
    })

    // Und zum Beleg: zwei Nachbarn allein sagen nichts.
    const zweiNachbarn = langsam.slice(-2)
    expect(judge(beobachtet({ points: zweiNachbarn, threshold: 25 }), JETZT)).toBeNull()
  })

  /**
   * **„Verkauft" wird nicht behauptet.**
   *
   * Ein fallendes `num_for_sale` kann ein Kauf sein oder ein zurückgezogenes
   * Listing, und die API sagt nicht, welches. Die Nachricht heißt deshalb
   * `fewer` und nicht `sold` — was gemessen wurde, nicht was vermutet wird.
   */
  it('reports one fewer on offer, and does not call it a sale', () => {
    const news = judge(beobachtet({ points: [punkt(30, 40, 5), punkt(0, 40, 2)] }), JETZT)
    expect(news).toEqual({ kind: 'fewer', from: 5, to: 2 })
    expect(JSON.stringify(news)).not.toMatch(/sold|verkauft/i)
  })

  it('ignores a single copy coming and going', () => {
    expect(judge(beobachtet({ points: [punkt(30, 40, 3), punkt(0, 40, 2)] }), JETZT)).toBeNull()
  })

  /** Nichts angeboten heißt kein Preis — und kein Preis ist keine Rechnung. */
  it('does not divide by a price that is not there', () => {
    expect(
      judge(beobachtet({ points: [punkt(30, null, 0), punkt(0, 40, 1)] }), JETZT),
    ).toBeNull()
    expect(judge(beobachtet({ points: [punkt(30, 0, 1), punkt(0, 40, 1)] }), JETZT)).toBeNull()
  })
})

describe('a record you are after', () => {
  it('says when it drops below your limit', () => {
    const news = judge(
      beobachtet({ kind: 'wantlist', threshold: 30, points: [punkt(30, 48), punkt(0, 24)] }),
      JETZT,
    )
    expect(news).toEqual({ kind: 'fell', to: 24, threshold: 30, currency: 'EUR' })
  })

  /** Und nicht bei jedem Durchlauf noch einmal, solange es darunter bleibt. */
  it('says it once, not on every check', () => {
    expect(
      judge(
        beobachtet({ kind: 'wantlist', threshold: 30, points: [punkt(30, 24), punkt(0, 22)] }),
        JETZT,
      ),
    ).toBeNull()
  })

  /** Von nirgends zu haben auf überhaupt zu haben — bei einer seltenen Platte
   *  ist das die eigentliche Nachricht. */
  it('says when one turns up at all', () => {
    expect(
      judge(
        beobachtet({
          kind: 'wantlist',
          threshold: null,
          points: [punkt(30, null, 0), punkt(0, 55, 2)],
        }),
        JETZT,
      ),
    ).toEqual({ kind: 'appeared', numForSale: 2, price: 55, currency: 'EUR' })
  })

  /**
   * **Keine Nachricht nennt einen Laden.**
   *
   * Es gibt keinen Endpunkt, der die Angebote zu einer Release-Id auflistet
   * (`docs/02`). Wir wissen, dass es eine gibt und was sie kostet — nicht, wo.
   * Ein Feld dafür wäre eine Zusage, die die API nicht deckt.
   */
  it('never names a shop, because it cannot know one', () => {
    const alle = [
      judge(beobachtet({ points: [punkt(60, 40), punkt(0, 95)], threshold: 25 }), JETZT),
      judge(
        beobachtet({ kind: 'wantlist', threshold: 30, points: [punkt(30, 48), punkt(0, 24)] }),
        JETZT,
      ),
      judge(
        beobachtet({ kind: 'wantlist', points: [punkt(30, null, 0), punkt(0, 55, 2)] }),
        JETZT,
      ),
    ]
    for (const news of alle) {
      expect(Object.keys(news ?? {})).not.toContain('dealer')
      expect(Object.keys(news ?? {})).not.toContain('seller')
    }
  })
})

describe('the trail of measurements', () => {
  /** Wer die App fünfmal öffnet, misst fünfmal dasselbe. */
  it('keeps one point per day, not one per look', () => {
    const morgens = punkt(0, 40)
    const mittags = { ...punkt(0, 41), at: morgens.at + 3600_000 }
    expect(addPoint([morgens], mittags)).toEqual([mittags])
  })

  it('keeps yesterday and today apart', () => {
    const gestern = punkt(1, 40)
    const heute = punkt(0, 41)
    expect(addPoint([gestern], heute)).toEqual([gestern, heute])
  })

  /** Eine Platte wird über Jahre beobachtet; niemand liest dreihundert Punkte. */
  it('has a ceiling', () => {
    const viele = Array.from({ length: MAX_POINTS + 20 }, (_, i) => punkt(200 - i, 40))
    const nach = addPoint(viele, punkt(0, 41))
    expect(nach).toHaveLength(MAX_POINTS)
    expect(nach.at(-1)?.lowestPrice).toBe(41)
  })

  /** Was älter ist als das Fenster, zählt nicht mehr als Vergleichspunkt. */
  it('forgets what is older than the window', () => {
    const uralt = { ...punkt(0, 10), at: JETZT - WINDOW_MS - TAG }
    const neu = punkt(0, 40)
    // Der uralte Punkt würde 300 % ergeben — er ist aber außerhalb, und der
    // nächste im Fenster ist der einzige andere.
    expect(judge(beobachtet({ points: [uralt, neu], threshold: 25 }), JETZT)).toBeNull()
  })
})
