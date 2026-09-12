import { expect, test } from '@playwright/test'

import { seed } from './seed'

/**
 * A backup read back in on the data screen (M24): what came back is said
 * line by line, and what stayed out and why.
 */
test('reads a backup back in and says what came back', async ({ page }) => {
  await seed(page, 'en')
  await page.goto('/settings/data')

  // A file on disk rather than a buffer built here: the e2e project has no
  // node types, and a fixture is easier to read than a literal anyway.
  await page
    .getByLabel('Read a backup back in')
    .setInputFiles('tests/fixtures/backup/fidelity-backup-2026-09-12.json')
  await expect(page.getByText('Read: 1 shops.')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('1 digs stayed out', { exact: false })).toBeVisible()

  // Not a backup: said so, nothing read.
  await page
    .getByLabel('Read a backup back in')
    .setInputFiles('tests/fixtures/backup/notes.json')
  await expect(page.getByText('That is not a Fidelity backup.')).toBeVisible()
})
