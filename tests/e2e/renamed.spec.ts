import { expect, test } from './support/test'

import { signIn } from './seed'

/**
 * The addresses this app used to have.
 *
 * Renaming every screen from German to English (ADR-010) broke three things
 * unless something catches them, and only one of the three is obvious.
 *
 * Bookmarks and shortcuts are the obvious one. The third is the vault: its
 * Dropbox and Google Drive flows return to a redirect URL that the *user*
 * registered at the provider, and it was `/einstellungen/abgleich`. That
 * registration cannot be changed from inside this app, and a provider answers
 * a mismatch by refusing the exchange outright — so that address has to keep
 * working, **with its query intact**, for as long as anybody has one.
 */

const MOVED = [
  ['/korb', '/basket'],
  ['/regal', '/collection'],
  ['/haendler', '/shops'],
  ['/landkarte', '/insights'],
  ['/gemerkt', '/saved'],
  ['/im-laden', '/in-store'],
  ['/willkommen', '/welcome'],
  ['/datenschutz', '/privacy'],
  ['/impressum', '/legal'],
  ['/einstellungen', '/settings'],
  ['/einstellungen/abgleich', '/settings/account#sync'],
  ['/einstellungen/darstellung', '/settings/look'],
  ['/einstellungen/daten', '/settings/account#data'],
  ['/einstellungen/hilfe', '/settings/help'],
  ['/einstellungen/hub', '/settings/advanced'],
  ['/einstellungen/konto', '/settings/account'],
  ['/einstellungen/sammlung', '/settings/collection'],
  ['/einstellungen/suche', '/settings/finds'],
  // Nine settings pages became five and an advanced one (#229).
  ['/settings/search', '/settings/finds'],
  ['/settings/appearance', '/settings/look'],
  ['/settings/hub', '/settings/advanced'],
  ['/settings/access', '/settings/advanced'],
  ['/settings/sync', '/settings/account#sync'],
  ['/settings/data', '/settings/account#data'],
  // The new navigation (#228): the shop is the unit, the collection the other.
  ['/dig', '/shop'],
  ['/dealers', '/shops'],
  ['/shelf', '/collection'],
  ['/map', '/insights'],
  ['/review', '/insights/year'],
] as const

test.describe('an address from before the rename', () => {
  /*
   * Signed in, and for every case here.
   *
   * The setup guard from 2026-08-14 leads every protected address without a
   * token to the setup — and this file checks addresses with
   * `toHaveURL(/…$/)`. `/welcome?next=/dig` ends in `/dig`, so **most tests
   * here stayed green while measuring the detour rather than the rename.**
   * Only the one case with a query showed up, because there is more after the
   * address there.
   *
   * A test that is green for the wrong reason is worse than one that is red:
   * it promises what it no longer checks. Signed in there is no detour, and
   * `$` means what it should again.
   */
  test.beforeEach(async ({ page }) => {
    await signIn(page)
  })

  for (const [old, moved] of MOVED) {
    test(`${old} still arrives at ${moved}`, async ({ page }) => {
      await page.goto(old)
      await expect(page).toHaveURL(new RegExp(`${moved}$`))
    })
  }

  test('a trailing slash arrives too', async ({ page }) => {
    // Hand-typed addresses grow one, and some clients add it.
    await page.goto('/korb/')
    await expect(page).toHaveURL(/\/basket$/)
  })

  /**
   * The property that would otherwise have cost somebody their vault.
   *
   * `?code=…` is the whole content of an OAuth return. A redirect that drops it
   * looks like it worked and leaves the exchange unfinished, with no error
   * anywhere — the screen simply never connects.
   *
   * Checked on `/korb` rather than on the vault's own address, deliberately.
   * `/settings/sync` reads the code and then strips it from the address bar on
   * purpose (a credential has no business in a history entry), so asserting
   * there would be a race against that cleanup — green or red depending on
   * which ran first. This tests the redirect, which is the part that could be
   * wrong.
   */
  test('carries the query across, because an OAuth return is nothing without it', async ({
    page,
  }) => {
    await page.goto('/korb?code=abc123&state=xyz')
    await expect(page).toHaveURL(/\/basket\?/)

    const url = new URL(page.url())
    expect(url.searchParams.get('code')).toBe('abc123')
    expect(url.searchParams.get('state')).toBe('xyz')
  })

  test('sends the vault’s own old address to the page that finishes the exchange', async ({
    page,
  }) => {
    await page.goto('/einstellungen/abgleich?code=abc123')
    await expect(page).toHaveURL(/\/settings\/account/)
  })

  /** The registered redirect URI is still /settings/sync (app/utils/pkce.ts). */
  test('sends the registered OAuth address to the page that holds the vault', async ({
    page,
  }) => {
    await page.goto('/settings/sync?code=abc123')
    await expect(page).toHaveURL(/\/settings\/account/)
    await expect(page.locator('#sync')).toBeVisible()
  })

  test('keeps a hash the old address already had', async ({ page }) => {
    await page.goto('/settings/search#dealers')
    await expect(page).toHaveURL(/\/settings\/finds#dealers$/)
  })

  /**
   * A shop and a dig are addressed by their query (#228) — a static host has
   * no route per shop — so the query is the whole of the old link.
   */
  test('a link to a dig still opens that shop', async ({ page }) => {
    await page.goto('/dig?dealer=fatplastics')
    await expect(page).toHaveURL(/\/shop\?dealer=fatplastics$/)
  })

  test('leaves an address that was never renamed alone', async ({ page }) => {
    await page.goto('/wantlist')
    await expect(page).toHaveURL(/\/wantlist$/)
  })
})
