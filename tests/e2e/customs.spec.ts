import { expect, test } from '@playwright/test'

import { putRows, seed, seedDealer } from './seed'

/**
 * A parcel from outside the EU (2026-10-21).
 *
 * The seed's basket is two records, €34 and €21.50, at €4.50 postage — €60.
 * From a shop in the United Kingdom to Germany that is €3 customs (one tariff
 * line: records) and 19 % import VAT on €60, €11.40: €74.40 all in. The
 * arithmetic is `tests/unit/customs.spec.ts`; this is the round trip.
 */
test('a basket from the United Kingdom says what the border adds', async ({ page }) => {
  await seed(page, 'en')
  await putRows(page, { dealers: [{ ...seedDealer, shipsFrom: 'United Kingdom' }] })

  await page.goto('/basket')
  await expect(page.getByText('EU customs, estimated')).toBeVisible()
  await expect(page.getByText('Import VAT 19 %')).toBeVisible()
  await expect(page.getByText('€74.40')).toBeVisible()
})

test('a basket from inside the EU adds nothing', async ({ page }) => {
  await seed(page, 'en')
  await page.goto('/basket')
  await expect(page.getByText('€60.00').first()).toBeVisible()
  await expect(page.getByText('EU customs, estimated')).toHaveCount(0)
})

test('in German too', async ({ page }) => {
  await seed(page, 'de')
  await putRows(page, { dealers: [{ ...seedDealer, shipsFrom: 'United Kingdom' }] })
  await page.goto('/basket')
  await expect(page.getByText('EU-Zoll, geschätzt')).toBeVisible()
  await expect(page.getByText('74,40 €')).toBeVisible()
})
