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

/** Five pages and an advanced one (#229), where there were nine. */
const SUBPAGES = [
  ['/settings/account', 'Account & data'],
  ['/settings/collection', 'Collection'],
  ['/settings/finds', 'Finds & shops'],
  ['/settings/look', 'Look & sound'],
  ['/settings/help', 'Help'],
  ['/settings/advanced', 'Advanced'],
] as const

/** Every setting that had a page or a card before #229, and where it lives now. */
const SECTIONS = [
  ['/settings/account', 'sync'],
  ['/settings/account', 'data'],
  ['/settings/collection', 'library'],
  ['/settings/collection', 'horizon'],
  ['/settings/collection', 'credits'],
  ['/settings/collection', 'radar'],
  ['/settings/finds', 'filter'],
  ['/settings/finds', 'dealers'],
  ['/settings/look', 'listen'],
  ['/settings/advanced', 'hub'],
  ['/settings/advanced', 'catalogue'],
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

  test('the index links every page and nothing else', async ({ page }) => {
    await signIn(page)
    await page.goto('/settings')
    const links = page.getByRole('main').getByRole('navigation').getByRole('link')
    await expect(links).toHaveCount(SUBPAGES.length)
    for (const [path] of SUBPAGES) {
      await expect(page.getByRole('main').locator(`a[href="${path}"]`)).toBeVisible()
    }
  })

  test('every setting is reachable on its page', async ({ page }) => {
    await signIn(page)
    for (const [path, anchor] of SECTIONS) {
      await page.goto(`${path}#${anchor}`)
      // .first(): LibrarySync puts a second #library inside its own card.
      await expect(page.locator(`#${anchor}`).first()).toBeVisible()
    }
  })

  /** English numbers on an English screen: 3,000, not 3.000 (#190). */
  test('your data writes its figures in English', async ({ page }) => {
    await signIn(page)
    await page.goto('/settings/account')
    // The header pulse carries the same table; this is the one on the page.
    const main = page.getByRole('main')
    await main.getByText('What takes how long').click()
    await expect(main.getByText('A dig, 3,000 listings')).toBeVisible()
    await expect(main.getByText('1.2 s')).toBeVisible()
    await expect(page.getByText('3.000')).toHaveCount(0)
  })

  /** How full the disk is, beside what fills it (#211). */
  test('your data shows the storage estimate', async ({ page, browserName }) => {
    await signIn(page)
    await page.goto('/settings/account')
    const figures = /^Storage: [\d,.]+ (KB|MB|GB) of [\d,.]+ (KB|MB|GB) in use$/
    if (browserName === 'chromium') {
      await expect(page.getByTestId('storage-estimate')).toHaveText(figures)
      // The same data figure settings/account shows, so the two pages do not disagree.
      await expect(page.getByTestId('storage-hint')).toHaveText(
        /^[\d,.]+ (KB|MB) of it is your data\./,
      )
    } else {
      // WebKit gives the worker an estimate on macOS, none on CI's Linux: either way a line.
      await expect(page.getByTestId('storage-estimate')).toHaveText(
        new RegExp(`${figures.source}|^Storage: this browser does not say how much is in use$`),
      )
      // usageDetails is Chrome's alone, so there is no data figure to set beside it.
      await expect(page.getByTestId('storage-hint')).toHaveCount(0)
    }
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
