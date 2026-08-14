import { expect, test } from '@playwright/test'

import { signIn } from './seed'

/**
 * Ohne Token führt jeder Weg zur Einrichtung.
 *
 * Die Umleitung lag bis zum 2026-08-14 im `onMounted` der Startseite und galt
 * für genau einen von zwölf Bildschirmen. Wer `/shelf` per Lesezeichen aufrief,
 * bekam eine fertige Seite mit „No records here yet. Fetch the collection in
 * the settings." — eine Aussage über die Sammlung, wo eine über den Zustand der
 * App hingehört.
 *
 * Der Unit-Test daneben liest die Form. Nur ein Browser weiß, ob die Middleware
 * auch wirklich greift: sie fragt den Worker, und zwischen „noch nicht
 * geantwortet" und „nicht angemeldet" liegt genau der Fehler, mit dem so ein
 * Guard jeden aussperrt, der längst eingerichtet ist.
 *
 * Kein Seeding: die leere Datenbank *ist* der Prüffall.
 */
const GESPERRT = ['/shelf', '/wantlist', '/dig', '/dealers', '/basket', '/saved', '/map']

/** Wohin man auch ohne Token darf — die Einstellungen vor allem, denn dort
 *  wird der Token eingetragen. */
const OFFEN = ['/welcome', '/settings', '/settings/hub', '/privacy', '/legal']

test.describe('without a token', () => {
  for (const path of GESPERRT) {
    test(`${path} leads to the setup`, async ({ page }) => {
      await page.goto(path)
      await page.waitForURL(/\/welcome/, { timeout: 20_000 })

      /*
       * Und merkt sich, wohin jemand wollte. Ohne das endet die Einrichtung
       * immer auf der Startseite, und wer seinen Korb sehen wollte, sucht ihn
       * danach von Hand.
       */
      expect(new URL(page.url()).searchParams.get('next')).toBe(path)
    })
  }

  for (const path of OFFEN) {
    test(`${path} stays reachable`, async ({ page }) => {
      await page.goto(path)
      // Kurz warten: eine Umleitung, die erst nach dem ersten Frame kommt,
      // wäre sonst nicht zu sehen.
      await page.waitForTimeout(1500)
      expect(new URL(page.url()).pathname).toContain(path)
    })
  }

  /**
   * Die Startseite selbst hängt kein `next` an.
   *
   * `?next=/` wäre eine Rückkehr dorthin, wo der Knopf ohnehin hinführt — und
   * eine Adresse, die aussieht, als hätte man etwas verpasst.
   */
  test('the start screen goes there without a detour note', async ({ page }) => {
    await page.goto('/')
    await page.waitForURL(/\/welcome/, { timeout: 20_000 })
    expect(new URL(page.url()).searchParams.get('next')).toBeNull()
  })
})

/**
 * Und wer eingerichtet ist, bleibt, wo er hinwollte.
 *
 * Der teuerste Fehler in so einem Guard ist nicht die vergessene Sperre — es
 * ist die Sperre, die zu früh urteilt. `identity` ist beim ersten Aufruf leer,
 * weil die Antwort aus dem Worker kommt; wer nicht auf sie wartet, schickt
 * jeden zur Einrichtung, auch den mit Sammlung im Regal.
 *
 * Am 2026-08-14 hat eine Mutationsprobe genau das gezeigt: `await load()` durch
 * `void load()` ersetzt, und alle dreizehn Fälle blieben grün — weil keiner
 * von ihnen angemeldet war.
 */
test.describe('with a token', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page)
  })

  for (const path of ['/shelf', '/dealers']) {
    test(`${path} stays put`, async ({ page }) => {
      await page.goto(path)
      await page.waitForTimeout(1500)

      expect(new URL(page.url()).pathname).toBe(path)
    })
  }
})
