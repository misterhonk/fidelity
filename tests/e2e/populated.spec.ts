import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

import { seed } from './seed'

/**
 * The screens that only exist when there is something on them.
 *
 * Everything else in this suite runs signed out, which covers the empty states
 * thoroughly and the populated ones not at all — a find list, a match card, a
 * basket that sums postage, a shelf of records. Those are most of the app, and
 * until this file nothing but a person looking at a screen had ever rendered
 * them.
 *
 * Each one runs in both languages, because the failure this is built to catch
 * is invisible in whichever language you happen to be testing in.
 */

/** On a find list and in the basket. */
const RECORD = 'Point of Departure'

/** On the shelf — the collection, which is a different set of records. */
const OWNED = 'Speak No Evil'

test.describe('a device that has been used', () => {
  test('the find list shows what was found', async ({ page }) => {
    const dig = await seed(page, 'en')
    await page.goto(`/dig?id=${dig.id}`)

    // `.first()` because a find list shows each record in the shortlist and
    // again in the long list below it.
    await expect(page.getByText(RECORD).first()).toBeVisible()
    await expect(page.getByText('Unity').first()).toBeVisible()
  })

  test('the basket adds up, and says what the postage does', async ({ page }) => {
    await seed(page, 'en')
    await page.goto('/basket')

    await expect(page.getByText(RECORD).first()).toBeVisible()

    /*
     * 34 + 21.50 + 4.50 postage. The sum is the point of the screen, and a
     * total that renders as NaN or as the subtotal is exactly the sort of
     * thing that survives forever behind an empty state.
     */
    await expect(page.getByText('€60.00')).toBeVisible()
  })

  test('the shelf shows the records on it', async ({ page }) => {
    await seed(page, 'en')
    await page.goto('/shelf')

    await expect(page.getByText('Speak No Evil')).toBeVisible()
    await expect(page.getByText('Maiden Voyage')).toBeVisible()
  })

  /*
   * A tile opens the record, not Discogs.
   *
   * Worth a test of its own because the failure is silent: if the sheet stops
   * finding its record it renders an empty panel, which looks like a slow
   * network rather than a bug. Asserting on a named row proves the worker
   * answered and the layout put the value next to its name.
   */
  test('a record of your own opens with its details named', async ({ page }) => {
    await seed(page, 'en')
    await page.goto('/shelf')

    await page.getByRole('button', { name: /Speak No Evil/ }).click()

    const sheet = page.getByRole('dialog')
    await expect(sheet.getByText('Label', { exact: true })).toBeVisible()
    await expect(sheet.getByText('Blue Note')).toBeVisible()
    await expect(sheet.getByRole('link', { name: /View at Discogs/ })).toHaveAttribute(
      'href',
      /discogs\.com\/release\//,
    )
  })
})

/**
 * The one that would have caught the bug this project already documents.
 *
 * `money()` and `since()` build their `Intl` formatter per call, on purpose,
 * because one built at import freezes whichever language was active when the
 * module loaded. That is written down in CONTRIBUTING as a rule and was until
 * now enforced by nothing — no test had ever rendered a price in two
 * languages, so the frozen-formatter version of this app would have passed
 * every check in the repository.
 *
 * Deliberately not asserting a hardcoded "34,00 €": that would test ICU's
 * output rather than the app's locale choice, and would break on a CLDR update
 * that has nothing to do with this code. What has to be true is narrower and
 * more useful — the same number renders *differently* in the two languages,
 * and each matches what its own locale asks for.
 */
test.describe('the same price in two languages', () => {
  test('follows the language, rather than whichever one loaded first', async ({ page }) => {
    await seed(page, 'en')
    await page.goto('/basket')
    const english = await page.getByText(/34/).first().innerText()

    await seed(page, 'de')
    await page.goto('/basket')
    const german = await page.getByText(/34/).first().innerText()

    expect(english).not.toBe(german)

    // English puts the symbol first and separates decimals with a dot; German
    // does the opposite and ends with the symbol. Both are what their locale
    // asks for, and neither is what the other would produce.
    expect(english).toMatch(/^€\s?34\.00$/)
    expect(german).toMatch(/^34,00\s?€$/)
  })

  test('the page declares the language it is actually in', async ({ page }) => {
    // A German sentence read aloud by an English voice is not an accent, it is
    // unintelligible — and the attribute is the only thing a screen reader has
    // to go on.
    await seed(page, 'de')
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')

    await seed(page, 'en')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  })
})

/**
 * Accessibility, on screens with content.
 *
 * The existing audit covers every screen signed out, and says so honestly. But
 * an empty list has no list items, no covers, no score badges and no feedback
 * buttons — so the controls that come with data had never been audited at all.
 * Both languages, because an accessible name is text like any other.
 */
const POPULATED = [
  { path: '/basket', shows: RECORD },
  { path: '/shelf', shows: OWNED },
] as const

for (const language of ['en', 'de'] as const) {
  for (const { path, shows } of POPULATED) {
    test(`${path} has no axe violations in ${language}, with data on it`, async ({ page }) => {
      await seed(page, language)
      await page.goto(path)

      // Audit the populated screen, not the empty state it renders first. The
      // marker differs per screen: the shelf holds the collection, the basket
      // holds what a dig found, and they are not the same records.
      await expect(page.getByText(shows).first()).toBeVisible()

      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze()

      expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
    })
  }
}
