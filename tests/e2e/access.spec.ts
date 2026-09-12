import { expect, test } from '@playwright/test'

import { seed } from './seed'

/**
 * One door on the hub screen (M26.3).
 *
 * The access key had a screen of its own, beside a hub screen with a secret
 * field — and somebody with a key was asked for a secret they did not have.
 * Now there is one field, and the app reads which door the value is: a key
 * starts with `fk1.`, anything else is the secret of a hub you run yourself.
 * This walks the key through it: read, kept, shown on the index, forgotten.
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

test('reads, keeps and forgets an access key on the hub screen', async ({ page }) => {
  await seed(page, 'en')
  await page.goto('/settings/hub')
  const panel = page.locator('section').filter({ has: page.getByLabel('Hub URL') })
  const field = panel.getByLabel('Access key or shared secret')

  // A key that does not decode says so; a secret is never judged.
  await field.fill('fk1.not.a.key')
  await expect(page.getByText('That does not read as an access key.')).toBeVisible()
  await field.fill('a-shared-secret')
  await expect(page.getByText('That does not read as an access key.')).toBeHidden()

  await field.fill(KEY)
  await expect(page.getByText(/Beta key · valid until/)).toBeVisible()
  await expect(field).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: 'Show it' }).click()
  await expect(field).toHaveAttribute('type', 'text')

  await panel.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Saved.', { exact: false })).toBeVisible()

  // The index says what the key is, and a reload keeps it.
  await page.goto('/settings')
  await expect(page.getByText(/Beta key · until/)).toBeVisible()
  await page.goto('/settings/hub')
  await expect(page.getByLabel('Access key or shared secret')).toHaveValue(KEY)

  await page.getByRole('button', { name: 'Remove' }).click()
  await expect(page.getByText('Removed.', { exact: false })).toBeVisible()
  await page.goto('/settings')
  await expect(page.getByText(/Beta key/)).toBeHidden()
})

test('the old address of the access screen leads to the hub', async ({ page }) => {
  await seed(page, 'en')
  await page.goto('/settings/access')
  await expect(page).toHaveURL(/\/settings\/hub$/)
})
