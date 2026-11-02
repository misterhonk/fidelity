import { expect, test } from './support/test'

import { signIn } from './seed'

/**
 * An iPhone has no extension and no share target (#217): the way a shop gets
 * from Safari into the app is a copied address. So the start screen takes one
 * and opens the shop it names — checked, never started.
 */
test('a pasted Discogs link on Start opens that shop', async ({ page }) => {
  await signIn(page)
  await page.goto('/')

  const field = page.getByRole('textbox', { name: 'Paste a Discogs link' })
  await field.fill('https://www.discogs.com/seller/fatplastics/profile')
  await field.press('Enter')

  await expect(page).toHaveURL(/\/shop\?dealer=fatplastics$/)
  await expect(page.locator('main input').first()).toHaveValue('fatplastics')
})
