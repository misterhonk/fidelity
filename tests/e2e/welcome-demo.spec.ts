import { expect, type Page, test } from './support/test'

/**
 * The token-free demo never ends empty (#212).
 *
 * It read the newest 500 listings of a shop and ended, more often than not, on
 * "nothing in this slice fitted" — half a minute of waiting for a shrug. Now it
 * reads the shop sorted by artist around the record somebody picked, and when
 * even that turns up nothing, it shows what a find looks like instead.
 *
 * Discogs is answered from here — chromium only, as every spec that routes a
 * worker's requests.
 */
test.skip(
  ({ browserName }) => browserName !== 'chromium',
  "Playwright cannot route a worker's requests in WebKit",
)

const cors = { 'access-control-allow-origin': '*' }

/** The first of today's records on the welcome screen: a button with a sleeve on it. */
const seedButton = (page: Page) => page.locator('li > button:has(img)').first()

/** Every seed's record, as `/releases/{id}` would describe it. */
function release(id: number, artist: string) {
  return { id, title: 'The seed', artists: [{ id: 7, name: artist }], labels: [] }
}

test('finds the record beside the one picked, by asking for the artist', async ({
  page,
  context,
}) => {
  const sorts: string[] = []
  // Whichever seed is shown today, the release says this artist made it.
  const artist = 'Somebody Stocked'

  await context.route('https://api.discogs.com/**', async (route) => {
    const url = new URL(route.request().url())
    const id = Number(url.pathname.match(/^\/releases\/(\d+)/)?.[1])
    if (id) return route.fulfill({ headers: cors, json: release(id, artist) })

    sorts.push(url.searchParams.get('sort') ?? '')
    return route.fulfill({
      headers: cors,
      json: {
        pagination: { page: 1, pages: 1, per_page: 100, items: 1, urls: {} },
        listings: [
          {
            id: 555,
            condition: 'Very Good Plus (VG+)',
            price: { value: 9, currency: 'EUR' },
            release: { id: 4242, title: 'The other one', artist, format: 'LP' },
          },
        ],
      },
    })
  })

  await page.goto('/welcome')
  await seedButton(page).click()

  await expect(page.getByText('The other one')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('demo-examples')).toHaveCount(0)
  expect(sorts).toEqual(['artist'])
})

test('shows what a find looks like when nothing sat beside it', async ({ page, context }) => {
  await context.route('https://api.discogs.com/**', async (route) => {
    const url = new URL(route.request().url())
    const id = Number(url.pathname.match(/^\/releases\/(\d+)/)?.[1])
    if (id) return route.fulfill({ headers: cors, json: release(id, 'Nobody Stocks This') })

    return route.fulfill({
      headers: cors,
      json: {
        pagination: { page: 1, pages: 1, per_page: 100, items: 0, urls: {} },
        listings: [],
      },
    })
  })

  await page.goto('/welcome')
  await seedButton(page).click()

  const examples = page.getByTestId('demo-examples')
  await expect(examples).toBeVisible({ timeout: 30_000 })
  await expect(examples.getByRole('listitem')).toHaveCount(3)
  await expect(page.getByText(/Nothing in this slice/)).toHaveCount(0)
})
