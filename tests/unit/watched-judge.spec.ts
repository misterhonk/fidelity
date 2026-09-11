import { describe, expect, it } from 'vitest'

import { addPoint, judge, MAX_POINTS, WINDOW_MS } from '~~/worker/watched/judge'
import type { WatchedRelease, WatchPoint } from '#shared/types'

/**
 * When a watched record is worth reporting (M11).
 *
 * The feature's only computation, and therefore pure functions: they can be
 * checked without opening a database — the same principle as `worker/match/`.
 *
 * The direction depends on whose record it is. On one you own, the **rise** is
 * the news; on one you want, the **fall**.
 */
const TAG = 24 * 60 * 60 * 1000
const NOW = 1_800_000_000_000

const punkt = (
  tageZurueck: number,
  lowestPrice: number | null,
  numForSale = 3,
): WatchPoint => ({
  at: NOW - tageZurueck * TAG,
  lowestPrice,
  currency: 'EUR',
  numForSale,
})

const watching = (over: Partial<WatchedRelease>): WatchedRelease => ({
  releaseId: 1,
  kind: 'shelf',
  artist: 'The Persuader',
  title: 'Stockholm',
  since: NOW - 90 * TAG,
  threshold: null,
  points: [],
  checkedAt: null,
  notifiedAt: null,
  ...over,
})

describe('a record of your own', () => {
  /** The question nobody else answers. */
  it('says when it has become worth more', () => {
    const news = judge(watching({ points: [punkt(60, 40), punkt(0, 95)], threshold: 25 }), NOW)
    expect(news).toEqual({ kind: 'rose', from: 40, to: 95, percent: 138, currency: 'EUR' })
  })

  it('stays quiet about noise', () => {
    // 40 to 44 is ten per cent and not news.
    expect(
      judge(watching({ points: [punkt(60, 40), punkt(0, 44)], threshold: 25 }), NOW),
    ).toBeNull()
  })

  /**
   * The comparison is against the **oldest** point in the window, not against
   * the penultimate one.
   *
   * A rise from forty to ninety-five comes in thirty small steps. Anyone
   * comparing only neighbours never sees it — every single step is below any
   * sensible threshold.
   */
  it('sees a slow climb that no two neighbours would show', () => {
    const langsam = Array.from({ length: 30 }, (_, i) => punkt(60 - i * 2, 40 + i * 2))
    expect(judge(watching({ points: langsam, threshold: 25 }), NOW)).toMatchObject({
      kind: 'rose',
      from: 40,
    })

    // And as evidence: two neighbours on their own say nothing.
    const zweiNachbarn = langsam.slice(-2)
    expect(judge(watching({ points: zweiNachbarn, threshold: 25 }), NOW)).toBeNull()
  })

  /**
   * **"Sold" is not claimed.**
   *
   * A falling `num_for_sale` can be a purchase or a withdrawn listing, and the
   * API does not say which. So the message is called `fewer` and not `sold` —
   * what was measured, not what is guessed.
   */
  it('reports one fewer on offer, and does not call it a sale', () => {
    const news = judge(watching({ points: [punkt(30, 40, 5), punkt(0, 40, 2)] }), NOW)
    expect(news).toEqual({ kind: 'fewer', from: 5, to: 2 })
    expect(JSON.stringify(news)).not.toMatch(/sold|verkauft/i)
  })

  it('ignores a single copy coming and going', () => {
    expect(judge(watching({ points: [punkt(30, 40, 3), punkt(0, 40, 2)] }), NOW)).toBeNull()
  })

  /** Nothing on offer means no price — and no price is not a calculation. */
  it('does not divide by a price that is not there', () => {
    expect(judge(watching({ points: [punkt(30, null, 0), punkt(0, 40, 1)] }), NOW)).toBeNull()
    expect(judge(watching({ points: [punkt(30, 0, 1), punkt(0, 40, 1)] }), NOW)).toBeNull()
  })
})

describe('a record you are after', () => {
  it('says when it drops below your limit', () => {
    const news = judge(
      watching({ kind: 'wantlist', threshold: 30, points: [punkt(30, 48), punkt(0, 24)] }),
      NOW,
    )
    expect(news).toEqual({ kind: 'fell', to: 24, threshold: 30, currency: 'EUR' })
  })

  /** And not again on every pass, for as long as it stays below. */
  it('says it once, not on every check', () => {
    expect(
      judge(
        watching({ kind: 'wantlist', threshold: 30, points: [punkt(30, 24), punkt(0, 22)] }),
        NOW,
      ),
    ).toBeNull()
  })

  /** From nowhere to be had to available at all — on a rare record that is the
   *  real news. */
  it('says when one turns up at all', () => {
    expect(
      judge(
        watching({
          kind: 'wantlist',
          threshold: null,
          points: [punkt(30, null, 0), punkt(0, 55, 2)],
        }),
        NOW,
      ),
    ).toEqual({ kind: 'appeared', numForSale: 2, price: 55, currency: 'EUR' })
  })

  /**
   * **No message names a shop.**
   *
   * There is no endpoint that lists the offers for a release id (`docs/02`).
   * We know one exists and what it costs — not where. A field for that would
   * be a promise the API does not cover.
   */
  it('never names a shop, because it cannot know one', () => {
    const alle = [
      judge(watching({ points: [punkt(60, 40), punkt(0, 95)], threshold: 25 }), NOW),
      judge(
        watching({ kind: 'wantlist', threshold: 30, points: [punkt(30, 48), punkt(0, 24)] }),
        NOW,
      ),
      judge(watching({ kind: 'wantlist', points: [punkt(30, null, 0), punkt(0, 55, 2)] }), NOW),
    ]
    for (const news of alle) {
      expect(Object.keys(news ?? {})).not.toContain('dealer')
      expect(Object.keys(news ?? {})).not.toContain('seller')
    }
  })
})

describe('the trail of measurements', () => {
  /** Opening the app five times measures the same thing five times. */
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

  /** A record is watched over years; nobody reads three hundred points. */
  it('has a ceiling', () => {
    const viele = Array.from({ length: MAX_POINTS + 20 }, (_, i) => punkt(200 - i, 40))
    const nach = addPoint(viele, punkt(0, 41))
    expect(nach).toHaveLength(MAX_POINTS)
    expect(nach.at(-1)?.lowestPrice).toBe(41)
  })

  /** Anything older than the window no longer counts as a comparison point. */
  it('forgets what is older than the window', () => {
    const ancient = { ...punkt(0, 10), at: NOW - WINDOW_MS - TAG }
    const fresh = punkt(0, 40)
    // The ancient point would give 300 % — but it is outside, and the next
    // one in the window is the only other.
    expect(judge(watching({ points: [ancient, fresh], threshold: 25 }), NOW)).toBeNull()
  })
})
