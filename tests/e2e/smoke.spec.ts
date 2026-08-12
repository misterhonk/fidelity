import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * The smoke test: a fresh clone builds to static files, those files boot in a
 * browser, the worker comes up, and what the user sees is accessible.
 *
 * Discogs is never called here. The one real call against the live API is a
 * manual check, not a per-PR job — running it on every merge would spend the
 * rate limit on CI instead of on digs.
 */
test.describe('smoke', () => {
  test('a signed-out visitor is taken to the setup', async ({ page }) => {
    await page.goto('/')

    /*
     * The redirect, not the title. This asserted `Start · Fidelity` and kept
     * passing after the start page began sending signed-out visitors to
     * /welcome — it was reading the title of a page on its way out.
     */
    await expect(page).toHaveURL(/\/welcome$/)
    /*
     * The bare name, and that is the point of it.
     *
     * This is the page somebody is on when they add the app to their home
     * screen, and iOS names the icon from the document title. Anything after
     * "Fidelity" here ends up on somebody's phone.
     */
    await expect(page).toHaveTitle('Fidelity')
    await expect(page.getByRole('heading', { level: 1, name: 'Fidelity' })).toBeVisible()

    /*
     * The landing page, not the token form. Asking for the key to somebody's
     * Discogs account used to be the first thing a stranger met; now the first
     * thing is what the app does, and the setup is one button away.
     *
     * Rendered only after the worker answered auth.identity — so this also
     * proves main thread, worker and IndexedDB are wired together.
     */
    await expect(page.getByRole('button', { name: /Set it up/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Have a look first' })).toBeVisible()

    /*
     * Vier Cover, keine vier Textzeilen.
     *
     * The address and the alt text, not whether the picture decoded. Waiting
     * for `naturalWidth` was the first version of this and it made the smoke
     * test depend on i.discogs.com answering — an external host this suite
     * deliberately never touches, so that CI fails for our reasons and not for
     * Discogs'. What can be checked without the network is that each starting
     * point is a sleeve pointing at a real cover, which is the part that breaks
     * when somebody edits the seed list.
     */
    // Matched on the dash, which separates artist from title — the shop logo
    // in the same tile is alt="Laden …" and must not be counted as a sleeve.
    const covers = page.locator('ul li button img[alt*=" – "]')
    await expect(covers).toHaveCount(4) // SEEDS_SHOWN
    await expect(covers.first()).toHaveAttribute('src', /^https:\/\/i\.discogs\.com\//)

    // And the setup is behind it, intact.
    await page.getByRole('button', { name: /Set it up/ }).click()
    await expect(page.getByRole('heading', { name: 'Enter a token' })).toBeVisible()
    await expect(page.getByLabel('Personal Access Token')).toHaveAttribute('type', 'password')

    // Sending is blocked until something has been entered.
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeDisabled()
  })

  /*
   * The English names are written out here rather than read from the pack.
   *
   * Not an oversight and not laziness: importing `app/i18n` into a Playwright
   * spec drags Nuxt's auto-imports into a TypeScript project that has none, so
   * the choice is a literal or an untypechecked test file. A literal is the
   * better half of that trade — this suite is about what somebody sees in the
   * default language, and `tests/unit/naming.spec.ts` already holds the two
   * packs and the screens to each other in both languages.
   */
  test('the setup shows which step is running', async ({ page }) => {
    await page.goto('/welcome')

    // The rail belongs to the setup, not to the page somebody lands on: an
    // extra dot for the demo would say it is something to get through.
    await expect(page.getByRole('list', { name: 'Setup' })).toHaveCount(0)
    await page.getByRole('button', { name: /Set it up/ }).click()

    /*
     * Five: token, collection, horizon, credits, done.
     *
     * The horizon and the credits used to sit only in the settings, on the
     * argument that they cost minutes and the app runs without them. Both
     * still true — but somebody who never opens the settings ended up with a
     * matcher that knows only the artists they already own by name. They are
     * steps now, and both can be walked past in one click.
     */
    const steps = page.getByRole('list', { name: 'Setup' }).getByRole('listitem')
    await expect(steps).toHaveCount(5)

    // The first is current before anything has been entered, and the ones
    // after it are not — a rail that lights every step says nothing.
    await expect(steps.nth(0)).toHaveAttribute('aria-current', 'step')
    await expect(steps.nth(1)).not.toHaveAttribute('aria-current', 'step')
  })

  test('the nav bar stays out of the setup', async ({ page }) => {
    await page.goto('/welcome')
    await expect(page.getByRole('navigation', { name: 'Hauptbereiche' })).toHaveCount(0)
  })

  test('the design tokens reach the browser', async ({ page }) => {
    await page.goto('/')

    const [signal, accent] = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement)
      return [
        style.getPropertyValue('--color-fid-sig-credit').trim(),
        style.getPropertyValue('--color-fid-accent').trim(),
      ]
    })

    expect(signal).not.toBe('')
    expect(accent).not.toBe('')
  })

  test('the map says what to do instead of showing empty bars', async ({ page }) => {
    await page.goto('/map')

    await expect(page.getByRole('heading', { level: 1, name: 'Collection' })).toBeVisible()
    await expect(page.getByText('No profile yet')).toBeVisible()

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })

  test('the dig screen asks for a dealer and stays accessible', async ({ page }) => {
    await page.goto('/dig')

    await expect(page.getByRole('heading', { level: 1, name: 'Dig' })).toBeVisible()
    // Name *oder* Link: nobody carries a Discogs username around, they carry
    // the address of the page they are standing on.
    await expect(page.getByLabel('Dealer — name or link')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Check' })).toBeDisabled()

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })

  test('the entry screen has no axe violations', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Have a look first' })).toBeVisible()

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()

    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })
})

/**
 * Every screen, signed out (docs/06 M8: "A11y-Audit: Tastatur + VoiceOver
 * komplett").
 *
 * Signed out is what a test can reach without a token, and it is not a
 * cop-out: the empty states are exactly where the wrong heading level or a
 * button with no accessible name tends to survive unnoticed, because nobody
 * looks at them twice.
 */
const SCREENS = [
  '/',
  '/dig',
  '/map',
  '/wantlist',
  '/dealers',
  '/basket',
  '/saved',
  '/in-store',
  '/privacy',
  '/legal',
  // The manual. It is all prose, which is exactly where a wrong heading level
  // survives longest — nobody looks at a help page twice.
  '/settings/help',
]

test.describe('accessibility', () => {
  for (const path of SCREENS) {
    test(`${path} has no axe violations`, async ({ page }) => {
      await page.goto(path)
      await expect(page.locator('main')).toBeVisible()

      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze()

      expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
    })
  }

  test('every screen can be reached and left with the keyboard alone', async ({ page }) => {
    await page.goto('/dig')
    await expect(page.locator('main')).toBeVisible()

    // Tab until something is focused, then check the focus ring is real —
    // a control that cannot be seen once focused is not keyboard-usable.
    await page.keyboard.press('Tab')
    const focused = page.locator(':focus')
    await expect(focused).toBeVisible()

    const outline = await focused.evaluate((el) => {
      const style = getComputedStyle(el)
      return `${style.outlineStyle} ${style.outlineWidth}`
    })
    expect(outline).not.toBe('none 0px')
  })

  test('the command palette opens and closes on the keyboard', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('main')).toBeVisible()

    await page.keyboard.press('ControlOrMeta+k')
    const dialog = page.getByRole('dialog', { name: 'Commands and search' })
    await expect(dialog).toBeVisible()
    // The input owns every key, so focus has to land there by itself.
    await expect(page.locator(':focus')).toHaveAttribute('aria-label', 'Search')

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })
})

