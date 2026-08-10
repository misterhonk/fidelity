import { expect, test } from '@playwright/test'

/**
 * Die eine Umgebungsannahme hinter der geteilten Drosselung.
 *
 * The gap between Discogs requests is global rather than per tab because the
 * slot is claimed under a Web Lock (worker/discogs/pacer.ts). Where the API is
 * missing the pacer falls back to pacing each tab on its own — which is not a
 * crash, not a warning, and exactly the bug it was written to fix: two tabs
 * each holding to 1200 ms perfectly, together sending 100 requests a minute
 * against a limit of 60.
 *
 * So the assumption is checked where it is weakest. It runs in every project
 * the suite has, and the one that matters is WebKit: Safari is the last of the
 * three to have shipped Web Locks, and iOS Safari is what the app is installed
 * on.
 *
 * It has to be checked *inside a Worker*, not on the page. All the pacing
 * happens there, and `WorkerNavigator` is a different interface from
 * `Navigator` — one having `locks` says nothing about the other.
 */
test.describe('the lock the request pacing rests on', () => {
  test('exists inside a worker and can actually be held', async ({ page }) => {
    await page.goto('/')

    const result = await page.evaluate(async () => {
      const source = `self.onmessage = async () => {
        const available = typeof self.navigator !== 'undefined' && !!self.navigator.locks
        if (!available) return self.postMessage({ available, held: [] })

        const held = await self.navigator.locks.request('fidelity:discogs', async () => {
          const state = await self.navigator.locks.query()
          return state.held.map((lock) => lock.name)
        })
        self.postMessage({ available, held })
      }`

      const worker = new Worker(
        URL.createObjectURL(new Blob([source], { type: 'text/javascript' })),
      )
      try {
        return await new Promise<{ available: boolean; held: string[] }>((resolve, reject) => {
          worker.addEventListener('message', (event) => resolve(event.data))
          worker.addEventListener('error', () => reject(new Error('worker failed')))
          setTimeout(() => reject(new Error('worker never answered')), 5_000)
          worker.postMessage(1)
        })
      } finally {
        worker.terminate()
      }
    })

    expect(result.available, 'navigator.locks im Worker').toBe(true)
    expect(result.held, 'die Sperre wird wirklich gehalten').toContain('fidelity:discogs')
  })

  test('two holders do not overlap', async ({ page }) => {
    // The property the pacing depends on: the second holder starts after the
    // first has let go. A lock that hands itself to everybody at once would
    // satisfy the check above and none of the purpose behind it.
    await page.goto('/')

    const overlapped = await page.evaluate(async () => {
      let inside = 0
      let seenTogether = false

      const hold = () =>
        navigator.locks.request('fidelity:overlap-probe', async () => {
          inside += 1
          if (inside > 1) seenTogether = true
          await new Promise((resolve) => setTimeout(resolve, 30))
          inside -= 1
        })

      await Promise.all([hold(), hold(), hold()])
      return seenTogether
    })

    expect(overlapped).toBe(false)
  })
})
