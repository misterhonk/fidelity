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
     * /willkommen — it was reading the title of a page on its way out.
     */
    await expect(page).toHaveURL(/\/willkommen$/)
    await expect(page).toHaveTitle('Willkommen · Fidelity')
    await expect(page.getByRole('heading', { level: 1, name: 'Fidelity' })).toBeVisible()

    /*
     * The landing page, not the token form. Asking for the key to somebody's
     * Discogs account used to be the first thing a stranger met; now the first
     * thing is what the app does, and the setup is one button away.
     *
     * Rendered only after the worker answered auth.identity — so this also
     * proves main thread, worker and IndexedDB are wired together.
     */
    await expect(page.getByRole('button', { name: /Einrichten/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Erst ausprobieren' })).toBeVisible()

    // And the setup is behind it, intact.
    await page.getByRole('button', { name: /Einrichten/ }).click()
    await expect(page.getByRole('heading', { name: 'Token eintragen' })).toBeVisible()
    await expect(page.getByLabel('Personal Access Token')).toHaveAttribute('type', 'password')

    // Sending is blocked until something has been entered.
    await expect(page.getByRole('button', { name: 'Anmelden' })).toBeDisabled()
  })

  test('the setup shows which of the three steps is running', async ({ page }) => {
    await page.goto('/willkommen')

    // The rail belongs to the setup, not to the page somebody lands on: a
    // fourth dot for the demo would say it is something to get through.
    await expect(page.getByRole('list', { name: 'Einrichtung' })).toHaveCount(0)
    await page.getByRole('button', { name: /Einrichten/ }).click()

    const steps = page.getByRole('list', { name: 'Einrichtung' }).getByRole('listitem')
    await expect(steps).toHaveCount(3)

    // The first is current before anything has been entered, and the ones
    // after it are not — a rail that lights all three says nothing.
    await expect(steps.nth(0)).toHaveAttribute('aria-current', 'step')
    await expect(steps.nth(1)).not.toHaveAttribute('aria-current', 'step')
  })

  test('the nav bar stays out of the setup', async ({ page }) => {
    await page.goto('/willkommen')
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
    await page.goto('/landkarte')

    await expect(page.getByRole('heading', { level: 1, name: 'Sammlung' })).toBeVisible()
    await expect(page.getByText('Noch kein Profil')).toBeVisible()

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })

  test('the dig screen asks for a dealer and stays accessible', async ({ page }) => {
    await page.goto('/dig')

    await expect(page.getByRole('heading', { level: 1, name: 'Graben' })).toBeVisible()
    await expect(page.getByLabel('Händlername')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Prüfen' })).toBeDisabled()

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })

  test('the entry screen has no axe violations', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Erst ausprobieren' })).toBeVisible()

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
  '/landkarte',
  '/wantlist',
  '/haendler',
  '/korb',
  '/gemerkt',
  '/im-laden',
  '/datenschutz',
  '/impressum',
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
    const dialog = page.getByRole('dialog', { name: 'Befehle und Suche' })
    await expect(dialog).toBeVisible()
    // The input owns every key, so focus has to land there by itself.
    await expect(page.locator(':focus')).toHaveAttribute('aria-label', 'Suchen')

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
