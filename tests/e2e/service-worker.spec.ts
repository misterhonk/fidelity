import { expect, test } from '@playwright/test'

import { underServiceWorker } from './support/service-worker'

/**
 * What the service worker does besides opening the app offline.
 *
 * `offline.spec.ts` covers the first line of the worker's job — the shell is
 * there without a network. This file covers the two things that come after it
 * in the generated worker, and both of them were dead in a shipped build:
 * `createHandlerBoundToURL` was given a URL the precache list does not use
 * (`/200.html`, while the list says `200`) and threw. Inside the worker that
 * call sits in a promise, so the worker installed, precached, and looked
 * perfectly healthy — while the navigation fallback and the cover cache below
 * it were never registered at all.
 *
 * A test that only opens `/` cannot see that, because every address this app
 * has is precached under its own name. So these two go after the parts that
 * only exist for the cases nobody looks at: an address the precache does not
 * have, and an image from another host.
 */

/*
 * Chromium only, and said out loud rather than filtered away quietly — for the
 * same reason as `offline.spec.ts`: Playwright's WebKit cannot navigate while
 * its context is offline, and it does not hand service-worker requests to
 * `context.route` either. iOS Safari is the target that matters most and this
 * file cannot speak for it, so it says so instead of passing on its behalf.
 */
test.describe('the service worker', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Playwright can neither navigate offline nor intercept worker requests in WebKit',
  )

  /**
   * An address that was never prerendered still opens offline.
   *
   * Every screen of this app is precached under its own name, so the fallback
   * only shows up for what is left over: a link with a tracking parameter on
   * it, an address from a newer version of the app, a typo in a shared URL.
   * Online those all land on the same shell; offline they land on the fallback
   * or on nothing at all.
   */
  test('opens an address the precache has never heard of', async ({ page, context }) => {
    test.skip(
      !(await underServiceWorker(page, '/in-store')),
      'No service worker in this browser',
    )

    await context.setOffline(true)
    try {
      await page.goto('/in-store?from=a-link-somebody-shared')
      await expect(page.getByRole('heading', { name: 'In the shop' })).toBeVisible()
    } finally {
      await context.setOffline(false)
    }
  })

  /**
   * A cover fetched twice is fetched once.
   *
   * i.discogs.com has a budget of its own — roughly thirty requests a minute,
   * separate from the API's and invisible to JavaScript (docs/02). Scrolling a
   * dig twice without this cache walks straight into it, and the app cannot
   * even see the wall it hits.
   *
   * The request is answered here rather than by Discogs: a test must not send
   * traffic to somebody else's server, and what is being measured is the
   * worker's routing, not their availability.
   */
  test('keeps a cover it has already fetched', async ({ page, context }) => {
    // Not a real image, and it does not need to be: an opaque response has no
    // readable body anyway, and what is being measured is whether the worker
    // routed the request at all.
    await context.route('https://i.discogs.com/**', (route) =>
      route.fulfill({ status: 200, contentType: 'image/png', body: 'cover' }),
    )

    test.skip(!(await underServiceWorker(page, '/')), 'No service worker in this browser')

    const cached = await page.evaluate(async () => {
      // `no-cors`, because that is how an <img> asks: the response comes back
      // opaque, which is exactly the case the worker is configured to keep.
      await fetch('https://i.discogs.com/fidelity-test-cover.jpg', { mode: 'no-cors' })

      // The worker writes to the cache after answering, so the fetch resolving
      // is not the same as the cache being written.
      for (let attempt = 0; attempt < 20; attempt++) {
        if ((await caches.keys()).includes('fidelity-covers')) return true
        await new Promise((done) => setTimeout(done, 100))
      }
      return false
    })

    expect(cached).toBe(true)
  })
})
