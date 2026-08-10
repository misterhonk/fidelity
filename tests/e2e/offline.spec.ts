import { expect, test, type Page } from '@playwright/test'

/**
 * Die App startet ohne Netz.
 *
 * This is the promise the whole offline story rests on, and it has been broken
 * before: the service worker registered, cached nothing it was asked for, and
 * the app opened to a browser error page. Nothing about that is visible while
 * there *is* signal, which is why it survived until somebody stood in a
 * basement with it.
 *
 * Run against the generated static output — the same files a docroot serves —
 * because a service worker is the one part of this app that does not exist in
 * a dev server the way it exists in production.
 */

/**
 * Waits until a service worker is actually driving this page.
 *
 * `registration.active` is not enough: a worker can be active without yet
 * controlling the client that installed it, and going offline in that window
 * would test the HTTP cache rather than the worker.
 */
async function serviceWorkerInCharge(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false
    try {
      await navigator.serviceWorker.ready
    } catch {
      return false
    }
    if (navigator.serviceWorker.controller) return true

    // Installed on this load but not yet in charge of it. One reload hands it
    // over — which is exactly what happens on somebody's second visit.
    return await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), 5_000)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        clearTimeout(timer)
        resolve(true)
      })
    })
  })
}

async function underServiceWorker(page: Page, path: string): Promise<boolean> {
  await page.goto(path)
  await expect(page.locator('main')).toBeVisible()

  if (await serviceWorkerInCharge(page)) return true
  await page.reload()
  return serviceWorkerInCharge(page)
}

/*
 * Chromium only, and said out loud rather than filtered away quietly.
 *
 * Playwright's WebKit *does* run a service worker here — it reports one in
 * charge — but reloading a page while the context is offline fails inside the
 * browser itself ("WebKit encountered an internal error") before any of this
 * app's code runs. That is the harness, not the app, and iOS Safari is the
 * target that matters most: this test cannot speak for it, so it says so
 * instead of passing on its behalf.
 */
test.describe('without a connection', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Playwright kann in WebKit nicht offline neu laden',
  )

  test('opens anyway, from what the service worker kept', async ({ page, context }) => {
    test.skip(!(await underServiceWorker(page, '/')), 'Kein Service Worker in diesem Browser')

    await context.setOffline(true)
    try {
      await page.reload()
      await expect(page.locator('main')).toBeVisible()
    } finally {
      await context.setOffline(false)
    }
  })

  /**
   * Und der Bildschirm, für den es überhaupt gebaut wurde.
   *
   * "Im Laden" exists for a record shop in a basement: a record in your hand
   * and the question whether you already own it. Every answer it gives comes
   * out of IndexedDB, so the only thing that can stop it is the shell not
   * loading — which is precisely what this checks.
   */
  test('opens the in-store screen, which is the point of all of it', async ({
    page,
    context,
  }) => {
    test.skip(
      !(await underServiceWorker(page, '/im-laden')),
      'Kein Service Worker in diesem Browser',
    )

    await context.setOffline(true)
    try {
      await page.reload()
      await expect(page.locator('main')).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Im Laden' })).toBeVisible()
    } finally {
      await context.setOffline(false)
    }
  })
})
