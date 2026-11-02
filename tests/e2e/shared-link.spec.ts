import { expect, test } from './support/test'

import { seed } from './seed'

/**
 * A find list shared without a hub (#249).
 *
 * Made on a seeded device, opened in a fresh browser that has never seen
 * Sleeveside — no token, no collection, no hub. The link alone has to carry
 * the list, and it must not carry a price, a condition or the shop's name.
 */
test('a shared list opens without a token, a hub or a price', async ({ page, browser }) => {
  // Neither a share sheet nor a clipboard prompt: the link stays in the field.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined })
  })
  const dig = await seed(page)
  await page.goto(`/shop?id=${dig.id}`)

  // The share plate lives under "Shop" since #223.
  await page.getByRole('button', { name: 'Shop', exact: true }).click()
  await page.getByRole('button', { name: 'Share this list' }).click()
  const field = page.getByRole('textbox', { name: 'Share this list' })
  await expect(field).toHaveValue(/\/shared#d=[A-Za-z0-9_-]+$/)
  const url = await field.inputValue()

  const stranger = await browser.newContext()
  try {
    const other = await stranger.newPage()
    await other.goto(url)

    await expect(
      other.getByRole('heading', { level: 1, name: 'A list of finds' }),
    ).toBeVisible()
    await expect(other.getByText('Andrew Hill – Point of Departure')).toBeVisible()
    await expect(other).toHaveURL(/\/shared#d=/)

    const main = other.locator('main')
    await expect(main).not.toContainText('plattenkiste')
    await expect(main).not.toContainText('Near Mint')
    await expect(main).not.toContainText('€')

    // The way to the record leads to Discogs, the way in to the demo.
    await expect(other.getByRole('link', { name: /View at Discogs/ }).first()).toHaveAttribute(
      'href',
      /discogs\.com\/sell\/item\/3204119887/,
    )
    await expect(other.getByRole('link', { name: 'What is Sleeveside?' })).toHaveAttribute(
      'href',
      '/welcome',
    )

    // Both notices Discogs prescribes.
    await expect(
      other.locator('footer').getByRole('link', { name: 'Data provided by Discogs' }),
    ).toBeVisible()
    await expect(
      other.getByText(/is not affiliated with, sponsored or endorsed by Discogs/),
    ).toBeVisible()
  } finally {
    await stranger.close()
  }
})

/** The top find as a picture (#250): drawn here, from shapes and words, never a cover. */
test('the share card is drawn on the device, without a Discogs image', async ({ page }) => {
  // No share sheet: the card stays on screen, to be saved by hand.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined })
    Object.defineProperty(navigator, 'canShare', { value: undefined })
  })
  const covers: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('i.discogs.com')) covers.push(request.url())
  })
  const dig = await seed(page)
  await page.goto(`/shop?id=${dig.id}`)
  await page.getByRole('button', { name: 'Shop', exact: true }).click()
  await page.getByRole('button', { name: 'Share this list' }).click()

  const before = covers.length
  await page.getByRole('button', { name: 'Share the top find as a picture' }).click()
  const card = page.getByRole('img', { name: /The top find as a picture/ })
  await expect(card).toHaveAttribute('src', /^blob:/)
  await expect.poll(() => card.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1080)
  expect(covers.length).toBe(before)
})

test('a link with nothing after the # says so', async ({ page }) => {
  await page.goto('/shared')
  await expect(page.getByText('Something is missing from this link')).toBeVisible()
})
