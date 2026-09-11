import { expect, test, type Page } from '@playwright/test'

import { signIn } from './seed'

/**
 * Long lists: the way back up, and not all of it at once.
 *
 * Both can only be checked in a browser. A button that appears at a scroll
 * height has no testable shape — it has a condition, and only a machine with a
 * window knows that. The same for "not all of it drawn": in the source there
 * is a `slice`, in the document there are rows.
 */

/** Genug, dass zwei Bildschirmhöhen dahinterliegen. */
const VIELE = 200

async function withWantlist(page: Page) {
  // The token is part of it: without one, the setup guard leads `/wantlist` to
  // the setup, and there are no rows to count there. `signIn` also waits for
  // the stores — the long reasoning is in `seed.ts`.
  await signIn(page)

  await page.evaluate(async (howMany: number) => {
    const open = indexedDB.open('fidelity')
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      open.onsuccess = () => resolve(open.result)
      open.onerror = () => reject(open.error)
    })

    const tx = db.transaction('wantlist', 'readwrite')
    for (let i = 0; i < howMany; i += 1) {
      tx.objectStore('wantlist').put({
        releaseId: 1000 + i,
        masterId: 0,
        title: `Platte ${i}`,
        artistIds: [],
        artistNames: ['Probe'],
        artistNorms: ['probe'],
        labelIds: [],
        labelNames: ['Label'],
        labelNorms: ['label'],
        catnos: [],
        genres: [],
        styles: [],
        formats: ['Vinyl'],
        year: 1990,
        rating: 0,
        thumbUrl: '',
        coverUrl: '',
        addedAt: `2020-01-01T00:00:0${i % 10}-00:00`,
      })
    }
    await new Promise((done) => (tx.oncomplete = () => done(null)))
  }, VIELE)

  await page.goto('/wantlist')
  await expect(page.locator('main')).toBeVisible()
}

test.describe('a long list', () => {
  /**
   * Not two hundred rows at once.
   *
   * Each carries a cover; two hundred of them are two hundred images a phone
   * creates all at once on first sight. The data still comes out of IndexedDB
   * in one go — that is cheap. The drawing is what is expensive.
   */
  test('draws a window, not everything', async ({ page }) => {
    await withWantlist(page)

    const rows = page.locator('.fid-want')
    await expect(rows.first()).toBeVisible({ timeout: 15_000 })
    expect(await rows.count()).toBeLessThan(VIELE)

    // And the rest is reachable, not swallowed.
    await page.getByRole('button', { name: /more|weitere/i }).click()
    expect(await rows.count()).toBeGreaterThan(60)
  })

  /**
   * The way back up shows itself only once there is a way back.
   *
   * A button that is there from the start is in the way on every short screen
   * — and it floats, so it can cover something. Two screen heights mean the
   * same thing everywhere: "you have left something behind."
   */
  test('offers the way back only once there is a way back', async ({ page }) => {
    await withWantlist(page)

    /*
     * Wait for the rows first, then scroll.
     *
     * They come from IndexedDB, so after the first paint. Anyone scrolling
     * before that scrolls on a short page — `scrollY` stays 0, and the button
     * quite rightly does not appear. Cost two attempts on 2026-08-14.
     */
    await expect(page.locator('.fid-want').first()).toBeVisible({ timeout: 15_000 })

    const toTop = page.getByRole('button', { name: /back to the top|zurück nach oben/i })
    await expect(toTop).toBeHidden()

    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 3))
    await expect(toTop).toBeVisible()

    await toTop.click()
    // Smooth scrolling takes a moment; the promise is that it starts, not how
    // fast it goes.
    await expect.poll(async () => page.evaluate(() => window.scrollY)).toBeLessThan(50)
  })
})
