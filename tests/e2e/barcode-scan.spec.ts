import { expect, test, type Page } from './support/test'

import { seed } from './seed'

/**
 * Reading a barcode on the in-store screen (M13; ADR-018, #301).
 *
 * The camera is a stub: a canvas with the bars of an EAN-13 painted on it,
 * streamed through `captureStream()` — the bars come from zxing's own writer
 * (PATH below), drawn as rects so no image decoding or canvas tainting sits
 * between them and the reader.
 *
 * Where `BarcodeDetector` is absent — WebKit, and Chromium on Linux — the
 * first tap loads zxing-wasm. Whether a browser has one is decided here, by
 * stub or by deletion, so each test means the same in both engines and on
 * every CI host.
 *
 * Service workers are blocked so every request is the page's own and seen
 * by `page.on('response')`.
 */
test.use({ serviceWorkers: 'block' })

const EAN = '4006381333931'

// The `d` of zxing-wasm's own SVG for 4006381333931 (`writeBarcode`, EAN13,
// scale 3, quiet zones): 339 × 165 px of bars.
const PATH =
  'M33 0h3v165h-3ZM39 0h3v165h-3ZM51 0h6v150h-6ZM60 0h3v150h-3ZM66 0h3v150h-3ZM75 0h9v150h-9Z' +
  'M87 0h3v150h-3ZM93 0h12v150h-12ZM108 0h12v150h-12ZM123 0h3v150h-3ZM135 0h3v150h-3Z' +
  'M144 0h3v150h-3ZM150 0h6v150h-6ZM162 0h6v150h-6ZM171 0h3v165h-3ZM177 0h3v165h-3Z' +
  'M183 0h3v150h-3ZM198 0h3v150h-3ZM204 0h3v150h-3ZM219 0h3v150h-3ZM225 0h3v150h-3Z' +
  'M240 0h3v150h-3ZM246 0h9v150h-9ZM258 0h3v150h-3ZM267 0h3v150h-3ZM282 0h3v150h-3Z' +
  'M288 0h6v150h-6ZM300 0h6v150h-6ZM309 0h3v165h-3ZM315 0h3v165h-3Z'
const size: [number, number] = [339, 165]
const bars = [...PATH.matchAll(/M(\d+) (\d+)h(\d+)v(\d+)/g)].map((m) => m.slice(1).map(Number))

async function camera(page: Page, detector: 'native' | 'none') {
  await page.addInitScript(
    ({ bars, size, detector, ean }) => {
      if (detector === 'none') {
        delete (window as { BarcodeDetector?: unknown }).BarcodeDetector
      } else {
        // The native reader, as far as this screen can tell: same shape, its answer.
        ;(window as { BarcodeDetector?: unknown }).BarcodeDetector = class {
          async detect() {
            return [{ rawValue: ean }]
          }
        }
      }

      const canvas = document.createElement('canvas')
      ;[canvas.width, canvas.height] = [size[0] + 60, size[1] + 40]
      const context = canvas.getContext('2d')!
      const paint = () => {
        context.fillStyle = '#fff'
        context.fillRect(0, 0, canvas.width, canvas.height)
        context.fillStyle = '#000'
        for (const [x, y, w, h] of bars) context.fillRect(x! + 30, y! + 20, w!, h!)
        requestAnimationFrame(paint)
      }
      paint()

      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: async () => {
            // A test may act at the moment the camera opens (see below).
            await (window as { cameraOpening?: () => Promise<void> }).cameraOpening?.()
            return canvas.captureStream(15)
          },
        },
      })
    },
    { bars, size, detector, ean: EAN },
  )
}

/**
 * Every file of the decoder the page received: the .wasm, and each `/_nuxt/`
 * chunk whose text names `zxing_reader` — the launcher and the decoder's
 * worker (#304). Judged by content because their names are hashes; a pattern
 * on the URL (`zxing_reader|\.wasm$`) let the launcher chunk through unseen.
 */
function decoderRequests(page: Page) {
  const seen: Promise<string | null>[] = []
  page.on('response', (response) => {
    const url = response.url()
    if (!new URL(url).pathname.includes('/_nuxt/')) return
    seen.push(
      url.endsWith('.wasm')
        ? Promise.resolve(url)
        : // A prefetched chunk's body can stay pending forever in Chromium; don't wait on it.
          Promise.race([
            response.text().then(
              (text) => (text.includes('zxing_reader') ? url : null),
              () => null,
            ),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 5_000)),
          ]),
    )
  })
  return async () => (await Promise.all(seen)).filter((url) => url !== null)
}

const field = (page: Page) =>
  page.getByRole('textbox', { name: 'Barcode, catalogue number or name' })
const scanButton = (page: Page) => page.getByRole('button', { name: 'Read a barcode' })

test('with BarcodeDetector the decoder is never fetched', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', "Playwright cannot route a worker's requests in WebKit")
  // The lookup that follows the scan, answered here: no real Discogs in a test.
  await page.context().route('https://api.discogs.com/database/search**', (route) =>
    route.request().method() === 'OPTIONS'
      ? route.fulfill({
          status: 204,
          headers: {
            'access-control-allow-origin': '*',
            'access-control-allow-headers': 'authorization, accept, content-type',
          },
        })
      : route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'access-control-allow-origin': '*' },
          body: JSON.stringify({ pagination: { page: 1, pages: 1, items: 0 }, results: [] }),
        }),
  )
  await camera(page, 'native')
  const seen = decoderRequests(page)
  await seed(page, 'en')
  await page.goto('/in-store')

  await scanButton(page).click()
  await expect(field(page)).toHaveValue(EAN)
  expect(await seen()).toEqual([])
})

test('without BarcodeDetector the reader loads on the tap and reads an EAN-13', async ({
  page,
}) => {
  await camera(page, 'none')
  // The lookup after the read would go to Discogs from the worker, which
  // Playwright cannot route in WebKit. Offline, it fails here instead — from
  // the moment the camera opens, which is after the reader is ready (decoder
  // first) and before anything can be read.
  await page.exposeFunction('cameraOpening', () => page.context().setOffline(true))
  const seen = decoderRequests(page)
  await seed(page, 'en')
  await page.goto('/in-store')
  await expect(scanButton(page)).toBeVisible({ timeout: 15_000 })

  // On the screen, and nothing of the reader yet.
  expect(await seen()).toEqual([])

  const wasm = page.waitForResponse((response) => /\.wasm$/.test(response.url()))
  await scanButton(page).click()
  expect((await wasm).status()).toBe(200)

  await expect(field(page)).toHaveValue(EAN, { timeout: 15_000 })
  expect((await seen()).some((url) => url.endsWith('.wasm'))).toBe(true)
  // The launcher, not only the .wasm (#304).
  expect((await seen()).some((url) => !url.endsWith('.wasm'))).toBe(true)
  // Read in the decoder's own worker, not on the main thread (#304).
  expect(page.workers().some((worker) => /\/zxing-[\w-]+\.js$/.test(worker.url()))).toBe(true)
})

test('when the reader cannot load, the field and the Scan Text hint stay', async ({ page }) => {
  await camera(page, 'none')
  await page.context().route(/\.wasm$/, (route) => route.abort('internetdisconnected'))
  await seed(page, 'en')
  await page.goto('/in-store')

  await scanButton(page).click()
  await expect(page.getByText('This browser cannot read a barcode')).toBeVisible()
  await expect(scanButton(page)).toHaveCount(0)
  await expect(field(page)).toBeEditable()
})
