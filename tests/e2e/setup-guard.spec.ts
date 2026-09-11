import { expect, test } from '@playwright/test'

import { signIn } from './seed'

/**
 * Without a token, every route leads to the setup.
 *
 * Until 2026-08-14 the redirect lived in the start page's `onMounted` and
 * applied to exactly one of twelve screens. Anyone opening `/shelf` from a
 * bookmark got a finished page saying "No records here yet. Fetch the
 * collection in the settings." — a statement about the collection where one
 * about the state of the app belongs.
 *
 * The unit test beside this reads the shape. Only a browser knows whether the
 * middleware really takes hold: it asks the worker, and between "has not
 * answered yet" and "not signed in" lies exactly the fault with which a guard
 * like this shuts out everybody who has long been set up.
 *
 * No seeding: the empty database *is* the case under test.
 */
const GESPERRT = ['/shelf', '/wantlist', '/dig', '/dealers', '/basket', '/saved', '/map']

/** Where you may go without a token — the settings above all, because that is
 *  where the token is entered. */
const OFFEN = ['/welcome', '/settings', '/settings/hub', '/privacy', '/legal']

test.describe('without a token', () => {
  for (const path of GESPERRT) {
    test(`${path} leads to the setup`, async ({ page }) => {
      await page.goto(path)
      await page.waitForURL(/\/welcome/, { timeout: 20_000 })

      /*
       * And remembers where somebody was going. Without it the setup always
       * ends on the start page, and anyone who wanted to see their basket goes
       * looking for it by hand afterwards.
       */
      expect(new URL(page.url()).searchParams.get('next')).toBe(path)
    })
  }

  for (const path of OFFEN) {
    test(`${path} stays reachable`, async ({ page }) => {
      await page.goto(path)
      // Wait a moment: a redirect that only arrives after the first frame
      // would otherwise not be visible.
      await page.waitForTimeout(1500)
      expect(new URL(page.url()).pathname).toContain(path)
    })
  }

  /**
   * The start page itself appends no `next`.
   *
   * `?next=/` would be a return to where the button leads anyway — and an
   * address that looks as though something had been missed.
   */
  test('the start screen goes there without a detour note', async ({ page }) => {
    await page.goto('/')
    await page.waitForURL(/\/welcome/, { timeout: 20_000 })
    expect(new URL(page.url()).searchParams.get('next')).toBeNull()
  })
})

/**
 * And anyone who is set up stays where they were going.
 *
 * The most expensive fault in a guard like this is not the forgotten lock — it
 * is the lock that judges too early. `identity` is empty on the first call,
 * because the answer comes from the worker; anyone not waiting for it sends
 * everybody to the setup, including the one with a collection on the shelf.
 *
 * On 2026-08-14 a mutation probe showed exactly that: `await load()` replaced
 * by `void load()`, and all thirteen cases stayed green — because none of them
 * was signed in.
 */
test.describe('with a token', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page)
  })

  for (const path of ['/shelf', '/dealers']) {
    test(`${path} stays put`, async ({ page }) => {
      await page.goto(path)
      await page.waitForTimeout(1500)

      expect(new URL(page.url()).pathname).toBe(path)
    })
  }
})
