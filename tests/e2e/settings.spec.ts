import { expect, test } from '@playwright/test'

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
})
