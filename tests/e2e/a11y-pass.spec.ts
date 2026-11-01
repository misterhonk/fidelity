import AxeBuilder from '@axe-core/playwright'

import { expect, test, type Page } from './support/test'

import { seed } from './seed'

/**
 * The accessibility pass (#227): a skip link, Back closes every sheet, and the
 * page behind a sheet is out of reach — not just covered.
 *
 * The find's sheet has closed on Back since M31.23 (`find-in-url.spec.ts`).
 * The shelf's, the wantlist's and the compartment's did not: on a phone the
 * swipe back left the screen and took the list and its scroll position along.
 */

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

async function axe(page: Page) {
  // After the tiles have laid themselves out: half-faded text is a timing, not a contrast.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  )
  const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()
  return violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
}

/** Opens a sheet with `open`, then checks that Back closes it and stays put. */
async function backCloses(page: Page, path: RegExp, param: string, open: () => Promise<void>) {
  await open()
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible({ timeout: 15_000 })
  await expect(page).toHaveURL(new RegExp(`[?&]${param}=`))

  // Behind the sheet is inert: the nav is no stop for Tab or a screen reader.
  await expect
    .poll(() =>
      page
        .locator('nav')
        .first()
        .evaluate((n: HTMLElement) => n.inert),
    )
    .toBe(true)

  // A reload keeps it open — the address is the state.
  await page.reload()
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15_000 })

  await page.goBack()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page).toHaveURL(path)
  await expect(page).not.toHaveURL(new RegExp(`[?&]${param}=`))
  await expect
    .poll(() =>
      page
        .locator('nav')
        .first()
        .evaluate((n: HTMLElement) => n.inert),
    )
    .toBe(false)
}

test('the skip link is the first stop and lands on the main content', async ({ page }) => {
  await seed(page, 'en')
  await page.goto('/shelf')
  await expect(page.locator('main')).toBeVisible()

  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: 'Skip to content' })
  await expect(skip).toBeFocused()
  await expect(skip).toBeVisible()

  await page.keyboard.press('Enter')
  await expect(page.locator('main')).toBeFocused()
})

test('Back closes the shelf sheet', async ({ page }) => {
  await seed(page, 'en')
  await page.goto('/shelf')
  await backCloses(page, /\/shelf/, 'record', async () => {
    await page
      .getByRole('button', { name: /Maiden Voyage/ })
      .first()
      .click()
  })
})

test('the cross does not leave the shelf record in the history', async ({ page }) => {
  await seed(page, 'en')
  await page.goto('/shelf')
  await page
    .getByRole('button', { name: /Maiden Voyage/ })
    .first()
    .click()
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible({ timeout: 15_000 })

  await sheet.getByRole('button', { name: 'Close' }).click()
  await expect(sheet).toBeHidden()
  await expect(page).not.toHaveURL(/record=/)
})

test('Back closes the wantlist sheet', async ({ page }) => {
  await seed(page, 'en')
  await page.goto('/wantlist')
  await backCloses(page, /\/wantlist/, 'want', async () => {
    const cover = page.locator('main ul li button').first()
    await expect(cover).toBeVisible({ timeout: 15_000 })
    await cover.click()
  })
})

test('Back closes the shelf sheet on the start page', async ({ page }) => {
  await seed(page, 'en')
  await page.goto('/')
  await backCloses(page, /\/(\?|$)/, 'record', async () => {
    await page
      .getByRole('button', { name: /Open .*Maiden Voyage/i })
      .first()
      .click()
  })
})

test('Back closes the compartment sheet', async ({ page }) => {
  await seed(page, 'en')
  await page.goto('/places')
  await page.getByLabel('Add a place').fill('Living room')
  await page.getByRole('button', { name: 'Add a place' }).click()
  const room = page.getByRole('region', { name: 'Living room' })
  await room.getByRole('button', { name: 'Add furniture' }).first().click()
  await room.getByRole('button', { name: 'Kallax 2×2' }).click()
  await room.getByLabel('Name of the furniture').fill('Kallax')
  await room.getByRole('button', { name: 'Add furniture' }).last().click()

  await backCloses(page, /\/places/, 'place', async () => {
    await page
      .getByRole('grid', { name: 'Kallax' })
      .getByRole('button', { name: /^B1, 0 records/ })
      .click()
  })
})

/**
 * Every route, signed in — the signed-out sweep is in `smoke.spec.ts`, the
 * three populated lists in `populated.spec.ts`. These are the rest.
 */
const SIGNED_IN = [
  '/',
  '/dig',
  '/shelf',
  '/places',
  '/stack',
  '/review',
  '/compared',
  '/watched',
  '/dealers',
  '/settings/appearance',
  '/settings/collection',
  '/settings/search',
  '/settings/sync',
]

test.describe('axe, signed in', () => {
  for (const path of SIGNED_IN) {
    test(`${path} has no axe violations`, async ({ page }) => {
      await seed(page, 'en')
      await page.goto(path)
      await expect(page.locator('main')).toBeVisible({ timeout: 15_000 })
      expect(await axe(page)).toEqual([])
    })
  }

  test('an open sheet has no axe violations', async ({ page }) => {
    await seed(page, 'en')
    await page.goto('/shelf')
    await page
      .getByRole('button', { name: /Maiden Voyage/ })
      .first()
      .click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15_000 })
    expect(await axe(page)).toEqual([])
  })
})
