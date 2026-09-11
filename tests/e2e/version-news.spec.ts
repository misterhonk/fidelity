import { expect, test } from '@playwright/test'

import { signIn } from './seed'

/**
 * "The app is newer than last time" (2026-09-11).
 *
 * Since 760a11e there is a page saying what is new in this release — reachable
 * only through the version number in the footer, though, so only to somebody
 * who knows that number is a link.
 *
 * Checked in a browser, because the whole thing consists of three things that
 * only exist there: `localStorage`, a reload, and the question of what happens
 * on the *first* visit. The last is the one you overlook in the source.
 */

const KEY = 'fidelity:seen-version'

test.describe('a version somebody has not seen', () => {
  /**
   * On the very first start the line is **not** there.
   *
   * Somebody opening the app for the first time has updated from nothing. "Now
   * on 0.27.1" would simply be untrue there — and the first line somebody
   * reads from an app should not be a false one.
   */
  test('says nothing on a first visit', async ({ page }) => {
    await signIn(page)
    await page.goto('/')
    await expect(page.locator('main')).toBeVisible()

    await expect(page.getByText(/updated to|jetzt auf/i)).toBeHidden()

    // It has remembered all the same, or the line would come next time.
    const remembered = await page.evaluate((k) => localStorage.getItem(k), KEY)
    expect(remembered).toBeTruthy()
  })

  test('says so when the version moved', async ({ page }) => {
    await signIn(page)
    await page.evaluate((k) => localStorage.setItem(k, '0.0.1-alt'), KEY)
    await page.goto('/')

    const line = page.getByText(/updated to|jetzt auf/i)
    await expect(line).toBeVisible()

    await page.getByRole('link', { name: /what changed|geändert/i }).click()
    await expect(page.locator('h1')).toContainText(/what is new|was neu ist/i)
  })

  /** And once read is read — after a reload too. */
  test('does not come back for the same version', async ({ page }) => {
    await signIn(page)
    await page.evaluate((k) => localStorage.setItem(k, '0.0.1-alt'), KEY)
    await page.goto('/')

    await page.getByRole('button', { name: /not now|später/i }).click()
    await expect(page.getByText(/updated to|jetzt auf/i)).toBeHidden()

    await page.reload()
    await expect(page.locator('main')).toBeVisible()
    await expect(page.getByText(/updated to|jetzt auf/i)).toBeHidden()
  })
})
