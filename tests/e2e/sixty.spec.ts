import { expect, type Page, test } from '@playwright/test'

import { seed } from './seed'

/**
 * Sixty words above the fold (M26.3, docs/05 §4a).
 *
 * The review of 2026-09-12 measured the dig at about 180 words of prose
 * before the first find and the settings pages at 120 to 200: the app was
 * explaining itself in front of the thing it explained. The rule since: a
 * screen may spend **sixty words** on prose above the fold — headings,
 * leads, notes, labels — and what needs more goes behind "Why?", into a
 * plate, or into Settings › Help.
 *
 * "Prose" is counted from the block elements that carry sentences (`p`,
 * `h1`–`h3`, `summary`, `label`, `legend`) inside `main`, above the fold of
 * a laptop screen. What a record says about itself — the rows of a list,
 * the cards of a dig — is data, not prose, and is left out: a shelf of
 * forty titles is not the app talking.
 *
 * Chromium only: it is a count, and one engine's layout is enough for it.
 */
test.skip(({ browserName }) => browserName !== 'chromium', 'a count, one engine is enough')

const BUDGET = 60
const FOLD = { width: 1280, height: 800 }

/** The screens with a head, a lead and a body of their own. */
const ROUTES = [
  '/',
  '/dig',
  '/shelf',
  '/map',
  '/wantlist',
  '/watched',
  '/places',
  '/review',
  '/basket',
  '/saved',
  '/dealers',
  '/in-store',
  '/settings',
  '/settings/hub',
  '/settings/collection',
  '/settings/search',
  '/settings/sync',
  '/settings/data',
  '/settings/account',
]

async function proseAboveTheFold(page: Page) {
  return page.evaluate((fold) => {
    const blocks = document.querySelectorAll<HTMLElement>(
      'main :is(p, h1, h2, h3, summary, label, legend)',
    )
    let words = 0
    const lines: string[] = []
    for (const block of blocks) {
      if (block.closest('article, li, table, [data-prose="data"]')) continue
      const rect = block.getBoundingClientRect()
      if (rect.height === 0 || rect.top > fold) continue
      const text = (block.innerText ?? '').trim()
      if (!text) continue
      const count = text.split(/\s+/).filter((w) => /\p{L}{2,}/u.test(w)).length
      words += count
      lines.push(`${count}: ${text.slice(0, 70)}`)
    }
    return { words, lines }
  }, FOLD.height)
}

test.describe('sixty words', () => {
  test.use({ viewport: FOLD })

  for (const route of ROUTES) {
    test(`${route} explains itself in sixty words or fewer`, async ({ page }) => {
      await seed(page, 'en')
      await page.goto(route)
      await expect(page.locator('main')).toBeVisible()
      await page.waitForTimeout(600)

      const { words, lines } = await proseAboveTheFold(page)
      test
        .info()
        .annotations.push({ type: 'prose', description: `${words} · ${lines.join(' | ')}` })
      expect(words, lines.join('\n')).toBeLessThanOrEqual(BUDGET)
    })
  }
})
