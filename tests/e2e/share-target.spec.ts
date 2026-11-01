import { expect, test } from './support/test'

import { signIn } from './seed'

/**
 * The two ways into the app from outside it on Android (#218): a long-press
 * shortcut on the icon, and the share sheet. Both are manifest entries the
 * operating system reads at install, so the manifest is what gets checked.
 */
test('the manifest offers the in-shop shortcut and a GET share target', async ({ page }) => {
  await page.goto('/welcome')

  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(href).toBeTruthy()
  const manifest = (await (await page.request.get(new URL(href!, page.url()).href)).json()) as {
    shortcuts?: { name: string; url: string }[]
    share_target?: { action: string; method?: string; params: Record<string, string> }
  }

  expect(manifest.shortcuts).toContainEqual(
    expect.objectContaining({ name: 'In a shop', url: '/in-store' }),
  )
  expect(manifest.share_target).toMatchObject({
    action: '/share',
    method: 'GET',
    params: { title: 'title', text: 'text', url: 'url' },
  })
})

test('a shared Discogs shop page opens that shop', async ({ page }) => {
  await signIn(page)
  // What Chrome on Android sends: the link inside `text`, after the title.
  await page.goto(
    `/share?title=Discogs&text=${encodeURIComponent('fatplastics https://www.discogs.com/seller/fatplastics/profile')}`,
  )

  await expect(page).toHaveURL(/\/dig\?dealer=fatplastics$/)
  await expect(page.locator('main input').first()).toHaveValue('fatplastics')
})

test('a share that names no shop lands on Start', async ({ page }) => {
  await signIn(page)
  await page.goto(
    `/share?text=${encodeURIComponent('https://www.discogs.com/release/636159-Kraftwerk-Das-Model')}`,
  )

  await expect(page).toHaveURL(/\/$/)
})
