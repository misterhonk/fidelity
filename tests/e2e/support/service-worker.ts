import { expect, type Page } from '@playwright/test'

/**
 * Waits until a service worker is actually driving this page.
 *
 * `registration.active` is not enough: a worker can be active without yet
 * controlling the client that installed it, and testing in that window would
 * measure the HTTP cache rather than the worker.
 */
export async function serviceWorkerInCharge(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false
    try {
      await navigator.serviceWorker.ready
    } catch {
      return false
    }
    if (navigator.serviceWorker.controller) return true

    // Installed on this load but not yet in charge of it. One reload hands it
    // over — which is exactly what happens on somebody's second visit.
    return await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), 5_000)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        clearTimeout(timer)
        resolve(true)
      })
    })
  })
}

/** Opens `path` and reports whether a worker ended up in charge of it. */
export async function underServiceWorker(page: Page, path: string): Promise<boolean> {
  await page.goto(path)
  await expect(page.locator('main')).toBeVisible()

  if (await serviceWorkerInCharge(page)) return true
  await page.reload()
  return serviceWorkerInCharge(page)
}
