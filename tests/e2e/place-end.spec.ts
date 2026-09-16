import { expect, test, type Page } from '@playwright/test'

import { seed } from './seed'

/**
 * A shelf big enough to have boundaries in it.
 *
 * The seed owns two records, and two records across four compartments give a
 * wall with nothing to divide — a pin on the first of them lands exactly where
 * the count already put it, and the plan has no moves to show. Eight artists,
 * one letter each, make every boundary legible.
 */
async function eightRecords(page: Page) {
  await page.evaluate(async () => {
    const open = indexedDB.open('fidelity')
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      open.onsuccess = () => resolve(open.result)
      open.onerror = () => reject(open.error)
    })
    const tx = db.transaction('collection', 'readwrite')
    const store = tx.objectStore('collection')
    const first: Record<string, unknown> = await new Promise((done) => {
      const all = store.getAll()
      all.onsuccess = () => done(all.result[0] as Record<string, unknown>)
    })
    const names = ['Air', 'Bowie', 'Can', 'Dinky', 'Eno', 'Fela', 'Gas', 'Hood']
    names.forEach((name, i) => {
      store.put({
        ...first,
        instanceId: 800_000 + i,
        releaseId: 810_000 + i,
        title: `Record ${i}`,
        artistNames: [name],
        artistNorms: [name.toLowerCase()],
      })
    })
    await new Promise((done) => (tx.oncomplete = done))
    db.close()
  })
}

/**
 * The end of a compartment, set by hand (M27.6).
 *
 * M27.3 left this open on a real objection — "a rule proposes, and a boundary
 * moved by hand would be a second rule". It holds only if a rule is one thing.
 * It is two: it **orders** the records and it **divides** them, and this takes
 * over the dividing alone. The order stays the rule's, which is why nothing
 * here can put a record out of order.
 *
 * Walked in a browser because the whole design is the gesture: you point at
 * the record that should be the last one in the cube, and the compartment
 * lists its records in the rule's order so that there is a sequence to point
 * into. Neither of those is visible from a unit test.
 */
test('ends a compartment where a record says, and deals the rest around it', async ({
  page,
}) => {
  await seed(page, 'en')
  await eightRecords(page)
  await page.goto('/places')

  await page.getByLabel('Add a place').fill('Living room')
  await page.getByRole('button', { name: 'Add a place' }).click()
  const room = page.getByRole('region', { name: 'Living room' })

  await room.getByRole('button', { name: 'Add furniture' }).first().click()
  await room.getByRole('button', { name: 'Kallax 2×2' }).click()
  await room.getByLabel('Name of the furniture').fill('Kallax')
  await room.getByRole('button', { name: 'Add furniture' }).last().click()

  const wall = page.getByRole('grid', { name: 'Kallax' })
  await expect(wall.getByRole('gridcell')).toHaveCount(4)

  // Sort the seeded shelf in, so there are stretches to divide at all.
  await room.getByRole('button', { name: 'Sort in' }).click()
  await room.getByRole('button', { name: 'Apply' }).click()
  await expect(wall.getByRole('button', { name: /^A1, [1-9]/ })).toBeVisible({
    timeout: 15_000,
  })

  /*
   * The compartment says who divided it, and offers to take that over. The
   * sleeves are the answer: the question is which record should be last.
   */
  await wall.getByRole('button', { name: /^A1, / }).click()
  const sheet = page.getByRole('dialog', { name: /Kallax · A1/ })
  await expect(sheet.getByText('by count')).toBeVisible()
  await sheet.getByRole('button', { name: 'Set the end' }).click()
  await expect(sheet.getByText('Tap the record that should be the last one here')).toBeVisible()

  // The first sleeve in the cube — in the rule's order, which is the point.
  const first = sheet.getByRole('button', { name: /^End the compartment after / }).first()
  const spoken = (await first.getAttribute('aria-label'))!.replace(
    'End the compartment after ',
    '',
  )
  await first.click()

  // It now says whose boundary this is, and where it runs to.
  await expect(sheet.getByText('by hand')).toBeVisible()
  await expect(sheet.getByText(`Ends after ${spoken.replace(' — ', ' – ')}`)).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Move the end' })).toBeVisible()
  await page.keyboard.press('Escape')

  // One record in A1, because the end was set after the first one — and the
  // wall marks the cube as having an end somebody chose.
  await room.getByRole('button', { name: 'Sort in' }).click()
  await room.getByRole('button', { name: 'Apply' }).click()
  await expect(wall.getByRole('button', { name: /^A1, 1 records, Ends after / })).toBeVisible({
    timeout: 15_000,
  })

  // And letting go puts that boundary back in the hands of the count.
  await wall.getByRole('button', { name: /^A1, / }).click()
  await sheet.getByRole('button', { name: 'Let it go' }).click()
  await expect(sheet.getByText('by count')).toBeVisible()
  await page.keyboard.press('Escape')

  await room.getByRole('button', { name: 'Sort in' }).click()
  await room.getByRole('button', { name: 'Apply' }).click()
  await expect(wall.getByRole('button', { name: /^A1, [2-9]/ })).toBeVisible({
    timeout: 15_000,
  })
})

/**
 * And the warning, because a pin cannot survive another rule: its key is in
 * the old rule's language, and "bowie low" is not a year.
 */
test('says beforehand that another rule lets go of the ends', async ({ page }) => {
  await seed(page, 'en')
  await eightRecords(page)
  await page.goto('/places')

  await page.getByLabel('Add a place').fill('Living room')
  await page.getByRole('button', { name: 'Add a place' }).click()
  const room = page.getByRole('region', { name: 'Living room' })
  await room.getByRole('button', { name: 'Add furniture' }).first().click()
  await room.getByRole('button', { name: 'Kallax 2×2' }).click()
  await room.getByLabel('Name of the furniture').fill('Kallax')
  await room.getByRole('button', { name: 'Add furniture' }).last().click()

  const warning = 'Changing this also lets go of every end set by hand.'
  const wall = page.getByRole('grid', { name: 'Kallax' })
  await room.getByRole('button', { name: 'Sort in' }).click()
  await room.getByRole('button', { name: 'Apply' }).click()
  await expect(wall.getByRole('button', { name: /^A1, [1-9]/ })).toBeVisible({
    timeout: 15_000,
  })

  // Nothing pinned, nothing to lose, nothing said.
  await expect(page.getByText(warning)).toBeHidden()

  await wall.getByRole('button', { name: /^A1, / }).click()
  const sheet = page.getByRole('dialog', { name: /Kallax · A1/ })
  await sheet.getByRole('button', { name: 'Set the end' }).click()
  // Wait for the mode, not just for the button: until the sleeves have been
  // re-labelled they still answer the old question, and the tap opens a record.
  await expect(sheet.getByText('Tap the record that should be the last one here')).toBeVisible()
  await sheet
    .getByRole('button', { name: /^End the compartment after / })
    .first()
    .click()
  await expect(sheet.getByText('by hand')).toBeVisible()
  await page.keyboard.press('Escape')

  await expect(page.getByText(warning)).toBeVisible()

  // And it is true: another rule lets them go.
  await room.getByRole('button', { name: 'By year' }).click()
  await expect(page.getByText(warning)).toBeHidden()
})
