import { expect, test } from '@playwright/test'

import { freshDig, putRows, seed, seedMatches } from './seed'

/**
 * No price past its six hours, on the screen (rule 4).
 *
 * Found on 2026-10-21: /dig decided "expired" once, on load, with a
 * `Date.now()` inside a `computed`, and the cards rendered `match.price`
 * whatever that decided. A dig opened after its deadline showed the old
 * prices beside the "expired" notice until the keeper's sweep happened to
 * run; a dig left open past it showed them for as long as the tab stayed.
 *
 * The price is matched as a number with two decimals, not a locale string —
 * the same reasoning as `populated.spec.ts`.
 */
const PRICE = /34[.,]00/

test('a dig opened after its six hours shows the find and not its price', async ({ page }) => {
  await seed(page, 'en')
  const now = Date.now()
  const dig = freshDig(now)
  // The state an interrupted dig was left in: marked expired by something
  // else, its rows never stripped.
  await putRows(page, {
    digs: [{ ...dig, status: 'expired', expiresAt: now - 60_000 }],
    matches: seedMatches(dig.id),
  })

  await page.goto(`/dig?id=${dig.id}`)
  await expect(page.getByText('Point of Departure').first()).toBeVisible()
  await expect(page.locator('main').getByText(PRICE)).toHaveCount(0)
})

test('a dig left open past its six hours takes the price down', async ({ page }) => {
  await seed(page, 'en')
  const now = Date.now()
  const dig = freshDig(now)
  // Real time, not `page.clock`: the worker keeps its own clock, and the
  // deadline has to pass for both of them.
  await putRows(page, {
    digs: [{ ...dig, expiresAt: now + 8_000 }],
    matches: seedMatches(dig.id),
  })

  await page.goto(`/dig?id=${dig.id}`)
  await expect(page.locator('main').getByText(PRICE).first()).toBeVisible()

  await expect(page.locator('main').getByText(PRICE)).toHaveCount(0, { timeout: 20_000 })
  await expect(page.getByText('Point of Departure').first()).toBeVisible()
})

/*
 * The basket, the same rule (found 2026-10-31).
 *
 * The view is loaded once per session for the nav badge, and the screen used
 * it as it found it: a line priced at 08:30 still showed its price at 15:00.
 * One test for coming back to the screen, one for leaving it open.
 */
const BASKET_PRICE = /41[.,]50/
const SIX_HOURS = 6 * 60 * 60 * 1000

const basketLine = (pricedAt: number) => ({
  listingId: 3_300_000_002,
  dealer: 'zweitplatten',
  releaseId: 9_913_001,
  title: 'Bobby Hutcherson — Dialogue',
  price: 41.5,
  currency: 'EUR',
  addedAt: pricedAt,
  pricedAt,
  note: null,
})

test('a basket visited after its six hours shows the line and not its price', async ({
  page,
}) => {
  await seed(page, 'en')
  await putRows(page, { basket: [basketLine(Date.now() - SIX_HOURS + 4_000)] })

  // The nav loads the basket here, while the price is still good.
  await page.goto('/')
  await expect(page.locator('nav a[href$="/basket"]').first()).toBeVisible()
  // Real time, as above: the worker's clock has to pass the deadline too.
  await page.waitForTimeout(5_000)

  await page.locator('nav a[href$="/basket"]').first().click()
  await expect(page.getByText('Bobby Hutcherson — Dialogue')).toBeVisible()
  await expect(page.locator('main').getByText(BASKET_PRICE)).toHaveCount(0)
})

test('a basket left open past its six hours takes the price down', async ({ page }) => {
  await seed(page, 'en')
  await putRows(page, { basket: [basketLine(Date.now() - SIX_HOURS + 8_000)] })

  await page.goto('/basket')
  await expect(page.locator('main').getByText(BASKET_PRICE).first()).toBeVisible()

  await expect(page.locator('main').getByText(BASKET_PRICE)).toHaveCount(0, { timeout: 20_000 })
  await expect(page.getByText('Bobby Hutcherson — Dialogue')).toBeVisible()
})
