import { expect, test, type Page } from './support/test'

import { seed } from './seed'

/**
 * The in-store screen on a phone (#225): one field that tells barcode,
 * catalogue number and text apart, a big scan button in thumb reach, dark by
 * default — and a barcode typed without signal looked up once it is back.
 */
test.use({ viewport: { width: 390, height: 844 }, colorScheme: 'light' })

const field = (page: Page) =>
  page.getByRole('textbox', { name: 'Barcode, catalogue number or name' })

test('one field at the bottom, a big scan button beside it, dark by default', async ({
  page,
}) => {
  await seed(page, 'en')
  await page.goto('/in-store')
  await expect(field(page)).toBeVisible({ timeout: 15_000 })

  // In thumb reach: the lower half of the screen, and the scan button 44 px or more.
  const box = await field(page).boundingBox()
  expect(box!.y).toBeGreaterThan(844 / 2)
  // …and above the nav bar, not under it.
  const nav = await page.getByRole('navigation', { name: 'Main sections' }).boundingBox()
  expect(box!.y + box!.height).toBeLessThanOrEqual(nav!.y)
  const scan = page.getByRole('button', { name: 'Read a barcode' })
  await expect(scan).toBeVisible()
  expect((await scan.boundingBox())!.height).toBeGreaterThanOrEqual(44)

  // A real colour, not color-scheme: that read dark over a light screen.
  // The browser emulates a light OS here; the dark end of the ramp is #050402.
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toMatch(
    /^(rgb\(5, 4, 2\)|oklch\(0\.105 0\.008 70\))$/,
  )
  // …and the installed app's status bar with it.
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#050402')

  const kind = page.locator('#in-store-kind')
  await field(page).fill('Portishead')
  await expect(kind).toHaveText('An artist or a title, searched as you type.')
  await field(page).fill('828 553-1 A1')
  await expect(kind).toHaveText('A catalogue or run-out number. Look it up for the pressing.')
  await field(page).fill('5012394144777')
  await expect(kind).toHaveText('A barcode. Look it up for the pressings.')
})

test('back to the top floats above the field, not over it', async ({ page }) => {
  await seed(page, 'en')
  await page.goto('/in-store')
  await expect(field(page)).toBeVisible({ timeout: 15_000 })

  // Two screens down, however long the seed's list is: ToTop's own threshold.
  await page.evaluate(() => {
    document.body.style.paddingBottom = '3000px'
    window.scrollTo(0, document.body.scrollHeight)
  })
  const toTop = page.getByRole('button', { name: 'Back to the top' })
  await expect(toTop).toBeVisible()

  const button = (await toTop.boundingBox())!
  const bar = (await page.getByTestId('in-store-field').boundingBox())!
  expect(button.y + button.height).toBeLessThanOrEqual(bar.y)
})

test('a barcode typed without signal is looked up once the signal is back', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', "Playwright cannot route a worker's requests in WebKit")
  await seed(page, 'en')
  await page.context().route('https://api.discogs.com/database/search**', (route) =>
    route.request().method() === 'OPTIONS'
      ? route.fulfill({
          status: 204,
          headers: {
            'access-control-allow-origin': '*',
            'access-control-allow-headers': 'authorization, accept, content-type',
          },
        })
      : route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'access-control-allow-origin': '*' },
          body: JSON.stringify({ pagination: { page: 1, pages: 1, items: 0 }, results: [] }),
        }),
  )
  await page.goto('/in-store')
  await expect(field(page)).toBeVisible({ timeout: 15_000 })

  /*
   * One lookup with signal first, as on the way to the shop. Without a
   * service worker in the test, the worker's lookup code is fetched on first
   * use — and a chunk that failed to load offline stays failed in Chromium.
   */
  await field(page).fill('4006381333931')
  await page.getByRole('button', { name: 'Look it up' }).click()
  await expect(page.getByText('Discogs knows no record with this barcode.')).toBeVisible({
    timeout: 15_000,
  })

  await page.context().setOffline(true)
  await field(page).fill('5012394144777')
  await page.getByRole('button', { name: 'Keep for later' }).click()
  await expect(page.getByText('1 waiting for signal.', { exact: false })).toBeVisible()

  await page.context().setOffline(false)
  await expect(page.getByText('Looked up once the signal came back')).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByText('1 waiting for signal.', { exact: false })).toHaveCount(0)
  await page.getByRole('button', { name: /Not in your collection.*5012394144777/ }).click()
  await expect(page.getByText('Discogs knows no record with this barcode.')).toBeVisible()
})

/* The spacer at the list's end is as tall as the bar it makes room for (#313). */
test('the end of the list clears the field', async ({ page }) => {
  await seed(page, 'en')
  await page.goto('/in-store')
  await expect(field(page)).toBeVisible({ timeout: 15_000 })

  const bar = page.getByTestId('in-store-field')
  const spacer = page.getByTestId('in-store-spacer')
  await expect
    .poll(async () => (await spacer.boundingBox())!.height)
    .toBeGreaterThanOrEqual((await bar.boundingBox())!.height)
})
