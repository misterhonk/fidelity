import { expect, test } from '@playwright/test'

import { putRows, seed, seedDealer } from './seed'

/**
 * A shop that prices postage by grams (2026-09-13).
 *
 * "Es gibt Händler die haben als Versandstaffel Gewichte hinterlegt" —
 * Vinylvoorelkaar, whose table reads `1 bis 1999 Gramm: 14,00 €`. Fidelity's
 * table is per record and there is no honest conversion: an LP with its sleeve
 * and a mailer is anywhere between 250 and 500 grams, and picking a number
 * would be a guess somebody plans a purchase around.
 *
 * So the shape is named rather than refused in silence, and the shop's own
 * words are put next to the form — which is the difference between "Fidelity
 * cannot read this" and two minutes of typing.
 */
const GRAMS = [
  'Standard - postnl: 3-5 Werktage',
  '1 bis 1999 Gramm: 14,00 €',
  '2000 bis 4999 Gramm: 24,50 €',
  'Ab 5000 Gramm: 34,00 €',
].join('\n')

test('a shop that bills by weight says so, and hands over its own words', async ({ page }) => {
  await seed(page, 'en')

  // The seeded shop carries a hand-entered table; this one does not, and its
  // free text is a weight table no parser will ever read into records.
  await putRows(page, {
    dealers: [{ ...seedDealer, shippingTiers: [], shippingNote: GRAMS }],
  })

  await page.goto('/basket')

  const label = page.getByText('This shop charges by weight')
  await expect(label).toBeVisible({ timeout: 15_000 })

  // Folded away until asked — the card is about what the records cost.
  await expect(page.getByText(/a record has no fixed weight/)).toBeHidden()
  await label.click()

  await expect(page.getByText(/a record has no fixed weight/)).toBeVisible()
  await expect(page.getByText('What the shop says about postage')).toBeVisible()
  // Verbatim, so it can be read off and typed in.
  await expect(page.getByText('2000 bis 4999 Gramm: 24,50 €')).toBeVisible()
})