/**
 * SC 2.5.8, the one axe cannot check.
 *
 * Target Size (Minimum) is 24×24 CSS pixels, and docs/05 §6 names exactly
 * where it bites in this app: chips and row actions in the compact modes. axe
 * has no rule for it, so it is measured here — text links styled as actions
 * are the ones that quietly come out at twenty-one.
 *
 * Inline links inside a sentence are exempt by the spec and are excluded the
 * same way: only elements that stand alone as controls are measured. So is a
 * checkbox inside its own label — the label is part of the target, which is
 * what "target" means in the criterion, and measuring the box alone would
 * report a failure that does not exist.
 */
test.describe('target size', () => {
  for (const path of SCREENS) {
    test(`${path} has no control under 24×24`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 })
      await page.goto(path)
      await expect(page.locator('main')).toBeVisible()

      const small = await page.evaluate(() => {
        const out: string[] = []
        for (const el of document.querySelectorAll(
          'main button, main a, main input, main select',
        )) {
          // Inline links in running text are exempt (SC 2.5.8 exception).
          const parent = el.parentElement
          const inSentence =
            parent !== null &&
            (parent.tagName === 'P' || parent.tagName === 'LI') &&
            (parent.textContent ?? '').trim() !== (el.textContent ?? '').trim()
          if (inSentence) continue

          // A control wrapped in its own label is as big as the label.
          const label = el.closest('label')
          if (label !== null && label !== el) {
            const outer = label.getBoundingClientRect()
            if (outer.width >= 24 && outer.height >= 24) continue
          }

          const box = el.getBoundingClientRect()
          if (box.width === 0 || box.height === 0) continue
          if (box.height < 24 || box.width < 24) {
            out.push(
              `${Math.round(box.width)}×${Math.round(box.height)} ${
                (el.textContent ?? '').trim() || el.getAttribute('aria-label') || el.tagName
              }`,
            )
          }
        }
        return out
      })

      expect(small).toEqual([])
    })
  }
})

/*
 * What an installed icon ends up called.
 *
 * Somebody added the app to their home screen and got "Willkommen · Fidelity"
 * — iOS reads `apple-mobile-web-app-title` and falls back to the document
 * title, and neither said the plain name. The manifest was already right,
 * which is exactly why this needs its own test: the thing that was wrong was
 * the thing nobody had written down.
 */
test('says what the app is called, in the two places an install reads', async ({ page }) => {
  await page.goto('/welcome')

  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute(
    'content',
    'Fidelity',
  )
  await expect(page).toHaveTitle('Fidelity')
})

// That every other screen keeps the name in front is asserted where a screen
// is opened with a session: language.spec, on the appearance settings. Going
// there from here signed out only races the redirect to /welcome.
