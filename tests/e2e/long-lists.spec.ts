import { expect, test, type Page } from '@playwright/test'

import { DB_VERSION } from '~~/db/schema'

/**
 * Lange Listen: der Weg nach oben, und nicht alles auf einmal.
 *
 * Beides ist nur in einem Browser zu prüfen. Ein Knopf, der bei einer
 * Scrollhöhe erscheint, hat keine testbare Form — er hat eine Bedingung, und
 * die kennt nur eine Maschine mit einem Fenster. Dasselbe für „nicht alles
 * gezeichnet": im Quelltext steht ein `slice`, im Dokument stehen Zeilen.
 */

/** Genug, dass zwei Bildschirmhöhen dahinterliegen. */
const VIELE = 200

async function withWantlist(page: Page) {
  await page.goto('/')
  // Abgemeldet räumt die App die Datenbank auf dem Weg zur Einrichtung.
  await page.waitForURL(/\/welcome/, { timeout: 20_000 })

  await page.waitForFunction(
    async (wanted: number) => {
      const known = await indexedDB.databases()
      return known.some((entry) => entry.name === 'fidelity' && (entry.version ?? 0) >= wanted)
    },
    DB_VERSION,
    { timeout: 20_000 },
  )

  await page.evaluate(async (howMany: number) => {
    const open = indexedDB.open('fidelity')
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      open.onsuccess = () => resolve(open.result)
      open.onerror = () => reject(open.error)
    })

    const meta = db.transaction('meta', 'readwrite').objectStore('meta')
    meta.put({ key: 'token', value: 'not-a-real-token' })
    meta.put({ key: 'identity', value: { username: 'probe', displayName: 'Probe', userId: 1 } })

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
   * Nicht zweihundert Zeilen auf einmal.
   *
   * Jede trägt ein Cover; zweihundert davon sind zweihundert Bilder, die ein
   * Telefon beim ersten Blick allesamt anlegt. Die Daten kommen weiterhin in
   * einem Rutsch aus IndexedDB — das ist billig. Teuer ist das Zeichnen.
   */
  test('draws a window, not everything', async ({ page }) => {
    await withWantlist(page)

    const rows = page.locator('.fid-want')
    await expect(rows.first()).toBeVisible({ timeout: 15_000 })
    expect(await rows.count()).toBeLessThan(VIELE)

    // Und der Rest ist erreichbar, nicht verschluckt.
    await page.getByRole('button', { name: /more|weitere/i }).click()
    expect(await rows.count()).toBeGreaterThan(60)
  })

  /**
   * Der Weg nach oben zeigt sich erst, wenn er gebraucht wird.
   *
   * Ein Knopf, der von Anfang an dasteht, ist auf jedem kurzen Bildschirm im
   * Weg — und er schwebt, kann also etwas verdecken. Zwei Bildschirmhöhen
   * heißen überall dasselbe: „du hast etwas hinter dir gelassen."
   */
  test('offers the way back only once there is a way back', async ({ page }) => {
    await withWantlist(page)

    /*
     * Erst die Zeilen abwarten, dann scrollen.
     *
     * Sie kommen aus IndexedDB, also nach dem ersten Bild. Wer vorher scrollt,
     * scrollt auf einer kurzen Seite — `scrollY` bleibt 0, und der Knopf
     * erscheint völlig zu Recht nicht. Am 2026-08-14 zwei Anläufe gekostet.
     */
    await expect(page.locator('.fid-want').first()).toBeVisible({ timeout: 15_000 })

    const toTop = page.getByRole('button', { name: /back to the top|zurück nach oben/i })
    await expect(toTop).toBeHidden()

    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 3))
    await expect(toTop).toBeVisible()

    await toTop.click()
    // Sanftes Scrollen braucht einen Moment; die Zusage ist der Anfang, nicht
    // die Geschwindigkeit.
    await expect.poll(async () => page.evaluate(() => window.scrollY)).toBeLessThan(50)
  })
})
