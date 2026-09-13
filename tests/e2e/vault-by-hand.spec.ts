import { expect, test } from '@playwright/test'

import { seed } from './seed'

/**
 * The vault as a file you carry yourself (M29).
 *
 * Reported as "why is there no iCloud option in Safari?" — and it was never
 * about iCloud. The automatic file destination keeps a `FileSystemFileHandle`,
 * which is what lets the file be chosen once, and WebKit has no File System
 * Access API at all. So on an iPhone, and in Safari on a Mac, the one
 * destination that would have used iCloud Drive is not offered.
 *
 * This is the same round with two taps instead of none, and it has to work in
 * every browser there is — which is why this spec, unlike most, is not
 * chromium-only. Nothing here touches Discogs.
 */
test('writes a vault file without a picker, in any browser', async ({ page }) => {
  await seed(page, 'en')
  await page.goto('/settings/sync')

  const byHand = page.getByText('Or by hand, as a file')
  await expect(byHand).toBeVisible({ timeout: 15_000 })

  /*
   * Folded away where the automatic route exists, open where it does not.
   *
   * Chromium has the File System Access API and WebKit has not, so the right
   * state differs by browser — and clicking the summary unconditionally closed
   * it on the one browser the whole feature exists for. Measured, in this
   * spec, on the first WebKit run: the form was there and invisible.
   */
  const save = page.getByRole('button', { name: 'Merge and save a file' })
  if (!(await save.isVisible())) await byHand.click()
  await expect(save).toBeVisible()

  await page.getByLabel('Passphrase').last().fill('a-long-enough-word')
  await expect(save).toBeEnabled()

  // The file arrives as an ordinary download, which is the one way to save
  // something that works everywhere — iOS Safari included.
  const download = page.waitForEvent('download', { timeout: 30_000 })
  await save.click()

  expect((await download).suggestedFilename()).toBe('fidelity-tresor.json')
  await expect(page.getByText(/The file has been saved/)).toBeVisible({ timeout: 15_000 })
})
