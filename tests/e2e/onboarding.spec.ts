import { expect, test } from '@playwright/test'

/**
 * A stranger's first afternoon (docs/17 §2, M24): nothing on the device, no
 * document read. Token, collection, past the two optional steps, a first dig
 * with finds. Discogs is answered from here — chromium only, as every spec
 * that routes the worker's requests.
 */
test.skip(
  ({ browserName }) => browserName !== 'chromium',
  "Playwright cannot route a worker's requests in WebKit",
)

const record = (id: number, title: string, year: number) => ({
  id,
  master_id: id + 500,
  title,
  year,
  thumb: '',
  cover_image: '',
  artists: [{ id: 40135, name: 'Robag Wruhme' }],
  labels: [{ id: 1, name: 'Kompakt', catno: `KOM ${id}` }],
  genres: ['Electronic'],
  styles: ['Minimal'],
  formats: [{ name: 'Vinyl', qty: '1', descriptions: ['12"'] }],
})

test('a stranger sets up, syncs, and digs a shop without reading a document', async ({
  page,
  context,
}) => {
  const listings = Array.from({ length: 30 }, (_, i) => ({
    id: 9000 + i,
    status: 'For Sale',
    condition: 'Near Mint (NM or M-)',
    price: { value: 12, currency: 'EUR' },
    posted: '2026-09-01T00:00:00-07:00',
    ships_from: 'Germany',
    // The fifth listing is a record on the wantlist — the one find that must appear.
    release:
      i === 4
        ? {
            id: 202,
            title: 'Robag Wruhme - Wuppdeckmischmampflow',
            artist: 'Robag Wruhme',
            format: '12"',
            label: 'Kompakt',
            catalog_number: 'KOM 202',
          }
        : { id: 9000 + i, title: `Somebody - Record ${i}`, artist: 'Somebody', format: '12"' },
    seller: { username: 'kompaktshop' },
  }))
  await context.route('https://api.discogs.com/**', (route) => {
    const url = new URL(route.request().url())
    const json = (body: unknown) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify(body),
      })
    switch (true) {
      case url.pathname === '/oauth/identity':
        return json({ id: 4242, username: 'stranger', resource_url: '' })
      case url.pathname === '/users/stranger':
        return json({ id: 4242, username: 'stranger', avatar_url: '' })
      case url.pathname === '/users/stranger/collection/folders/0/releases':
        return json({
          pagination: { page: 1, pages: 1, items: 2 },
          releases: [
            {
              id: 101,
              instance_id: 1,
              folder_id: 1,
              date_added: '2026-01-01T00:00:00-08:00',
              rating: 5,
              basic_information: record(101, 'Thora Vukk', 2011),
            },
            {
              id: 102,
              instance_id: 2,
              folder_id: 1,
              date_added: '2026-01-02T00:00:00-08:00',
              rating: 4,
              basic_information: record(102, 'Donnerkuppel', 2011),
            },
          ],
        })
      case url.pathname === '/users/stranger/wants':
        return json({
          pagination: { page: 1, pages: 1, items: 1 },
          wants: [
            {
              id: 202,
              date_added: '2026-02-01T00:00:00-08:00',
              rating: 0,
              basic_information: record(202, 'Wuppdeckmischmampflow', 2004),
            },
          ],
        })
      case url.pathname === '/users/kompaktshop':
        return json({ username: 'kompaktshop', num_for_sale: 30, location: 'Cologne' })
      case url.pathname === '/users/kompaktshop/inventory':
        return json({ pagination: { page: 1, pages: 1, items: 30, per_page: 100 }, listings })
      default:
        return route.fulfill({
          status: 404,
          headers: { 'access-control-allow-origin': '*' },
          body: '{}',
        })
    }
  })

  await page.goto('/')
  await expect(page).toHaveURL(/welcome/)
  await page.getByRole('button', { name: 'Set it up — with your collection' }).click()
  await page.getByLabel('Personal access token').fill('a-token-for-the-test')
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page.getByText('Signed in as stranger')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Fetch the collection' }).click()
  // The two optional steps are walked past, as the setup promises.
  //
  // Both buttons say "Carry on", and the panels swap with an out-in
  // transition: on a slow runner the second click can land on the first
  // button while it is still leaving, and the setup stays on the credits
  // step forever. So the next heading is awaited between the two clicks —
  // once it is there, the old panel is gone.
  await page.getByRole('button', { name: 'Carry on' }).click({ timeout: 30_000 })
  await expect(page.getByRole('heading', { name: 'Who is behind your records' })).toBeVisible()
  await page.getByRole('button', { name: 'Carry on' }).click()
  await expect(page.getByRole('heading', { name: 'Done.' })).toBeVisible({ timeout: 15_000 })

  // The first dig, from the offer on the last screen.
  await page.getByRole('link', { name: 'To the dig' }).click()
  await expect(page).toHaveURL(/dig/)
  await page.getByLabel('Shop — name or link').fill('kompaktshop')
  await page.getByRole('button', { name: 'Check' }).click()
  await page.getByRole('button', { name: 'Start the dig' }).click()
  await expect(page.getByRole('heading', { name: /finds? at kompaktshop/ })).toBeVisible({
    timeout: 60_000,
  })
  await expect(page.getByText('Wuppdeckmischmampflow', { exact: false }).first()).toBeVisible()
})
