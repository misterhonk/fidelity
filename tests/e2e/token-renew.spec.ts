import { expect, test } from '@playwright/test'

import { seed } from './seed'

/**
 * A withdrawn token is renewed on the account screen, and the database stays
 * (2026-09-12). Discogs is answered from here — chromium only, as every spec
 * that routes a worker's requests.
 */
test.skip(
  ({ browserName }) => browserName !== 'chromium',
  "Playwright cannot route a worker's requests in WebKit",
)

test('renews the token on the account screen without losing the shelf', async ({
  page,
  context,
}) => {
  // After the seed: its default answer for Discogs is a 401, and later routes win.
  await seed(page, 'en')
  await context.route('https://api.discogs.com/**', (route) => {
    const path = new URL(route.request().url()).pathname
    const auth = route.request().headers()['authorization'] ?? ''
    const body =
      auth !== 'Discogs token=fresh-token'
        ? { status: 401, body: JSON.stringify({ message: 'You must authenticate' }) }
        : path === '/oauth/identity'
          ? {
              status: 200,
              body: JSON.stringify({ id: 1234567, username: 'mrtnmlchr', resource_url: '' }),
            }
          : {
              status: 200,
              body: JSON.stringify({ id: 1234567, username: 'mrtnmlchr', avatar_url: '' }),
            }
    return route.fulfill({
      ...body,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
    })
  })
  await page.goto('/settings/account')

  await expect(page.getByRole('heading', { name: 'Renew the token' })).toBeVisible()
  const field = page.getByLabel('Personal access token')

  // A key Discogs refuses is refused here, and nothing happens to the account.
  await field.fill('stale-token')
  await page.getByRole('button', { name: 'Renew' }).click()
  await expect(page.getByText('Discogs no longer accepts the token.')).toBeVisible({
    timeout: 15_000,
  })

  await field.fill('fresh-token')
  await page.getByRole('button', { name: 'Renew' }).click()
  await expect(page.getByText('The token works. Nothing else has changed.')).toBeVisible({
    timeout: 15_000,
  })

  // Still signed in as the same person, the shelf still there.
  await expect(page.getByText('mrtnmlchr')).toBeVisible()
  await page.goto('/shelf')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page).not.toHaveURL(/welcome/)
})
