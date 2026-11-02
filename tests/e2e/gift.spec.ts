import { expect, test, type BrowserContext } from './support/test'

import { putRows, seed } from './seed'

/**
 * A gift for a friend (#245): their public wantlist, across the shops you
 * scanned, within a budget, minus what they own.
 *
 * Discogs is answered from here — chromium only, as every spec that routes a
 * worker's requests.
 */
test.skip(
  ({ browserName }) => browserName !== 'chromium',
  "Playwright cannot route a worker's requests in WebKit",
)

const cors = { 'access-control-allow-origin': '*' }
const pagination = (items: number) => ({ page: 1, pages: 1, per_page: 100, items, urls: {} })
const basic = (id: number) => ({
  id,
  master_id: 0,
  title: `Record ${id}`,
  year: 1970,
  formats: [{ name: 'Vinyl', qty: '1' }],
  labels: [{ name: 'Label', catno: 'X1', id: 1 }],
  artists: [{ name: 'Artist', anv: '', id: 1 }],
  genres: [],
  styles: [],
})

async function friendOnDiscogs(context: BrowserContext, wantsStatus = 200) {
  await context.route('https://api.discogs.com/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const json = (status: number, body: unknown) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        headers: cors,
        body: JSON.stringify(body),
      })

    if (path === '/users/ada.friend/wants') {
      if (wantsStatus !== 200) return json(wantsStatus, { message: 'private' })
      return json(200, {
        pagination: pagination(4),
        wants: [701, 702, 703, 704].map((id) => ({
          id,
          date_added: '2026-01-01T00:00:00-00:00',
          rating: 0,
          basic_information: basic(id),
        })),
      })
    }
    if (path === '/users/ada.friend/collection/folders/0/releases') {
      return json(200, {
        // 704 is owned too, but in no shop: nothing was left out for it.
        pagination: pagination(2),
        releases: [702, 704].map((id) => ({
          id,
          date_added: '2026-01-01T00:00:00-00:00',
          basic_information: basic(id),
        })),
      })
    }
    return json(404, { message: 'not here' })
  })
}

test('finds what a friend wants within the budget, minus what they own', async ({
  page,
  context,
}) => {
  const dig = await seed(page, 'en')
  const stock = (listingId: number, releaseId: number, title: string, price: number) => ({
    digId: dig.id,
    listingId,
    releaseId,
    label: 'Label',
    decade: 1970,
    title,
    artist: 'Artist',
    catno: 'X1',
    format: 'Vinyl, LP',
    year: 1970,
    condition: 'Very Good Plus (VG+)',
    price,
    currency: 'EUR',
  })
  await putRows(page, {
    stock: [
      stock(5_000_001, 701, 'Wanted and cheap', 12),
      stock(5_000_002, 702, 'Already owned', 10),
      stock(5_000_003, 703, 'Too dear', 60),
    ],
  })
  await friendOnDiscogs(context)

  await page.goto('/gift')
  await page
    .getByLabel('Their Discogs name or profile link')
    .fill('https://www.discogs.com/user/ada.friend')
  await page.getByLabel('Most per record').fill('25')
  await page.getByRole('button', { name: 'Find' }).click()

  const result = page.getByTestId('gift-result')
  await expect(result).toContainText('1 of their 4 wants is in your shops within the budget.', {
    timeout: 15_000,
  })
  await expect(result.getByRole('link', { name: /Wanted and cheap/ })).toHaveAttribute(
    'href',
    'https://www.discogs.com/sell/item/5000001',
  )
  await expect(result).toContainText('€12.00')
  await expect(result).toContainText('1 they already own was left out.')
  await expect(result).toContainText('1 more only above the budget.')
  await expect(result).not.toContainText('Already owned')
  await expect(result).toContainText('Prices as dug, good until')

  // Restricted Data: the friend's name stays out of the address.
  expect(page.url()).not.toContain('ada.friend')
})

test('says so when the wantlist is private', async ({ page, context }) => {
  await seed(page, 'en')
  await friendOnDiscogs(context, 403)

  await page.goto('/gift')
  await page.getByLabel('Their Discogs name or profile link').fill('ada.friend')
  await page.getByRole('button', { name: 'Find' }).click()

  await expect(page.getByTestId('gift-result')).toContainText(
    'Their wantlist is private, or there is no such name.',
    { timeout: 15_000 },
  )
})
