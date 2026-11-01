import { expect, test } from './support/test'

import { DEFAULT_PREFERENCES } from '~~/db/meta'

import { putRows, signIn } from './seed'

/**
 * Settings as an index rather than a stack.
 *
 * Ten cards on one page is a list, not a structure — you scrolled past the
 * hub to reach the delete button. What is worth a browser test is not the
 * layout but the wiring: every entry has to have a page behind it, and every
 * page has to have a way back. Both are the kind of thing that breaks silently
 * when a route is renamed.
 */

const SUBPAGES = [
  ['/settings/account', 'Account'],
  ['/settings/collection', 'Collection'],
  ['/settings/search', 'Search'],
  ['/settings/appearance', 'Appearance'],
  ['/settings/sync', 'Sync devices'],
  ['/settings/hub', 'Hub'],
  ['/settings/data', 'Your data'],
] as const

test.describe('settings', () => {
  for (const [path, title] of SUBPAGES) {
    test(`${path} exists and says so`, async ({ page }) => {
      await page.goto(path)

      // Signed out these pages show the sign-in note rather than their
      // controls, but the heading and the way back are chrome and belong to
      // the page either way.
      await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()

      // "Settings", not "← Settings": the arrow used to be a character in the
      // label and is now an icon, hidden from assistive technology because the
      // word already says where the link goes.
      await expect(page.getByRole('link', { name: 'Settings', exact: true })).toHaveAttribute(
        'href',
        '/settings',
      )
    })
  }

  test('the index is reachable and names itself', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
  })

  /** English numbers on an English screen: 3,000, not 3.000 (#190). */
  test('your data writes its figures in English', async ({ page }) => {
    await signIn(page)
    await page.goto('/settings/data')
    // The header pulse carries the same table; this is the one on the page.
    const main = page.getByRole('main')
    await main.getByText('What takes how long').click()
    await expect(main.getByText('A dig, 3,000 listings')).toBeVisible()
    await expect(main.getByText('1.2 s')).toBeVisible()
    await expect(page.getByText('3.000')).toHaveCount(0)
  })

  /** The price ceiling in the currency you buy in, not always in euros (#194). */
  test('the search summary writes the ceiling in your currency', async ({ page }) => {
    await signIn(page)
    await putRows(page, {
      meta: [
        {
          key: 'preferences',
          value: {
            ...DEFAULT_PREFERENCES,
            shipsToCountry: 'Germany',
            currency: 'GBP',
            maxPrice: 40,
          },
        },
      ],
    })
    await page.goto('/settings')
    await expect(page.getByRole('main').getByText('up to £40.00')).toBeVisible()
  })
})
