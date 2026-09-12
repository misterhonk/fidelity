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
  // Two searches on this page since M21.1 — the hub's and the catalogue's —
  // and both write the same sentence when nothing is there.
  await expect(
    page
      .getByText(/Found one|None running on this machine|Not reachable|Cannot search/)
      .first(),
  ).toBeVisible({
    timeout: 15_000,
  })
  // Two panels with the same buttons since M21.1; this test stays in the hub's.
  const panel = page.locator('section').filter({ has: page.getByLabel('Hub URL') })
  await panel.getByLabel('Hub URL').fill('https://hub.test')
  const secret = panel.getByLabel('Access key or shared secret')
  await secret.fill('falsch')
  await panel.getByRole('button', { name: 'Test the connection' }).click()
  await expect(page.getByText('the hub refuses this secret', { exact: false })).toBeVisible({
    timeout: 15_000,
  })

  // The eye: dots by default, the word on request, and the state is on the button.
  await expect(secret).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: 'Show it' }).click()
  await expect(secret).toHaveAttribute('type', 'text')
  await expect(page.getByRole('button', { name: 'Hide it' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  await secret.fill('richtig')
  await panel.getByRole('button', { name: 'Test the connection' }).click()
  await expect(page.getByText('the secret opens it', { exact: false })).toBeVisible({
    timeout: 15_000,
  })
})

/**
 * The catalogue's seam (M21.1, ADR-013): one field, one test, the build's date
 * on the status line — and nothing else on the page changes when it is empty.
 */
test('tests a catalogue and says which build answers', async ({ page, context }) => {
  await context.route('https://catalogue.test/**', (route) => {
    const cors = { 'access-control-allow-origin': '*' }
    if (new URL(route.request().url()).pathname === '/v1/catalogue/health') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: cors,
        body: JSON.stringify({ ok: true, build: '2026-09-01', releases: 4200 }),
      })
    }
    return route.fulfill({ status: 404, headers: cors, body: 'not found' })
  })
  await seed(page, 'en')
  await page.goto('/settings/hub')

  await expect(
    page
      .getByText(/Found one|None running on this machine|Not reachable|Cannot search/)
      .first(),
  ).toBeVisible({ timeout: 15_000 })
  const panel = page.locator('section').filter({ has: page.getByLabel('Catalogue URL') })
  await panel.getByLabel('Catalogue URL').fill('https://catalogue.test')
  await panel.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('built 2026-09-01', { exact: false })).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByText('4,200 releases', { exact: false })).toBeVisible()

  // Saved for real: it survives a reload.
  await page.reload()
  await expect(page.getByLabel('Catalogue URL')).toHaveValue('https://catalogue.test')
})
