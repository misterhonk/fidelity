import { expect, test } from '@playwright/test'

import { seed } from './seed'

/**
 * The page a link from outside lands on (M25, `docs/15`).
 *
 * Two things only a browser can say: that a stranger without a token gets the
 * page and not the setup — it is the one address somebody who does *not* have
 * the app is sent to — and that a member finds it in the footer, in their own
 * language.
 */
test.describe('what this is, beside the others', () => {
  test('opens for a stranger, in English, with the sentence first', async ({ page }) => {
    await page.goto('/compared')

    await expect(page).toHaveURL(/\/compared$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Fidelity, compared')
    await expect(page.getByText(/reads a shop’s stock against your collection/)).toBeVisible()
    // Every app in the list has both halves: what it does, and Fidelity instead.
    await expect(page.getByRole('heading', { level: 3 })).toHaveCount(7)
    await expect(page.getByText('Fidelity instead')).toHaveCount(7)
  })

  test('is in the footer, and speaks German when the app does', async ({ page }) => {
    await seed(page, 'de')
    await page.goto('/')
    await page.getByRole('contentinfo').getByRole('link', { name: 'Im Vergleich' }).click()

    await expect(page).toHaveURL(/\/compared$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Fidelity im Vergleich')
    await expect(page.getByText('Fidelity stattdessen')).toHaveCount(7)
  })
})
