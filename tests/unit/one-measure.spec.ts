import { readFileSync, readdirSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * One measure for the whole app.
 *
 * **The occasion was a stack of screenshots, not an idea.** Reported on
 * 2026-09-11: clicking through the five collection tabs makes the page jump
 * sideways at every change. Measured, it was worse than assumed — five tabs,
 * four widths:
 *
 * | Shelf | Map | Wantlist | Watched · Places |
 * |---|---|---|---|
 * | 110rem | 90rem | 80rem | 48rem |
 *
 * And the main bar sat at 48rem, so it lined up with the content below it on
 * no page at all. Six different left edges across thirteen pages.
 *
 * `docs/05` §3a had assigned the widths per *page*, with a sound argument —
 * "data may be wide, text may not". The level was wrong: a width belongs to an
 * *area*. Two views of the same collection must not be a house move.
 *
 * Since then: one container, always — and **one** narrow measure inside it,
 * centred. So two edges instead of six: the container's, shared by the main
 * bar and the wide pages, and the narrow column's.
 *
 * Centred rather than anchored left, because anchoring left does hold the edge
 * but leaves a 48rem column clinging to the left third of an 1800 px screen.
 * The trade was decided on the running picture, not on the principle.
 */

const SEITEN = readdirSync('app/pages', { recursive: true, encoding: 'utf8' })
  .filter((datei) => datei.endsWith('.vue'))
  .map((datei) => ({ datei, quelle: readFileSync(`app/pages/${datei}`, 'utf8') }))

/**
 * The screen that is not a container.
 *
 * In the stack the card *is* the page: full-bleed, one after another, swiped
 * rather than scrolled. A page measure above it would be a frame around
 * something meant to have none. Named rather than detected — a second entry
 * here needs an argument, not a commit.
 */
const OHNE_MASS = ['stack.vue']

describe('every screen shares one measure', () => {
  it('uses fid-page, or says why not', () => {
    const abweichler = SEITEN.filter(({ datei, quelle }) => {
      if (OHNE_MASS.includes(datei)) return false
      /*
       * Pages with no `<main>` of their own inherit a frame — the settings
       * subpages all live in `SettingsPage.vue`. Demanding one here would mean
       * setting the same container eight times over.
       */
      if (!quelle.includes('<main')) return false
      return !/class="[^"]*\bfid-page(-flush)?\b/.test(quelle)
    }).map(({ datei }) => datei)

    expect(abweichler).toEqual([])
  })

  /** And the inherited frame carries it too. */
  it('includes the frame the settings pages sit in', () => {
    expect(readFileSync('app/components/SettingsPage.vue', 'utf8')).toMatch(/\bfid-page\b/)
  })

  /**
   * And no page sets its own measure beside it.
   *
   * A `max-w-…` on the `<main>` next to `fid-page` would be the old world
   * back: the class says "one measure" and the line beside it contradicts it.
   * Inside, a `max-w-…` is exactly right — there the content decides.
   */
  it('does not set a second width on the page itself', () => {
    const doppelt = SEITEN.filter(({ datei, quelle }) => {
      if (OHNE_MASS.includes(datei)) return false
      const auf = quelle.indexOf('<main')
      if (auf === -1) return false
      const tag = quelle.slice(auf, quelle.indexOf('>', auf))
      return /\bmax-w-/.test(tag)
    }).map(({ datei }) => datei)

    expect(doppelt).toEqual([])
  })

  /**
   * The main bar is part of it.
   *
   * It sat at `max-w-3xl` and was therefore offset against the content on
   * every page — the most conspicuous part of the problem and the one least
   * likely to be blamed on any single screen.
   */
  it('includes the navigation bar', () => {
    expect(readFileSync('app/components/AppNav.vue', 'utf8')).toMatch(/\bfid-page\b/)
  })

  /**
   * **And narrow content has *one* narrow measure.**
   *
   * That was the second half of the finding and the more quietly hidden one.
   * Among the narrow pages there were four widths too — 48rem for basket,
   * places and the legal pages, 42rem for the setup, 36rem for "what's new"
   * and for in-store mode. Centred means: the width determines the left edge.
   * Four widths are four edges, only noticed more slowly.
   *
   * Centred **and** uniform is the resolution: the outer container keeps the
   * bar in line, and inside, every narrow page stands in the same place as
   * every other narrow page.
   *
   * Checked on the block directly after `<main>` — that is the wrapper this
   * rule means. A `max-w-…` further in belongs to a card or a paragraph and is
   * exactly right there.
   */
  it('gives narrow content one measure, centred', () => {
    /*
     * Checked against the classes themselves, not against their order.
     *
     * The first attempt compared a prefix — and broke as soon as `@container`
     * moved in front of it, although nothing about the rule was wrong. A test
     * that nails down the spelling rather than the statement reports
     * rearrangements as faults.
     */

    const abweichend: string[] = []
    for (const { datei, quelle } of [
      ...SEITEN.map((s) => ({ ...s })),
      {
        datei: 'components/SettingsPage.vue',
        quelle: readFileSync('app/components/SettingsPage.vue', 'utf8'),
      },
    ]) {
      if (OHNE_MASS.includes(datei)) continue

      const auf = quelle.indexOf('<main')
      if (auf === -1) continue
      const nachTag = quelle.indexOf('>', auf) + 1

      // The first block after it — only where it carries a measure at all.
      const ersterDiv = quelle.slice(nachTag).match(/<div class="([^"]*)"/)
      if (!ersterDiv) continue
      const klassen = ersterDiv[1]!
      const teile = klassen.split(/\s+/)
      const masse = teile.filter((t) => t.startsWith('max-w-'))
      if (masse.length === 0) continue

      const stimmt = masse.length === 1 && masse[0] === 'max-w-3xl' && teile.includes('mx-auto')
      if (!stimmt) abweichend.push(`${datei}: ${klassen.slice(0, 60)}`)
    }

    expect(abweichend).toEqual([])
  })

  /**
   * **And `@container` sits on the box whose width the content has.**
   *
   * Container queries measure exactly the element carrying `@container`. After
   * the rebuild that was, on the narrow pages, the 110rem container, while the
   * content sits in a 48rem column — a variant inside it would have measured
   * against the wrong box.
   *
   * **Nothing was broken by it**, and that is worked out rather than hoped:
   * raising the cap only changes thresholds *between* the old and new cap, and
   * the narrow columns have none above 768 px. It was a trap for the next
   * variant, not a fault in the current one — and the kind of trap nobody
   * traces back to this rebuild when it finally springs.
   */
  it('puts @container on the box the content actually fills', () => {
    const falsch: string[] = []
    for (const { datei, quelle } of [
      ...SEITEN,
      {
        datei: 'components/SettingsPage.vue',
        quelle: readFileSync('app/components/SettingsPage.vue', 'utf8'),
      },
    ]) {
      const auf = quelle.indexOf('<main')
      if (auf === -1) continue
      const tag = quelle.slice(auf, quelle.indexOf('>', auf))
      if (!tag.includes('@container')) continue

      // An `@container` on the `<main>` is only right where the content fills
      // it — that is, where there is no narrow column below it.
      const nachTag = quelle.indexOf('>', auf) + 1
      const ersterDiv = quelle.slice(nachTag).match(/<div class="([^"]*)"/)
      if (ersterDiv && /\bmax-w-3xl\b/.test(ersterDiv[1]!)) falsch.push(datei)
    }

    expect(falsch).toEqual([])
  })
})
