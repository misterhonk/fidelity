import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// Relative rather than `#shared`: Playwright resolves modules on its own and
// does not read Nuxt's generated path aliases.
import { healthResponseSchema } from '../../shared/schemas/health'

/**
 * The M0 smoke test: a fresh clone builds, boots, talks to PostgreSQL and
 * renders an accessible page. Nothing is mocked.
 */
test.describe('smoke', () => {
  test('the health endpoint reports a reachable database', async ({ request }) => {
    const response = await request.get('/api/health')

    expect(response.status(), 'health should be 200 — is the database up?').toBe(200)
    expect(response.headers()['cache-control']).toContain('no-store')

    const body = healthResponseSchema.parse(await response.json())
    expect(body.status).toBe('ok')
    expect(body.checks.database.ok).toBe(true)
    expect(body.checks.database.latencyMs).not.toBeNull()
  })

  test('the entry screen renders with the design tokens applied', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveTitle('Championship · Fidelity')
    await expect(page.getByRole('heading', { level: 1, name: 'Fidelity' })).toBeVisible()

    // Ten signal chips — S1 and S2 share a colour, so eleven signals need ten.
    await expect(page.getByRole('list', { name: 'Die Match-Signale' })).toBeVisible()
    await expect(page.getByRole('listitem')).toHaveCount(10)

    // A token that only resolves if tokens.css reached the @theme block.
    const accent = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--color-fid-sig-credit')
        .trim(),
    )
    expect(accent).not.toBe('')
  })

  test('the entry screen has no axe violations', async ({ page }) => {
    await page.goto('/')

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()

    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })
})
