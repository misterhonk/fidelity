import { expect, test } from '@playwright/test'

/**
 * Opening the app with no network.
 *
 * The one scenario the whole service worker exists for. docs/06 M6 promises
 * it, the in-store screen says "offline, alles aus dem Gerät" on its face, and
 * nothing was checking — a worker can install, precache every file, report
 * itself active and still intercept nothing, which is exactly what it was
 * doing.
 *
 * Chromium only. WebKit's service-worker implementation in Playwright does not
 * survive `setOffline`, and a test that cannot fail is worse than no test.
 */
test.describe('offline', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'service worker: Chromium only')

  test('opens a route with the server unreachable', async ({ page, context }) => {
    await page.goto('/im-laden')

    // The worker takes control on the next navigation, not this one.
    await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true), null, {
      timeout: 20_000,
    })
    await page.reload()
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, {
      timeout: 20_000,
    })

    // Everything the shell needs has to be in the precache by now.
    const cached = await page.evaluate(async () => {
      const names = await caches.keys()
      let count = 0
      for (const name of names) count += (await (await caches.open(name)).keys()).length
      return count
    })
    expect(cached).toBeGreaterThan(0)

    await context.setOffline(true)

    // A basement, in other words.
    await page.reload()
    await expect(page.locator('main')).toBeVisible({ timeout: 20_000 })

    // And the question the screen exists for still gets an answer, because it
    // never needed the network: the collection has been on the device since M1.
    await expect(page.getByRole('searchbox')).toBeVisible()

    await context.setOffline(false)
  })

  test('opens a route it has never been to before', async ({ page, context }) => {
    await page.goto('/')
    await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true), null, {
      timeout: 20_000,
    })
    await page.reload()
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, {
      timeout: 20_000,
    })

    await context.setOffline(true)

    /*
     * Every route is prerendered into the precache, but the one that matters
     * is the fallback: a URL nobody visited before the network went away still
     * has to land on the shell rather than on a browser error page.
     */
    await page.goto('/gemerkt')
    await expect(page.locator('main')).toBeVisible({ timeout: 20_000 })

    await context.setOffline(false)
  })
})
