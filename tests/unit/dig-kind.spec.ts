import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { digKind } from '~/utils/dig-kind'

/**
 * What a dig is entitled to say anything about.
 *
 * Found by looking at a real result screen: an incremental visit to a shop
 * holding 35.900 records reported
 *
 *     0 of 0 scanned (100 %)
 *     Nothing here for you at this dealer. That is a result, not a fault.
 *
 * Both numbers are what the record actually holds — an incremental dig's
 * denominator is what it found, and `coverage` is 1 by construction because it
 * stops exactly where the known stock begins. Rendered with the sentences a
 * full dig uses, they became a coverage claim and a verdict about a shop the
 * visit never looked at.
 *
 * The worker was already careful here (it refuses to write an incremental
 * dig's hit rate or fingerprint onto the dealer, tests/unit/dig-since.spec.ts).
 * Only the screen was not.
 */
const dig = (depth: 'normal' | 'deep' | 'neu' | undefined, listingsTotal: number) => ({
  depth,
  listingsTotal,
})

describe('what a dig is entitled to claim', () => {
  it('lets a full dig speak about the shop', () => {
    expect(digKind(dig('normal', 2881))).toBe('full')
    expect(digKind(dig('deep', 35900))).toBe('full')
  })

  it('treats a dig from before the depth field as full', () => {
    // 'normal' is what absent means (shared/types.ts), and reading it as
    // incremental would silently relabel every dig run before M-whatever.
    expect(digKind(dig(undefined, 2881))).toBe('full')
  })

  it('separates an incremental visit that found something', () => {
    expect(digKind(dig('neu', 4))).toBe('incremental')
  })

  it('separates the one that found nothing', () => {
    // The case that produced the wrong sentence. It is not "nothing here for
    // you" — it is "nothing new since you last looked", and the difference is
    // 35.900 records nobody re-read.
    expect(digKind(dig('neu', 0))).toBe('incremental-empty')
  })

  it('never calls an incremental visit full, whatever it found', () => {
    for (const found of [0, 1, 50, 20_000]) {
      expect(digKind(dig('neu', found))).not.toBe('full')
    }
  })
})

/**
 * Kein Freispruch ohne Grundlage.
 *
 * „Nothing here for you at this dealer. That is a result, not a fault." ist ein
 * Urteil über den Laden. Ohne Horizont kann die App es nicht fällen: sie kennt
 * dann nur die exakten Release-IDs der eigenen Platten — kein anderes Pressing,
 * kein selber Künstler, kein selbes Label.
 *
 * Am 2026-08-13 stand genau dieser Satz nach 2.863 durchgesehenen Platten da,
 * während der Horizont aus einem einzigen Eintrag mit neun IDs bestand. Er hat
 * die Fehlersuche stundenlang auf den Scan gelenkt, der völlig in Ordnung war.
 *
 * Geprüft wird die Form: die Bedingung ist eine Entscheidung, und sie ist im
 * Quelltext sichtbar. Ein Browser wird dafür nicht gebraucht.
 */
describe('the verdict a dig is allowed to give', () => {
  const DIG = readFileSync('app/pages/dig.vue', 'utf8')

  /**
   * Ohne Kommentare, weil diese Datei die Entscheidung erklärt, die sie prüft.
   *
   * Der Quelltext schreibt „Nicht `builtAt === null`" als Begründung hin — und
   * eine Prüfung, die auf das Fehlen dieser Zeichenfolge besteht, fällt sonst
   * über die eigene Erklärung. Dieselbe Falle steht in `template-text.spec.ts`.
   */
  const code = DIG.replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\/.*$/gm, '')

  it('asks about the horizon before absolving the shop', () => {
    expect(DIG).toMatch(/await call\('horizon\.status', undefined\)/)
    expect(DIG).toMatch(/result\.matches\.length === 0 && noHorizon/)
  })

  /**
   * Und zwar an `expanded`, nicht an `builtAt`.
   *
   * Ein Horizont, dessen Blöcke abgelaufen sind, ist genauso wenig eine
   * Grundlage — sähe mit einem Datum von damals aber aus wie eine.
   */
  it('measures what is expanded, not when something was once built', () => {
    expect(code).toMatch(/horizon\.value\.entities > 0 && horizon\.value\.expanded === 0/)
    expect(code).not.toMatch(/builtAt === null/)
  })

  /** Der alte Satz bleibt — für den Fall, in dem er stimmt. */
  it('keeps the plain answer for a dig that really found nothing', () => {
    expect(DIG).toMatch(/v-else-if="result\.matches\.length === 0"/)
  })

  /** Und sagt, wo es sich beheben lässt. Ein Befund ohne Ausweg ist eine Klage. */
  it('points at the place that fixes it', () => {
    expect(DIG).toMatch(/to="\/settings\/collection"/)
  })
})
