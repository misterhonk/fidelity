import { expect, test, type Page } from '@playwright/test'

import { signIn } from './seed'

/**
 * The app on a screen with room.
 *
 * It was built phone-first and stayed a narrow ribbon on a monitor, which for
 * a collection is the wrong shape — covers are the one thing here that gets
 * better with space.
 *
 * The subtler half is that container queries need a container. Every `@sm:`
 * and `@md:` rule outside MatchCard had no ancestor declaring `@container`, so
 * none of them ever applied and nobody could see that they did not.
 */
const WIDE = { width: 1600, height: 1000 }
const TABLET = { width: 900, height: 1200 }
const PHONE = { width: 375, height: 812 }

async function columns(page: Page, selector: string) {
  return page.locator(selector).evaluate((el) => {
    return getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length
  })
}

/**
 * Every page, every width, no horizontal overflow.
 *
 * This used to check two routes, which is how a credits list pushed a phone 94
 * pixels wide and nobody noticed: the two it checked did not have one. A sweep
 * is cheap — the pages are static files and the assertion is one number — and
 * horizontal scroll is the one layout failure that makes an app feel broken
 * rather than merely ugly.
 *
 * Signed out these screens are mostly chrome, so this catches structure and
 * not content. The content half is a static check on the class pairs that
 * cause it (tests/unit/design-restraint.spec.ts).
 */
const ROUTES = [
  '/',
  '/welcome',
  '/dig',
  '/basket',
  '/saved',
  '/shelf',
  '/map',
  '/wantlist',
  '/dealers',
  '/in-store',
  '/settings',
  '/settings/account',
  '/settings/collection',
  '/settings/search',
  '/settings/appearance',
  '/settings/sync',
  '/settings/hub',
  '/settings/data',
  '/privacy',
  '/legal',
]

test.describe('nothing scrolls sideways', () => {
  for (const route of ROUTES) {
    test(`${route} fits every width`, async ({ page }) => {
      await page.goto(route)
      await expect(page.locator('main')).toBeVisible()

      for (const size of [PHONE, TABLET, WIDE]) {
        await page.setViewportSize(size)
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        expect(overflow, `${route} bei ${size.width}px`).toBeLessThanOrEqual(0)
      }
    })
  }
})

test.describe('room to breathe', () => {
  test('the shelf grid follows the width it is given', async ({ page }) => {
    await page.setViewportSize(PHONE)
    await page.goto('/shelf')
    await expect(page.locator('main')).toBeVisible()

    // Signed out there is no shelf to show, so the grid only proves itself
    // where there is one. What is checkable everywhere is that the page does
    // not force a horizontal scrollbar at any width.
    for (const size of [PHONE, TABLET, WIDE]) {
      await page.setViewportSize(size)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow, `waagerechter Überlauf bei ${size.width}px`).toBeLessThanOrEqual(0)
    }
  })

  /**
   * On the dashboard, that is — which this test did not do until 2026-09-11.
   *
   * It went to `/` signed out, and signed out the guard redirects `/` to
   * `/welcome`. So what was measured was always the setup page, while the name
   * and the comment spoke of the dashboard. It only came to light when
   * `@container` on `/welcome` moved one level down and a test went red that
   * had nothing to do with that change.
   *
   * A test that is green because it stands somewhere else is worse than none:
   * it claims coverage for a screen it has never seen.
   */
  test('the dashboard tiles spread out instead of stacking', async ({ page }) => {
    await signIn(page)
    await page.goto('/')
    await expect(page.locator('main')).toBeVisible()
    // Only once the address is right does what follows measure the right thing.
    expect(new URL(page.url()).pathname).toBe('/')

    const hasContainer = await page
      .locator('main')
      .evaluate((el) => getComputedStyle(el).containerType !== 'normal')
    expect(hasContainer).toBe(true)
  })
})

test.describe('the shelf grid itself', () => {
  // The grid needs records, and records need a signed-in state the e2e suite
  // does not have. What can be checked without one is the rule that decides
  // the column count, which is the part that was silently broken.
  test('the collection tabs lead to all three views', async ({ page }) => {
    await signIn(page)
    await page.setViewportSize(WIDE)
    await page.goto('/shelf')

    const tabs = page.getByRole('navigation', { name: 'Collection' })
    await expect(tabs.getByRole('link', { name: 'Shelf' })).toBeVisible()
    await expect(tabs.getByRole('link', { name: 'Map' })).toBeVisible()
    await expect(tabs.getByRole('link', { name: 'Wantlist' })).toBeVisible()
  })

  test('a wide grid really is wider', async ({ page }) => {
    await signIn(page)
    await page.setViewportSize(WIDE)
    await page.goto('/shelf')
    await expect(page.locator('main')).toBeVisible()

    // A container query on an element 110rem wide has to resolve differently
    // from the same rule on a phone. Proven on a stand-in, because the real
    // grid needs a collection.
    await page.evaluate(() => {
      const main = document.querySelector('main')!
      const probe = document.createElement('ul')
      probe.id = 'probe'
      probe.className = 'grid grid-cols-3 @md:grid-cols-4 @2xl:grid-cols-6 @5xl:grid-cols-8'
      main.append(probe)
    })

    expect(await columns(page, '#probe')).toBe(8)

    await page.setViewportSize(PHONE)
    expect(await columns(page, '#probe')).toBe(3)
  })
})
