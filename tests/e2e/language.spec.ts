import { expect, test, type Page } from '@playwright/test'

/**
 * Which language the app opens in, and when it decides.
 *
 * Worth a browser rather than a unit test for one reason: the decision has to
 * be made *before* anything is drawn. A German reader who sees one frame of
 * English has watched the app change its mind, and no assertion about the
 * settings screen would catch that — the end state is correct either way.
 *
 * The settings page is used as the specimen because it names itself in its
 * heading and its title, and because it says so signed out as well. Nothing
 * here needs an account.
 */

/** The heading, and every value it has ever had. */
async function everyHeading(page: Page) {
  return page.evaluate(() => (window as unknown as { __h1s: string[] }).__h1s)
}

/**
 * Record the heading from the first moment it exists.
 *
 * A `toHaveText` assertion only ever sees the settled value. This watches
 * every mutation from before the app mounts, so a heading that said
 * "Appearance" for two frames before becoming "Darstellung" is visible as a
 * list with two entries rather than one.
 */
const watchHeadings = () => {
  const seen: string[] = []
  ;(window as unknown as { __h1s: string[] }).__h1s = seen

  const record = () => {
    const text = document.querySelector('h1')?.textContent?.trim()
    if (text && text !== seen.at(-1)) seen.push(text)
  }

  // `document`, not `document.documentElement`. An init script runs before the
  // root element exists, and observing null throws — which silently costs the
  // whole script, leaving an empty list that looks like a clean pass.
  new MutationObserver(record).observe(document, {
    subtree: true,
    childList: true,
    characterData: true,
  })
  record()
}

test.describe('English is what somebody gets who has not said otherwise', () => {
  test.use({ locale: 'en-GB' })

  test('the interface, the title and the lang attribute all say English', async ({ page }) => {
    await page.addInitScript(watchHeadings)
    await page.goto('/einstellungen/darstellung')

    await expect(page.getByRole('heading', { level: 1, name: 'Appearance' })).toBeVisible()
    await expect(page).toHaveTitle('Appearance · Fidelity')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  })
})

test.describe('German, when the device asks for it', () => {
  test.use({ locale: 'de-DE' })

  test('is picked without anybody choosing it', async ({ page }) => {
    await page.goto('/einstellungen/darstellung')

    await expect(page.getByRole('heading', { level: 1, name: 'Darstellung' })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  })

  test('is there from the first frame, not after one of English', async ({ page }) => {
    await page.addInitScript(watchHeadings)
    await page.goto('/einstellungen/darstellung')

    await expect(page.getByRole('heading', { level: 1, name: 'Darstellung' })).toBeVisible()

    // The whole point. If the pack were fetched after mounting, this would be
    // ['Appearance', 'Darstellung'] — correct in the end, and a visible flinch.
    expect(await everyHeading(page)).toEqual(['Darstellung'])
  })
})

test.describe('a language somebody chose', () => {
  test.use({ locale: 'de-DE' })

  test('outranks the one the device asks for', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('fidelity:language', 'en'))
    await page.goto('/einstellungen/darstellung')

    await expect(page.getByRole('heading', { level: 1, name: 'Appearance' })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  })

  test('survives a reload', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('fidelity:language', 'en'))
    await page.goto('/einstellungen/darstellung')
    await page.reload()

    await expect(page.getByRole('heading', { level: 1, name: 'Appearance' })).toBeVisible()
  })
})

test.describe('a language nothing here speaks', () => {
  test.use({ locale: 'fr-FR' })

  test('falls back to English rather than to nothing', async ({ page }) => {
    await page.goto('/einstellungen/darstellung')
    await expect(page.getByRole('heading', { level: 1, name: 'Appearance' })).toBeVisible()
  })
})

test.describe('a preference list', () => {
  // Somebody whose browser is French but who reads German before English. The
  // list is ordered, and the first language with a pack should win — not the
  // last, and not English merely because it is the default.
  test.use({ locale: 'fr-FR' })

  test('is read in order, not skimmed for English', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'languages', {
        get: () => ['fr-FR', 'de-AT', 'en-GB'],
      })
    })
    await page.goto('/einstellungen/darstellung')

    // de-AT, not de: the region is dropped, so an Austrian reads the same pack.
    await expect(page.getByRole('heading', { level: 1, name: 'Darstellung' })).toBeVisible()
  })
})
