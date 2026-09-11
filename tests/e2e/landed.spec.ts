import { expect, test } from '@playwright/test'

import { seed } from './seed'

/**
 * What a record costs with its postage, on the find list (docs/06 M19 #1).
 *
 * The seed has a shop with a hand-entered table — 1–3 records €4.50, 4 and
 * more €7 — and both of the dig's finds already in that shop's basket. So each
 * find is the parcel's own record, taken out of the count before the
 * arithmetic, and adds nothing: the number beside the price is the price.
 * That is the case worth pinning, because the obvious mistake — charging a
 * record for the tier it already sits in — would print €38.50 here.
 *
 * The arithmetic itself is `tests/unit/landed.spec.ts`; this is the round
 * trip through the worker (`basket.landed`), the page and the card.
 */
test.describe('the find list, with postage', () => {
  test('says what a record costs once it is in the parcel', async ({ page }) => {
    const dig = await seed(page, 'en')
    await page.goto(`/dig?id=${dig.id}`)

    await expect(page.getByText('€34.00 with postage').first()).toBeVisible()
    await expect(page.getByText('€21.50 with postage').first()).toBeVisible()
    // The shop's postage is known, so the line explaining its absence is not there.
    await expect(page.getByText('Postage for this shop is not known')).toHaveCount(0)
  })

  test('in German too', async ({ page }) => {
    const dig = await seed(page, 'de')
    await page.goto(`/dig?id=${dig.id}`)

    await expect(page.getByText('34,00 € mit Porto').first()).toBeVisible()
  })
})
