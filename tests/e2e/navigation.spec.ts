import { expect, test } from './support/test'

import { signIn } from './seed'

/**
 * Today · Shops · Collection · Basket · Search (#228).
 *
 * The shop is the unit, the collection the other one, and the settings sit
 * behind the profile rather than in a tab of their own.
 */

const PHONE = { width: 390, height: 844 }
const WIDE = { width: 1280, height: 800 }

test('a phone bar holds the five, and Search opens the palette', async ({ page }) => {
  await signIn(page)
  await page.setViewportSize(PHONE)
  await page.goto('/')

  const nav = page.getByRole('navigation', { name: 'Main sections' })
  for (const name of ['Today', 'Shops', 'Collection', 'Basket']) {
    await expect(nav.getByRole('link', { name, exact: true })).toBeVisible()
  }
  // Not in the phone bar: the profile is on Today instead.
  await expect(nav.getByRole('link', { name: 'Profile', exact: true })).toBeHidden()

  await nav.getByRole('button', { name: 'Search' }).click()
  await expect(page.getByRole('dialog', { name: 'Commands and search' })).toBeVisible()
})

test('on a phone, the name on Today is the way into the settings', async ({ page }) => {
  await signIn(page)
  await page.setViewportSize(PHONE)
  await page.goto('/')

  await page.getByRole('link', { name: /^Profile: / }).click()
  await expect(page).toHaveURL(/\/settings$/)
})

test('on a desktop, the profile at the end of the bar leads to the settings', async ({
  page,
}) => {
  await signIn(page)
  await page.setViewportSize(WIDE)
  await page.goto('/')

  const nav = page.getByRole('navigation', { name: 'Main sections' })
  await nav.getByRole('link', { name: 'Profile', exact: true }).click()
  await expect(page).toHaveURL(/\/settings$/)
  await expect(nav.getByRole('link', { name: 'Profile', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
})

test('a shop page lights Shops; the collection’s views light Collection', async ({ page }) => {
  await signIn(page)
  await page.setViewportSize(WIDE)
  const nav = page.getByRole('navigation', { name: 'Main sections' })

  await page.goto('/shop')
  await expect(nav.getByRole('link', { name: 'Shops', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )

  for (const path of ['/collection', '/wantlist', '/places', '/insights/year', '/watched']) {
    await page.goto(path)
    await expect(
      nav.getByRole('link', { name: 'Collection', exact: true }),
      `${path} belongs to Collection`,
    ).toHaveAttribute('aria-current', 'page')
  }
})

test('insights hold the map and the year; watched is a filter', async ({ page }) => {
  await signIn(page)
  await page.setViewportSize(WIDE)
  await page.goto('/insights')

  const tabs = page.getByRole('navigation', { name: 'Collection' })
  await expect(tabs.getByRole('link', { name: 'Insights' })).toHaveAttribute(
    'aria-current',
    'page',
  )

  const views = page.getByRole('navigation', { name: 'Insights' })
  await views.getByRole('link', { name: 'Year' }).click()
  await expect(page).toHaveURL(/\/insights\/year$/)
  await expect(tabs.getByRole('link', { name: 'Insights' })).toHaveAttribute(
    'aria-current',
    'page',
  )

  await tabs.getByRole('link', { name: 'On watch' }).click()
  await expect(page).toHaveURL(/\/watched$/)
  await expect(tabs.getByRole('link', { name: 'On watch' })).toHaveAttribute(
    'aria-current',
    'page',
  )
})
