import { expect, test } from '@playwright/test'

import { seed } from './seed'

/**
 * The radar — bands you own nothing by (M29).
 *
 * "Exit North, I think they are great, have no record by them, but I would
 * like to be shown one if it turns up." Before this there was nowhere to put
 * that: the artist map is built from the taste profile, which is the
 * collection and nothing else.
 *
 * Discogs is answered from here — chromium only, as every spec that routes a
 * worker's requests.
 */
test.skip(
  ({ browserName }) => browserName !== 'chromium',
  "Playwright cannot route a worker's requests in WebKit",
)

test('puts a band on the radar and keeps it there', async ({ page, context }) => {
  await seed(page, 'en')

  const cors = { 'access-control-allow-origin': '*' }
  await context.route('https://api.discogs.com/**', async (route) => {
    const url = new URL(route.request().url())

    if (url.pathname === '/database/search' && url.searchParams.get('type') === 'artist') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: cors,
        body: JSON.stringify({
          results: [
            { id: 5_552_221, title: 'Exit North', thumb: '' },
            { id: 9_001, title: 'Exit North Quartet', thumb: '' },
          ],
        }),
      })
    }

    return route.fulfill({ status: 404, headers: cors, body: '{}' })
  })

  await page.goto('/settings/collection')

  const card = page.getByRole('heading', { name: 'On your radar' })
  await expect(card).toBeVisible()
  await expect(page.getByText('Nobody on the radar yet')).toBeVisible()

  await page.getByLabel('Find a band').fill('Exit North')
  await page.getByRole('button', { name: 'Search', exact: true }).click()

  // Both hits, and the one that was added goes quiet rather than vanishing
  // under the finger that tapped it.
  // Exact, or "On the radar" also matches "Put on the radar" — Playwright's
  // name option is a substring by default.
  const add = page.getByRole('button', { name: 'Put on the radar', exact: true }).first()
  await expect(add).toBeVisible({ timeout: 15_000 })
  await add.click()

  await expect(page.getByRole('button', { name: 'On the radar', exact: true })).toBeVisible()
  await expect(page.getByText('Nobody on the radar yet')).toBeHidden()
  // And what it is worth is said: a name is a name until the horizon expands it.
  await expect(
    page.getByText(/one or two lookups the next time we refresh your artists/),
  ).toBeVisible()

  // It survives a reload — this is a row in the database, not a screen state.
  await page.reload()
  await expect(page.getByRole('button', { name: 'Take off' })).toBeVisible({ timeout: 15_000 })
})
