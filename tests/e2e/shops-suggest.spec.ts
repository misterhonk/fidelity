import { expect, test } from '@playwright/test'

import { DEFAULT_PREFERENCES } from '~~/db/meta'

import { putRows, seed } from './seed'

/**
 * Shops other people have dug (ADR-014).
 *
 * The shops screen has always been a log of what this device happened to try,
 * and Discogs offers nothing to widen it — no "which shops sell this sort of
 * record", no list of good sellers, and the undocumented search is rule 5.
 * What there is: other devices, and a hub that passes on what one of them
 * learned.
 *
 * The hub is answered from here. Chromium only, as every spec that routes a
 * worker's requests.
 */
test.skip(
  ({ browserName }) => browserName !== 'chromium',
  "Playwright cannot route a worker's requests in WebKit",
)

test('lists shops from the hub, ranked against your own shelf', async ({ page, context }) => {
  await seed(page, 'en')

  const cors = { 'access-control-allow-origin': '*' }
  await context.route('https://hub.test/**', async (route) => {
    const url = new URL(route.request().url())

    if (route.request().method() === 'PUT') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: cors,
        body: JSON.stringify({ stored: true }),
      })
    }

    if (url.pathname === '/v1/shops') {
      const shop = (username: string, labelDist: Record<string, number>) => ({
        username,
        displayName: username,
        shipsFrom: 'Germany',
        numForSale: 5_000,
        avatarUrl: '',
        seenAt: Date.now() - 3_600_000,
        fingerprint: {
          sampledItems: 100,
          totalItems: 5_000,
          coverage: 0.02,
          labelDist,
          styleDist: {},
          decadeDist: {},
        },
      })

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: cors,
        body: JSON.stringify({
          shops: [
            // The seeded shelf is Blue Note; this one is half Blue Note.
            shop('bluenoteheaven', { 'Blue Note': 50, Verve: 50 }),
            // And this one has nothing of yours, so it is not a suggestion.
            shop('technoid', { Kompakt: 100 }),
          ],
        }),
      })
    }

    return route.fulfill({ status: 404, headers: cors, body: '{}' })
  })

  /*
   * The hub to ask, and the shelf to rank against.
   *
   * The taste profile is what "labels you collect" means, and the seed does
   * not write one — it is computed after a sync, which no browser test runs.
   * Without it every shop scores nought and the section correctly stays away,
   * which is exactly how the first run of this spec failed.
   */
  await putRows(page, {
    meta: [
      {
        key: 'preferences',
        value: {
          ...DEFAULT_PREFERENCES,
          shipsToCountry: 'Germany',
          hubUrl: 'https://hub.test',
        },
      },
      {
        key: 'tasteProfile',
        value: {
          releaseCount: 3,
          artists: {},
          labels: { '157': { name: 'Blue Note', n: 3, weight: 1, lift: null } },
          styles: {},
          decades: {},
          computedAt: Date.now(),
        },
      },
    ],
  })

  await page.goto('/dealers')

  await expect(page.getByRole('heading', { name: 'Shops other people have dug' })).toBeVisible({
    timeout: 20_000,
  })
  await expect(page.getByRole('link', { name: /bluenoteheaven/ })).toBeVisible()
  // Half its sampled stock is on a label from the shelf.
  await expect(page.getByText('50 % yours')).toBeVisible()
  // The labels behind the figure, so it is not a score to take on trust.
  await expect(page.getByText('Blue Note', { exact: true })).toBeVisible()

  // Nothing in common is not a suggestion — that would make this a directory.
  await expect(page.getByText('technoid')).toBeHidden()

  // And what the number is a share *of*, because a fingerprint is a sample.
  await expect(page.getByText(/sampled by somebody else/)).toBeVisible()
})
