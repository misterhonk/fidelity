import { expect, test } from '@playwright/test'

import { signIn } from './seed'

/**
 * „Die App ist neuer als beim letzten Mal" (2026-09-11).
 *
 * Seit 760a11e gibt es eine Seite, die sagt, was in dieser Ausgabe neu ist —
 * erreichbar aber nur über die Versionsnummer im Footer, also für jemanden,
 * der weiß, dass diese Zahl ein Link ist.
 *
 * Geprüft wird im Browser, weil das Ganze aus drei Dingen besteht, die es nur
 * dort gibt: `localStorage`, ein Neuladen, und die Frage, was beim *ersten*
 * Besuch passiert. Die letzte ist die, die man im Quelltext übersieht.
 */

const SCHLUESSEL = 'fidelity:seen-version'

test.describe('a version somebody has not seen', () => {
  /**
   * Beim allerersten Start steht die Zeile **nicht** da.
   *
   * Wer die App zum ersten Mal öffnet, hat auf nichts aktualisiert. „Jetzt
   * auf 0.27.1" wäre dort schlicht unwahr — und die erste Zeile, die jemand
   * von einer App liest, sollte keine falsche sein.
   */
  test('says nothing on a first visit', async ({ page }) => {
    await signIn(page)
    await page.goto('/')
    await expect(page.locator('main')).toBeVisible()

    await expect(page.getByText(/updated to|jetzt auf/i)).toBeHidden()

    // Gemerkt hat es sich trotzdem, sonst käme die Zeile beim nächsten Mal.
    const gemerkt = await page.evaluate((k) => localStorage.getItem(k), SCHLUESSEL)
    expect(gemerkt).toBeTruthy()
  })

  test('says so when the version moved', async ({ page }) => {
    await signIn(page)
    await page.evaluate((k) => localStorage.setItem(k, '0.0.1-alt'), SCHLUESSEL)
    await page.goto('/')

    const zeile = page.getByText(/updated to|jetzt auf/i)
    await expect(zeile).toBeVisible()

    await page.getByRole('link', { name: /what changed|geändert/i }).click()
    await expect(page.locator('h1')).toContainText(/what is new|was neu ist/i)
  })

  /** Und einmal gelesen ist gelesen — auch nach einem Neuladen. */
  test('does not come back for the same version', async ({ page }) => {
    await signIn(page)
    await page.evaluate((k) => localStorage.setItem(k, '0.0.1-alt'), SCHLUESSEL)
    await page.goto('/')

    await page.getByRole('button', { name: /not now|später/i }).click()
    await expect(page.getByText(/updated to|jetzt auf/i)).toBeHidden()

    await page.reload()
    await expect(page.locator('main')).toBeVisible()
    await expect(page.getByText(/updated to|jetzt auf/i)).toBeHidden()
  })
})
