import { expect, test } from '@playwright/test'

import { seed } from './seed'

/**
 * Der Stapel im Browser.
 *
 * Ein Wisch hat keine testbare Form. Er hat eine Geste, eine Schwelle und
 * eine Richtung, und die kennt nur eine Maschine mit einem Zeigegerät — im
 * Quelltext steht eine Transformation, auf dem Schirm bewegt sich eine Karte.
 * `tests/unit/stack.spec.ts` hält die Entscheidungen, das hier die Bewegung.
 */
test.describe('the stack', () => {
  test('shows one find and moves on', async ({ page }) => {
    await seed(page)
    await page.goto('/stack')

    // Der Laden aus dem Seed steht in der oberen Reihe.
    const row = page.getByRole('button', { name: /plattenkiste/i })
    await expect(row.first()).toBeVisible({ timeout: 15_000 })

    const position = page.getByText(/\d+ of \d+ at /)
    await expect(position).toBeVisible()
    const first = await position.textContent()

    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(position).not.toHaveText(first ?? '')
  })

  /**
   * Und zurück, sichtbar.
   *
   * Tinder kann sich ein verlorenes Nein leisten, eine seltene Platte nicht.
   */
  test('takes a swipe back', async ({ page }) => {
    await seed(page)
    await page.goto('/stack')

    const position = page.getByText(/\d+ of \d+ at /)
    await expect(position).toBeVisible({ timeout: 15_000 })
    const start = await position.textContent()

    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(position).not.toHaveText(start ?? '')

    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(position).toHaveText(start ?? '')
  })

  /**
   * Die Geste selbst, mit der Schwelle.
   *
   * Achtzig Pixel trennen einen Wisch von einem Zittern beim Tippen. Ein
   * Stapel, der bei jeder Berührung weiterspringt, ist unbenutzbar — und das
   * fällt in keinem Unit-Test auf, weil dort niemand zittert.
   */
  test('ignores a nudge and follows a swipe', async ({ page }) => {
    await seed(page)
    await page.goto('/stack')

    const position = page.getByText(/\d+ of \d+ at /)
    await expect(position).toBeVisible({ timeout: 15_000 })
    const start = await position.textContent()

    const card = page.locator('[style*="translateX"]')
    const box = (await card.boundingBox())!
    const y = box.y + box.height / 2
    const x = box.x + box.width / 2

    // Zu kurz: nichts passiert.
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x - 30, y, { steps: 5 })
    await page.mouse.up()
    await expect(position).toHaveText(start ?? '')

    // Weit genug: eine Karte weiter.
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x - 160, y, { steps: 10 })
    await page.mouse.up()
    await expect(position).not.toHaveText(start ?? '')
  })
})
