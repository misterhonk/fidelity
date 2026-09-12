import { expect, test } from '@playwright/test'

import { seed } from './seed'

/**
 * Settings › Access (M22): a key is read for what it says, saved to the
 * preferences, shown on the index with its tier and end date, and removed
 * again. No network — the verdict is the hub's, and the hub is not here.
 */
const payload = btoa(
  JSON.stringify({
    kid: 'cafe0123',
    sub: 'tester',
    tier: 'beta',
    iat: 1_800_000_000,
    exp: 4_000_000_000,
  }),
)
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/, '')
const KEY = `fk1.${payload}.c2lnbmF0dXJl`

test('reads, keeps and forgets an access key', async ({ page }) => {
  await seed(page, 'en')
  await page.goto('/settings/access')

  const field = page.getByLabel('Access key')
  await field.fill('not a key at all')
  await expect(page.getByText('That does not read as an access key.')).toBeVisible()

  await field.fill(KEY)
  await expect(page.getByText(/Beta key · valid until/)).toBeVisible()
  await expect(field).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: 'Show the key' }).click()
  await expect(field).toHaveAttribute('type', 'text')

  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Saved.', { exact: false })).toBeVisible()

  // The index says what the key is, and a reload keeps it.
  await page.goto('/settings')
  await expect(page.getByText(/Beta key · until/)).toBeVisible()
  await page.goto('/settings/access')
  await expect(page.getByLabel('Access key')).toHaveValue(KEY)

  await page.getByRole('button', { name: 'Remove the key' }).click()
  await expect(page.getByText('Removed.', { exact: false })).toBeVisible()
  await page.goto('/settings')
  await expect(page.getByText('No key')).toBeVisible()
})
