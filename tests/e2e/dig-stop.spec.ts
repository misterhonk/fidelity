import { expect, test } from './support/test'

import { seed } from './seed'

/**
 * A dig can be stopped, from any screen that shows it, and picked up again
 * later (#216). Discogs is answered from here, slowly — chromium only, as
 * every spec that routes a worker's requests.
 */
test.skip(
  ({ browserName }) => browserName !== 'chromium',
  "Playwright cannot route a worker's requests in WebKit",
)

test('stops a dig from another screen and resumes it later', async ({ page, context }) => {
  const listings = (page: number) =>
    Array.from({ length: 100 }, (_, i) => ({
      id: page * 1000 + i,
      status: 'For Sale',
      condition: 'Near Mint (NM or M-)',
      sleeve_condition: 'Near Mint (NM or M-)',
      price: { value: 12, currency: 'EUR' },
      posted: '2026-09-01T00:00:00-07:00',
      ships_from: 'Germany',
      release: { id: page * 1000 + i, title: `Record ${i}`, artist: 'Unknown', format: '12"' },
      seller: { username: 'slowshop' },
    }))
  // After the seed: its default answer for Discogs is a 401, and later routes win.
  await seed(page, 'en')
  await context.route('https://api.discogs.com/**', async (route) => {
    const url = new URL(route.request().url())
    const cors = { 'access-control-allow-origin': '*' }
    if (url.pathname === '/users/slowshop') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: cors,
        body: JSON.stringify({ username: 'slowshop', num_for_sale: 300, location: 'Berlin' }),
      })
    }
    if (url.pathname === '/users/slowshop/inventory') {
      const pageNo = Number(url.searchParams.get('page') ?? '1')
      // Slow enough to press Stop while the first pages are still coming.
      await new Promise((done) => setTimeout(done, 1500))
      return route
        .fulfill({
          status: 200,
          contentType: 'application/json',
          headers: cors,
          body: JSON.stringify({
            pagination: { page: pageNo, pages: 3, items: 300, per_page: 100 },
            listings: listings(pageNo),
          }),
        })
        .catch(() => undefined)
    }
    return route.fulfill({ status: 404, headers: cors, body: '{}' })
  })

  await page.goto('/dig')
  await page.getByText('Another shop, or an earlier dig').click()
  await page.getByLabel('Shop name or link').fill('slowshop')
  await page.getByRole('button', { name: 'Check' }).click()
  await page.getByRole('button', { name: 'Start the dig' }).click()
  await expect(page.getByText('Digging through slowshop', { exact: true })).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByRole('progressbar', { name: 'Digging through slowshop' })).toBeVisible(
    {
      timeout: 15_000,
    },
  )

  // Away: the nav still says a dig is running.
  await page.getByRole('link', { name: 'Collection', exact: true }).click()
  await expect(page).toHaveURL(/shelf/)
  await expect(page.getByTestId('dig-ring')).toBeVisible({ timeout: 5_000 })

  // Back, and stop it from the screen that did not start it.
  await page.getByRole('link', { name: 'Dig', exact: true }).click()
  await expect(page).toHaveURL(/dig/)
  await page.getByRole('button', { name: 'Stop', exact: true }).click()

  await expect(page.getByText('Digging through slowshop', { exact: true })).toBeHidden({
    timeout: 15_000,
  })
  await expect(page.getByTestId('dig-ring')).toBeHidden({ timeout: 5_000 })
  await expect(page.getByText(/A dig at slowshop stopped at/)).toBeVisible({ timeout: 15_000 })

  // Later: carry on, and it goes through to the end.
  await page.getByRole('button', { name: 'Carry on with the dig' }).click()
  await expect(page.getByText('Digging through slowshop', { exact: true })).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByText('Digging through slowshop', { exact: true })).toBeHidden({
    timeout: 60_000,
  })
  await expect(page.getByText(/A dig at slowshop stopped at/)).toBeHidden()
  await expect(page.getByRole('heading', { name: /finds at slowshop/ })).toBeVisible({
    timeout: 15_000,
  })
})
