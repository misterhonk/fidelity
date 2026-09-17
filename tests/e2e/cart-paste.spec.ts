import { expect, test } from '@playwright/test'

import { seed } from './seed'

/**
 * The pasted cart page (M34.3): copy the Discogs cart, paste it into the
 * basket, and the shop's postage for exactly this many records is the tier
 * the basket adds up with. No request, no listing link needed.
 */
const CART = `Sie haben 2 Artikel in Ihrem Warenkorb von 1 Verkäufer.
Bestellung bei plattenkiste 99.9% positiv (7,681)
Larry Young - Unity (LP, Album)
Tonträger: Near Mint (NM or M-) / Cover: Very Good Plus (VG+)
€5,87 EUR
Bobbi Humphrey - Blacks And Blues (LP, Album)
Tonträger: Very Good Plus (VG+) / Cover: Very Good Plus (VG+)
€12,00 EUR
Ihre Versandadresse
Versand
Standard - Deutsche Post / DHL - €6,50
Delivery in 3 - 5 business days
Add up to 4 more discs/tapes from plattenkiste at no additional shipping cost!
Zahlung
Zwischensumme €17.87 EUR
Versand €6.50 EUR
Gesamt €24.37 EUR
`

test('takes the postage for this basket off a pasted cart page', async ({ page }) => {
  await seed(page, 'en')
  await page.goto('/basket')

  const field = page.getByLabel('Links to records, or the cart page')
  await expect(field).toBeVisible({ timeout: 15_000 })
  await field.fill(CART)
  await page.getByRole('button', { name: 'Take them over' }).click()

  await expect(page.getByText('postage noted for 1 shop')).toBeVisible({ timeout: 15_000 })
  const card = page.locator('section, article').filter({ hasText: 'Plattenkiste' }).first()
  await expect(card.getByText('€6.50')).toBeVisible()
  await expect(card.getByText('(entered by you)')).toBeVisible()
})
