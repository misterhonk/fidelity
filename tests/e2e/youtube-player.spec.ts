import { expect, type Page, test } from './support/test'

import { DEFAULT_PREFERENCES } from '~~/db/meta'

import { putRows, seed } from './seed'

/**
 * The postMessage path to the player (#203), against a stand-in for YouTube.
 *
 * No Google script runs in this origin, so the frame is driven by hand: knock
 * with `listening` until it answers, then send commands to its origin. The
 * stub answers like the real embed and keeps every command it receives.
 */
const STUB = `<!doctype html><script>
  window.commands = []
  addEventListener('message', (event) => {
    const data = JSON.parse(event.data)
    if (data.event === 'listening' && ANSWER) {
      parent.postMessage(JSON.stringify({ event: 'onReady', id: data.id }), '*')
    }
    if (data.event === 'command') window.commands.push({ func: data.func, args: data.args })
  })
</script>`

async function openWithSound(page: Page, answer: boolean) {
  await page.route('https://www.youtube-nocookie.com/embed/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: STUB.replace('ANSWER', String(answer)),
    }),
  )
  // Everything else Google would load stays out.
  await page.route(/ytimg\.com|googlevideo\.com|www\.youtube\.com/, (route) => route.abort())

  await seed(page, 'en')
  await putRows(page, {
    meta: [
      {
        key: 'preferences',
        value: { ...DEFAULT_PREFERENCES, shipsToCountry: 'Germany', audioPreview: true },
      },
    ],
  })
  await page.goto('/')
  await page
    .getByRole('button', { name: /Open .*Point of Departure/i })
    .first()
    .click()
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible({ timeout: 15_000 })
  return sheet
}

test('passes the next clip to the standing player, and pauses it on stop', async ({ page }) => {
  const sheet = await openWithSound(page, true)

  const refuge = sheet.getByRole('button', { name: 'Andrew Hill - Refuge' })
  await expect(refuge).toBeVisible({ timeout: 15_000 })
  await refuge.click()

  // Built once, with the first id and autoplay.
  const frame = page.locator('iframe[src*="youtube-nocookie.com/embed/"]')
  await expect(frame).toHaveCount(1, { timeout: 15_000 })
  await expect(frame).toHaveAttribute('src', /\/embed\/MpmbntGDyNE\?.*autoplay=1/)

  const commands = async () => {
    const player = page.frames().find((f) => f.url().includes('youtube-nocookie.com/embed/'))
    return player
      ? player.evaluate(() => (window as unknown as { commands: unknown[] }).commands)
      : []
  }

  // The next clip goes to the same frame, by command.
  await sheet.getByRole('button', { name: 'Andrew Hill - New Monastery' }).click()
  await expect
    .poll(commands, { timeout: 15_000 })
    .toEqual([{ func: 'loadVideoById', args: ['Cawyll0pOI4'] }])
  await expect(frame).toHaveCount(1)

  // Tapping what plays stops it.
  await sheet.getByRole('button', { name: 'Andrew Hill - New Monastery' }).click()
  await expect.poll(commands, { timeout: 15_000 }).toEqual([
    { func: 'loadVideoById', args: ['Cawyll0pOI4'] },
    { func: 'pauseVideo', args: [] },
  ])
})

test('takes a player that never answers out of the page', async ({ page }) => {
  // SILENT_MS is 15 s; the frame must be gone shortly after.
  test.setTimeout(60_000)
  const sheet = await openWithSound(page, false)

  const refuge = sheet.getByRole('button', { name: 'Andrew Hill - Refuge' })
  await expect(refuge).toBeVisible({ timeout: 15_000 })
  await refuge.click()

  const frame = page.locator('iframe[src*="youtube-nocookie.com/embed/"]')
  await expect(frame).toHaveCount(1, { timeout: 15_000 })
  // Built with autoplay: a late load must have no hidden frame to play in.
  await expect(frame).toHaveCount(0, { timeout: 25_000 })
})
