import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * Ohne Token gehört niemand auf einen Bildschirm voller Daten.
 *
 * Die Umleitung stand bis zum 2026-08-14 allein im `onMounted` der Startseite
 * und galt damit für genau einen von zwölf Bildschirmen. Wer `/shelf` per
 * Lesezeichen aufrief, sah „No records here yet. Fetch the collection in the
 * settings." — eine Aussage über die Sammlung, wo eine über den Zustand der App
 * hingehört.
 *
 * Gelesen wird die Form: eine Middleware verlangt einen Router und einen
 * Worker, und was hier schiefgehen kann, ist keine Rechnung, sondern eine
 * Liste. `tests/e2e/setup-guard.spec.ts` fährt den Weg im Browser ab.
 */
const GUARD = readFileSync('app/middleware/setup.global.ts', 'utf8')

/** Ohne Kommentare, weil diese Datei erklärt, was sie prüft. */
const code = GUARD.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

describe('the setup guard', () => {
  it('is global, so nobody has to remember it', () => {
    // Der Dateiname ist die Zusage: `.global.ts` läuft auf jeder Route.
    expect(GUARD).toMatch(/defineNuxtRouteMiddleware/)
  })

  /**
   * Die wichtigste Ausnahme, und keine Nachlässigkeit.
   *
   * In den Einstellungen wird der Token eingetragen. Wer diesen Zweig
   * aussperrt, sperrt den Weg hinein aus — und zwar für genau die Leute, die
   * ihn brauchen. Ein Guard, der sich selbst zusperrt, ist die teuerste Art
   * von Sicherheit.
   */
  it('always leaves the way in open', () => {
    for (const path of ['/welcome', '/settings', '/privacy', '/legal']) {
      expect(code).toContain(`'${path}'`)
    }
  })

  /** Und die Unterseiten der Ausnahmen zählen mit — /settings/hub ist eine. */
  it('lets the children of an open path through too', () => {
    expect(code).toMatch(/to\.path\.startsWith\(`\$\{path\}\/`\)/)
  })

  /**
   * Erst fragen, dann urteilen.
   *
   * `identity` ist beim ersten Aufruf leer, weil die Antwort aus dem Worker
   * kommt. Wer nicht auf `ready` wartet, leitet jeden beim ersten Laden um —
   * auch den, der längst eingerichtet ist.
   */
  it('waits for the answer instead of assuming it', () => {
    expect(code).toMatch(/if \(!ready\.value\) await load\(\)/)
  })

  /** Beim Erzeugen der statischen Seiten gibt es weder IndexedDB noch Worker. */
  it('does nothing while there is no browser', () => {
    expect(code).toMatch(/import\.meta\.server/)
  })

  /**
   * Woher jemand kam, überlebt den Umweg — aber nur als Pfad.
   *
   * `next=https://…` in einem geteilten Link wäre eine offene Weiterleitung.
   * Das zu verhindern kostet eine Zeile, und sie steht dort, wo der Wert
   * gelesen wird.
   */
  it('carries the way back, and only as a path', () => {
    expect(code).toMatch(/next: to\.fullPath/)

    const welcome = readFileSync('app/pages/welcome.vue', 'utf8')
    expect(welcome).toMatch(/next\.startsWith\('\/'\) && !next\.startsWith\('\/\/'\)/)
    expect(welcome).toMatch(/:to="backTo"/)
  })
})

/**
 * Und die alte Umleitung ist weg, nicht bloß überstimmt.
 *
 * Zwei Stellen, die dasselbe entscheiden, sind eine Stelle zu viel: die eine
 * wird gepflegt, die andere nicht, und welche welche ist, merkt man erst, wenn
 * sie sich widersprechen.
 */
describe('the start screen', () => {
  const INDEX = readFileSync('app/pages/index.vue', 'utf8')

  it('no longer redirects on its own', () => {
    expect(INDEX).not.toMatch(/navigateTo\('\/welcome'\)/)
  })
})
