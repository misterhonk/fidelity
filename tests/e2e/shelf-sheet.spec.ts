import { expect, test } from './support/test'

import { putRows, readRows, seed, seedCollection } from './seed'

/**
 * Your copy first (M41, #234).
 *
 * The record sheet opens on what is true of *this* copy — rating, condition,
 * place, folder, notes, paid, since — before what the record is. Two copies of
 * one pressing get a switcher, and each says on its own whether Discogs has
 * caught up with it.
 */
test('opens on your copy, keeps what you paid, and switches between two copies', async ({
  page,
}) => {
  await seed(page, 'en')
  const first = seedCollection[0]!
  // A second copy of Speak No Evil, newer than the first.
  await putRows(page, {
    collection: [{ ...first, instanceId: 811_002_777, addedAt: '2025-01-05T10:00:00-00:00' }],
  })
  await page.goto('/collection')

  const row = page.locator('main ul > li', { hasText: 'Speak No Evil' }).first()
  await expect(row).toBeVisible({ timeout: 15_000 })
  await row.getByRole('button').first().click()

  const sheet = page.getByRole('dialog')
  const copy = sheet.getByRole('region', { name: 'Your copy' })
  await expect(copy).toBeVisible({ timeout: 15_000 })

  // Above the facts: the copy section comes before what the record is.
  const about = sheet.getByRole('heading', { name: 'Sounds like' })
  const copyFirst = await copy.evaluate(
    (section, other) =>
      Boolean(section.compareDocumentPosition(other!) & Node.DOCUMENT_POSITION_FOLLOWING),
    await about.elementHandle(),
  )
  expect(copyFirst).toBe(true)

  // Two copies, oldest first; the shelf opened the newer one.
  const which = copy.getByRole('group', { name: 'Which copy' })
  await expect(which.getByRole('button', { name: 'Copy 2' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await which.getByRole('button', { name: 'Copy 1' }).click()
  await expect(which.getByRole('button', { name: 'Copy 1' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  // Per record, not per session: nothing of this copy is waiting.
  await expect(copy.getByTestId('copy-sync')).toHaveText('In step with Discogs')
  // Since: Discogs' "added" until a day is typed.
  await expect(copy.getByLabel('Since')).toHaveValue('2024-03-02')

  // A typed price lands in integer cents, in the currency typed.
  await copy.getByLabel('Currency').fill('eur')
  await copy.getByLabel('Paid').fill('18,5')
  await copy.getByLabel('Paid').press('Enter')
  await copy.getByLabel('Paid').blur()
  await expect(copy.getByLabel('Paid')).toHaveValue('18.50')
  await expect(copy.getByLabel('Currency')).toHaveValue('EUR')
  const rows = await readRows<{ instanceId: number; paid?: unknown }>(page, 'placements')
  expect(rows.find((r) => r.instanceId === first.instanceId)?.paid).toEqual({
    cents: 1850,
    currency: 'EUR',
  })

  // Not a price: said, and nothing stored.
  await copy.getByLabel('Paid').fill('a lot')
  await copy.getByLabel('Paid').blur()
  await expect(copy.getByText('Not a price.')).toBeVisible()

  // The other copy has answers of its own.
  await which.getByRole('button', { name: 'Copy 2' }).click()
  await expect(which.getByRole('button', { name: 'Copy 2' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(copy.getByLabel('Paid')).toHaveValue('')
  await expect(copy.getByLabel('Since')).toHaveValue('2025-01-05')

  await which.getByRole('button', { name: 'Copy 1' }).click()
  await expect(copy.getByLabel('Paid')).toHaveValue('18.50')
})
