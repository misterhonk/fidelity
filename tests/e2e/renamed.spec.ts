import { expect, test } from '@playwright/test'

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
  ['/regal', '/shelf'],
  ['/haendler', '/dealers'],
  ['/landkarte', '/map'],
  ['/gemerkt', '/saved'],
  ['/im-laden', '/in-store'],
  ['/willkommen', '/welcome'],
  ['/datenschutz', '/privacy'],
  ['/impressum', '/legal'],
  ['/einstellungen', '/settings'],
  ['/einstellungen/abgleich', '/settings/sync'],
  ['/einstellungen/darstellung', '/settings/appearance'],
  ['/einstellungen/daten', '/settings/data'],
  ['/einstellungen/hilfe', '/settings/help'],
  ['/einstellungen/hub', '/settings/hub'],
  ['/einstellungen/konto', '/settings/account'],
  ['/einstellungen/sammlung', '/settings/collection'],
  ['/einstellungen/suche', '/settings/search'],
] as const

test.describe('an address from before the rename', () => {
  /*
   * Eingerichtet, und zwar für jeden Fall hier.
   *
   * Der Setup-Guard vom 2026-08-14 führt jede geschützte Adresse ohne Token
   * zur Einrichtung — und diese Datei prüft Adressen mit `toHaveURL(/…$/)`.
   * `/welcome?next=/dig` endet auf `/dig`, also **blieben die meisten Tests
   * hier grün, obwohl sie den Umweg maßen statt die Umbenennung.** Nur der
   * eine Fall mit Query fiel auf, weil dort mehr hinter der Adresse steht.
   *
   * Ein Test, der aus dem falschen Grund grün ist, ist schlimmer als einer,
   * der rot ist: er sagt zu, was er nicht mehr prüft. Angemeldet gibt es
   * keinen Umweg, und `$` bedeutet wieder, was es soll.
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
    await expect(page).toHaveURL(/\/settings\/sync/)
  })

  test('leaves an address that was never renamed alone', async ({ page }) => {
    await page.goto('/dig')
    await expect(page).toHaveURL(/\/dig$/)
  })
})
