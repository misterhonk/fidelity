import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * The M0 smoke test: a fresh clone builds to static files, those files boot in
 * a browser, and what comes up is accessible. Nothing is mocked, and nothing
 * server-side is involved — there is no server.
 */
test.describe('smoke', () => {
  test('the entry screen renders with the design tokens applied', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveTitle('Championship · Fidelity')
    await expect(page.getByRole('heading', { level: 1, name: 'Fidelity' })).toBeVisible()

    // Ten signal chips — S1 and S2 share a colour, so eleven signals need ten.
    await expect(page.getByRole('list', { name: 'Die Match-Signale' })).toBeVisible()
    await expect(page.getByRole('listitem')).toHaveCount(10)

    // A token that only resolves if tokens.css reached the @theme block.
    const signalColour = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--color-fid-sig-credit')
        .trim(),
    )
    expect(signalColour).not.toBe('')
  })

  test('the worker answers and can read IndexedDB', async ({ page }) => {
    await page.goto('/')

    // Round-trip main → worker → IndexedDB → back. Nothing stubbed: this is
    // the actual module worker running against the browser's own storage.
    await expect(page.getByTestId('wiring-status')).toContainText('Worker bereit')
    await expect(page.getByTestId('wiring-status')).toContainText('IndexedDB: 0 Einträge')
  })

  test('the entry screen has no axe violations', async ({ page }) => {
    await page.goto('/')

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()

    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })
})
