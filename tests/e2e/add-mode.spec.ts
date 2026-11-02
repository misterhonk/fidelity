import { expect, test, type BrowserContext } from './support/test'

import { readRows, seed } from './seed'

/**
 * Add mode (#233) on a phone: code → pressing → your copy → tray, and undo.
 *
 * Discogs answers from here. What the test counts is the acceptance line of
 * the issue: one request for the barcode, one for a run-out that narrows, and
 * nothing else read — no `/releases`, no `/masters` (rule 2).
 */
test.use({ viewport: { width: 390, height: 844 } })

// Playwright routes a worker's requests in Chromium only (see pressing.spec.ts).
test.skip(
  ({ browserName }) => browserName !== 'chromium',
  "Playwright cannot route a worker's requests in WebKit",
)

const API = 'https://api.discogs.com'

const uk1994 = {
  id: 372340,
  master_id: 5542,
  title: 'Portishead - Dummy',
  year: '1994',
  country: 'UK',
  label: ['Go! Beat'],
  catno: '828 553-1',
  format: ['Vinyl', 'LP', 'Album'],
  thumb: '',
}
const eu2017 = {
  ...uk1994,
  id: 10147986,
  year: '2017',
  country: 'Europe',
  catno: '0602557150995',
}

async function answerDiscogs(context: BrowserContext) {
  const reads: string[] = []
  const writes: string[] = []
  let added = false
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, accept, content-type',
    'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
  }
  await context.route(`${API}/**`, async (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    const url = new URL(request.url())
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        headers: cors,
        body: JSON.stringify(body),
      })

    if (url.pathname === '/database/search') {
      reads.push(url.search)
      const results = url.searchParams.has('barcode') ? [uk1994, eu2017] : [eu2017]
      return json({ pagination: { page: 1, pages: 1, items: results.length }, results })
    }
    // The look before a non-idempotent add goes out (outbox.ts): what is there already.
    if (request.method() === 'GET' && url.pathname.endsWith('/collection/releases/10147986'))
      return json({ releases: added ? [{ id: 10147986, instance_id: 9001 }] : [] })
    if (url.pathname.startsWith('/releases') || url.pathname.startsWith('/masters')) {
      reads.push(url.pathname)
      return json({})
    }
    if (
      request.method() === 'POST' &&
      /\/collection\/folders\/1\/releases\/10147986$/.test(url.pathname)
    ) {
      writes.push(`POST ${url.pathname}`)
      added = true
      return json({ instance_id: 9001, resource_url: '' }, 201)
    }
    // The grade follows the add once the copy has an entry to address.
    if (request.method() === 'POST' && url.pathname.endsWith('/instances/9001/fields/1')) {
      writes.push(`POST ${url.pathname}`)
      return route.fulfill({ status: 204, headers: cors })
    }
    if (request.method() === 'DELETE' && url.pathname.endsWith('/instances/9001')) {
      writes.push(`DELETE ${url.pathname}`)
      return route.fulfill({ status: 204, headers: cors })
    }
    return route.fallback()
  })
  return { reads, writes }
}

test('a barcode, the run-out, a grade, and the record is on the shelf — then taken back', async ({
  page,
  context,
}) => {
  await seed(page, 'en')
  const discogs = await answerDiscogs(context)
  await page.goto('/collection')

  await page.getByRole('button', { name: 'Add record' }).click()
  const sheet = page.getByRole('dialog', { name: 'Add a record' })
  await expect(sheet).toBeVisible()

  await sheet.getByLabel('Barcode or run-out').fill('5012394144777')
  await sheet.getByRole('button', { name: 'Look it up' }).click()

  await expect(sheet.getByRole('button', { name: /Portishead - Dummy 1994 UK/ })).toBeVisible({
    timeout: 15_000,
  })
  await expect(
    sheet.getByRole('button', { name: /Portishead - Dummy 2017 Europe/ }),
  ).toBeVisible()

  // The run-out narrows two pressings to the one in the hand, and picks it.
  await sheet.getByLabel('Run-out, to narrow the list').fill('STERLING 828 553-1 A1')
  await sheet.getByRole('button', { name: 'Narrow' }).click()
  await expect(sheet.getByRole('button', { name: /1994 UK/ })).toHaveCount(0, {
    timeout: 15_000,
  })
  await expect(sheet.getByRole('button', { name: /2017 Europe/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  await sheet.getByRole('button', { name: 'Near Mint (NM or M-)' }).click()
  await sheet.getByRole('button', { name: 'Add to shelf' }).click()

  const tray = sheet.getByTestId('add-tray')
  await expect(tray).toContainText('Portishead - Dummy')
  await expect(tray).toContainText('sent', { timeout: 15_000 })
  expect(discogs.writes[0]).toBe('POST /users/mrtnmlchr/collection/folders/1/releases/10147986')

  // The copy is on the shelf under its real entry, with its grade.
  const fields = await readRows<{ instanceId: number; values: Record<string, string> }>(
    page,
    'fieldValues',
  )
  expect(fields.find((row) => row.instanceId === 9001)?.values['1']).toBe(
    'Near Mint (NM or M-)',
  )

  // Barcode 1, run-out 1, nothing else read.
  expect(discogs.reads).toHaveLength(2)
  expect(discogs.reads.every((read) => read.startsWith('?'))).toBe(true)

  await tray.getByRole('button', { name: 'Undo' }).click()
  await expect(sheet.getByText('Portishead - Dummy taken back.')).toBeVisible()
  await expect
    .poll(() => discogs.writes, { timeout: 15_000 })
    .toContain('DELETE /users/mrtnmlchr/collection/folders/1/releases/10147986/instances/9001')
})

test('the key a and ⌘K open add mode; Back closes it', async ({ page }) => {
  await seed(page, 'en')
  await page.goto('/collection')
  // Mounted, so the app listens for the key.
  await expect(page.getByRole('button', { name: 'Add record' })).toBeVisible()

  await page.keyboard.press('a')
  await expect(page.getByRole('dialog', { name: 'Add a record' })).toBeVisible()
  await expect(page).toHaveURL(/add=1/)
  await page.goBack()
  await expect(page.getByRole('dialog', { name: 'Add a record' })).toHaveCount(0)

  await page.keyboard.press('ControlOrMeta+k')
  await page.getByRole('combobox').fill('add record')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Add a record' })).toBeVisible()
})

test('signed out, neither the key a nor ?add=1 opens add mode', async ({ page }) => {
  await page.goto('/welcome?add=1')
  await expect(page.getByRole('button', { name: /Set it up/ })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Add a record' })).toHaveCount(0)

  await page.keyboard.press('a')
  await expect(page.getByRole('dialog', { name: 'Add a record' })).toHaveCount(0)
})
