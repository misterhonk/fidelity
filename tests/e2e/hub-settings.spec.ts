import { expect, test, type BrowserContext } from '@playwright/test'

import { seed } from './seed'

/**
 * "Test connection" has to try the secret, and the secret has to be readable.
 *
 * Both came out of the same afternoon on 2026-09-12: a phone with the wrong
 * secret read "reachable · secured" while every real request came back 401,
 * and a forty-eight-character word typed against dots was typed twice.
 *
 * The hub is answered from here. Chromium only: Playwright sees a worker's
 * requests there and not in WebKit, the same line the other routed specs draw.
 */
test.skip(
  ({ browserName }) => browserName !== 'chromium',
  "Playwright cannot route a worker's requests in WebKit",
)

async function fakeHub(context: BrowserContext, accepts: string) {
  await context.route('https://hub.test/**', (route) => {
    const url = new URL(route.request().url())
    const cors = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type, x-hub-secret',
      'access-control-allow-methods': 'GET, PUT, POST, OPTIONS',
    }
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers: cors })
    if (url.pathname === '/v1/health') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: cors,
        body: JSON.stringify({ ok: true, horizon: 41, shipping: 0, covers: 0, secured: true }),
      })
    }
    const word = route.request().headers()['x-hub-secret']
    if (word !== accepts) {
      return route.fulfill({
        status: 401,
        contentType: 'application/json',
        headers: cors,
        body: '{}',
      })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: cors,
      body: JSON.stringify({ covers: {} }),
    })
  })
}

test('tries the secret at a locked door, and shows it on request', async ({
  page,
  context,
}) => {
  await fakeHub(context, 'richtig')
  await seed(page, 'en')
  await page.goto('/settings/hub')

  // The screen looks for a hub on its own when it opens and writes what it
  // finds into the field. Let it finish, or the address typed here is
  // overwritten a moment later.
  await expect(page.getByText(/Found one|Nothing found|Not reachable/)).toBeVisible({
    timeout: 15_000,
  })
  await page.getByLabel('Hub URL').fill('https://hub.test')
  const secret = page.getByLabel('Shared secret (if the hub asks for one)')
  await secret.fill('falsch')
  await page.getByRole('button', { name: 'Test the connection' }).click()
  await expect(page.getByText('the hub refuses this secret', { exact: false })).toBeVisible({
    timeout: 15_000,
  })

  // The eye: dots by default, the word on request, and the state is on the button.
  await expect(secret).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: 'Show the secret' }).click()
  await expect(secret).toHaveAttribute('type', 'text')
  await expect(page.getByRole('button', { name: 'Hide the secret' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  await secret.fill('richtig')
  await page.getByRole('button', { name: 'Test the connection' }).click()
  await expect(page.getByText('the secret opens it', { exact: false })).toBeVisible({
    timeout: 15_000,
  })
})
