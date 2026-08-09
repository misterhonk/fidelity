import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * The smoke test: a fresh clone builds to static files, those files boot in a
 * browser, the worker comes up, and what the user sees is accessible.
 *
 * Discogs is never called here. The one real call against the live API is a
 * manual check, not a per-PR job — running it on every merge would spend the
 * rate limit on CI instead of on digs.
 */
test.describe('smoke', () => {
  test('a signed-out visitor lands on the token form', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveTitle('Championship · Fidelity')
    await expect(page.getByRole('heading', { level: 1, name: 'Fidelity' })).toBeVisible()

    // Rendered only after the worker answered auth.identity — so this also
    // proves main thread, worker and IndexedDB are wired together.
    await expect(page.getByRole('heading', { name: 'Token eintragen' })).toBeVisible()
    await expect(page.getByLabel('Personal Access Token')).toHaveAttribute('type', 'password')

    // Sending is blocked until something has been entered.
    await expect(page.getByRole('button', { name: 'Anmelden' })).toBeDisabled()
  })

  test('the design tokens reach the browser', async ({ page }) => {
    await page.goto('/')

    const [signal, accent] = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement)
      return [
        style.getPropertyValue('--color-fid-sig-credit').trim(),
        style.getPropertyValue('--color-fid-accent').trim(),
      ]
    })

    expect(signal).not.toBe('')
    expect(accent).not.toBe('')
  })

  test('the map says what to do instead of showing empty bars', async ({ page }) => {
    await page.goto('/landkarte')

    await expect(page.getByRole('heading', { level: 1, name: 'Deine Landkarte' })).toBeVisible()
    await expect(page.getByText('Noch kein Profil')).toBeVisible()

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })

  test('the dig screen asks for a dealer and stays accessible', async ({ page }) => {
    await page.goto('/dig')

    await expect(page.getByRole('heading', { level: 1, name: 'Neuer Dig' })).toBeVisible()
    await expect(page.getByLabel('Händlername')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Prüfen' })).toBeDisabled()

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })

  test('the entry screen has no axe violations', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Token eintragen' })).toBeVisible()

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()

    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })
})
