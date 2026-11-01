import { expect, test } from '@playwright/test'

/**
 * The token step explains itself (#213): what a token is, where it is made,
 * and a Paste button, because long-pressing a 40-character field on a phone
 * is where people gave up.
 *
 * Chromium only: Playwright grants clipboard permissions there and nowhere
 * else, and Discogs is answered from here, which WebKit cannot route.
 */
test.skip(
  ({ browserName }) => browserName !== 'chromium',
  'Playwright grants clipboard-read only in Chromium',
)

test('pastes the token, shows it on request, and says where to revoke it', async ({
  page,
  context,
}) => {
  await context.route('https://api.discogs.com/**', (route) =>
    route.fulfill({ status: 404, headers: { 'access-control-allow-origin': '*' }, body: '{}' }),
  )
  await page.goto('/welcome')
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: new URL(page.url()).origin,
  })
  await page.getByRole('button', { name: 'Set it up with your collection' }).click()

  await expect(page.getByText('A token works like a password')).toBeVisible()
  await expect(page.getByRole('img', { name: /Generate new token/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Revoke it/ })).toHaveAttribute(
    'href',
    'https://www.discogs.com/settings/developers',
  )

  await page.evaluate(() => navigator.clipboard.writeText('  pasted-token-123  '))
  await page.getByRole('button', { name: 'Paste' }).click()

  const field = page.getByLabel('Personal access token')
  await expect(field).toHaveValue('pasted-token-123')
  await expect(field).toHaveAttribute('type', 'password')

  await page.getByRole('button', { name: 'Show' }).click()
  await expect(field).toHaveAttribute('type', 'text')
  await expect(page.getByRole('button', { name: 'Show' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})
