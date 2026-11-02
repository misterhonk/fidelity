import { expect, test } from './support/test'

import { signIn } from './seed'

/**
 * An iPhone has no extension and no share target (#217): the way a shop gets
 * from Safari into the app is a copied address. The nav's Search (#228) is the
 * one field for searching and for that (#314); a shop's address pasted into it offers
 * the shop on top, and Enter opens it — checked, never started.
 */
test('a pasted Discogs link in the one field opens that shop', async ({ page }) => {
  await signIn(page)
  await page.goto('/')

  await page
    .getByRole('navigation', { name: 'Main sections' })
    .getByRole('button', { name: 'Search' })
    .click()
  const field = page.getByRole('dialog', { name: 'Commands and search' }).getByRole('combobox')
  await field.fill('https://www.discogs.com/seller/fatplastics/profile')
  await expect(page.getByRole('option', { name: 'Dig at fatplastics' })).toBeVisible()
  await field.press('Enter')

  await expect(page).toHaveURL(/\/shop\?dealer=fatplastics$/)
  await expect(page.getByRole('dialog', { name: 'Commands and search' })).toBeHidden()
  await expect(page.locator('main input').first()).toHaveValue('fatplastics')
})

test('an address typed by hand does not leave on its first letters', async ({ page }) => {
  await signIn(page)
  await page.goto('/')

  await page
    .getByRole('navigation', { name: 'Main sections' })
    .getByRole('button', { name: 'Search' })
    .click()
  const palette = page.getByRole('dialog', { name: 'Commands and search' })
  const field = palette.getByRole('combobox')
  await field.pressSequentially('discogs.com/seller/fatplastics')

  // 'discogs.com/seller/f' was a whole address on the way; it was only offered.
  await expect(palette.getByRole('option', { name: 'Dig at fatplastics' })).toBeVisible()
  await expect(page).toHaveURL(/\/$/)

  await field.press('Enter')
  await expect(page).toHaveURL(/\/shop\?dealer=fatplastics$/)
})

test('a bare word in the field is a search, not a shop', async ({ page }) => {
  await signIn(page)
  await page.goto('/')

  await page
    .getByRole('navigation', { name: 'Main sections' })
    .getByRole('button', { name: 'Search' })
    .click()
  const palette = page.getByRole('dialog', { name: 'Commands and search' })
  await palette.getByRole('combobox').fill('fatplastics')

  // The search has answered, and the palette is still where it was.
  await expect(palette.getByText(/nothing found/i)).toBeVisible()
  await expect(page).toHaveURL(/\/$/)
})
