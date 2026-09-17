import { expect, test } from '@playwright/test'

import { seed } from './seed'

/**
 * "The horizon build is aborted as soon as I leave the tab, and I cannot see
 * why" — reported against 0.70.1, and nothing had been aborted.
 *
 * The run lives in the worker and survives the page that started it; the bar
 * lived in the panel's own `ref` and went with it. So leaving took the bar and
 * left the run: an idle-looking panel with an enabled button over a build that
 * was still going, and a dig started meanwhile waiting behind it in the one
 * lane there is (rule 3) with nothing on screen to say so.
 *
 * Both halves are here, in the order somebody meets them. Discogs is answered
 * from here, slowly — chromium only, as every spec that routes a worker's
 * requests.
 */
test.skip(
  ({ browserName }) => browserName !== 'chromium',
  "Playwright cannot route a worker's requests in WebKit",
)

test('a build survives leaving the screen, and says so where the wait is felt', async ({
  page,
  context,
}) => {
  await seed(page, 'en')

  const cors = { 'access-control-allow-origin': '*' }
  await context.route('https://api.discogs.com/**', async (route) => {
    const url = new URL(route.request().url())

    if (/^\/(artists|labels)\/\d+\/releases$/.test(url.pathname)) {
      // Slow enough to walk to another screen and back while it runs.
      await new Promise((done) => setTimeout(done, 800))
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: cors,
        body: JSON.stringify({
          pagination: { page: 1, pages: 1, items: 2, per_page: 100 },
          releases: [
            { id: 900_001, type: 'release', role: 'Main', year: 1966, title: 'One' },
            { id: 900_002, type: 'release', role: 'Main', year: 1968, title: 'Two' },
          ],
        }),
      })
    }

    if (/^\/artists\/\d+$/.test(url.pathname)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: cors,
        body: JSON.stringify({ id: Number(url.pathname.split('/')[2]), aliases: [] }),
      })
    }

    return route.fulfill({ status: 404, headers: cors, body: '{}' })
  })

  await page.goto('/settings/collection')
  await page.getByRole('button', { name: 'Build the horizon' }).click()
  await expect(page.getByText(/Carries on if you leave this screen/)).toBeVisible({
    timeout: 15_000,
  })

  /*
   * Away — through the app's own navigation, the way a person leaves a screen.
   * A full reload would take the worker with it, and that really is an
   * interrupted build: a different situation with a different screen.
   */
  await page.getByRole('link', { name: 'Dig', exact: true }).click()
  await expect(page).toHaveURL(/dig/)

  // And here is where the wait was felt: "now, after 10 minutes, the app starts
  // scanning my first shop. A bit illogical."
  await expect(page.getByText(/still learning your artists and labels/)).toBeVisible({ timeout: 15_000 })

  // Back, by the way the sentence itself offers.
  await page.getByRole('link', { name: 'Watch it' }).click()
  await expect(page).toHaveURL(/settings\/collection/)
  await expect(page.getByText(/Carries on if you leave this screen/)).toBeVisible({
    timeout: 15_000,
  })
  // The button that used to be live again, and would have started a second
  // build beside the first.
  await expect(page.getByRole('button', { name: 'Build the horizon' })).toBeDisabled()
})
