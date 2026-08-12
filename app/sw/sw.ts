/// <reference lib="webworker" />
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { ExpirationPlugin } from 'workbox-expiration'
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'

/**
 * Fidelity's service worker.
 *
 * It used to be generated: `generateSW` wrote it from the `pwa.workbox` block
 * in nuxt.config.ts, which works right up to the moment the worker has to do
 * something the config has no word for. Push is that moment — a notification
 * arrives when no tab is open, and only code inside the worker can answer it.
 *
 * So this is that generated worker, written out by hand and doing the same
 * three things it did. Nothing new happens here yet, and that is the point:
 * the file that later grows a `push` listener should first be one whose
 * behaviour is already known and already tested.
 *
 * The acceptance is `tests/e2e/offline.spec.ts` and
 * `tests/e2e/service-worker.spec.ts` — four tests over the built output, which
 * is the only place a service worker exists at all.
 */

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<string | { url: string; revision: string | null }>
}

/*
 * The update happens when somebody says so, never on its own.
 *
 * `registerType: 'prompt'` asks; this is the other half of that conversation.
 * A silent takeover would swap the code out from under a running dig — four
 * minutes of scanning, gone — so the worker waits for the word from the page.
 */
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if ((event.data as { type?: string } | undefined)?.type === 'SKIP_WAITING') {
    void self.skipWaiting()
  }
})

/*
 * The shell, and what the build put in it.
 *
 * `__WB_MANIFEST` is replaced at build time with the file list and their
 * revisions. Without this line the build fails outright — which is the one
 * thing in this file that cannot go wrong quietly.
 */
precacheAndRoute(self.__WB_MANIFEST)

// Caches from an older shell, dead weight after an update.
cleanupOutdatedCaches()

/*
 * Every navigation the precache does not already answer lands on the app.
 *
 * `'200'` — a relative URL, and without the `.html`. Both halves matter:
 *
 * Relative, so it resolves against this worker's own address and therefore
 * carries whatever base path the app is deployed under, without this file
 * having to know it.
 *
 * Without the extension, because @vite-pwa/nuxt puts a `manifestTransforms` in
 * front of the build that strips `.html` off every precached document —
 * `200.html` is listed as `200`. `createHandlerBoundToURL` looks the URL up in
 * that list by string and **throws** when it is not there.
 *
 * That is not theory: the generated worker shipped bound to `/200.html`, and
 * because its throw happened inside a promise the worker still installed —
 * with its cover cache never registered once, and nothing anywhere saying so
 * (fixed 2026-08-12). Here the same mistake takes the whole worker down at
 * evaluation, which is the better of the two: getting it wrong now means no
 * worker at all, and all four tests say so within seconds.
 */
registerRoute(new NavigationRoute(createHandlerBoundToURL('200')))

/*
 * Covers, kept for three months.
 *
 * i.discogs.com has a budget of its own — roughly thirty requests a minute,
 * separate from the API's and invisible to JavaScript (docs/02). Scrolling a
 * dig twice without this walks straight into a wall the app cannot see.
 *
 * CacheFirst because a cover never changes: the URLs are content-addressed, so
 * a different image is a different address.
 *
 * docs/06 M6 asks for a 150 MB cap and Workbox counts entries, not bytes. Six
 * thousand is that budget in the unit available, at the ~25 KB a 150px
 * thumbnail weighs; `purgeOnQuotaError` is the real safety net, dropping the
 * cache instead of letting writes fail silently when the estimate is wrong.
 *
 * Status 0 is kept on purpose: a cross-origin image without CORS headers
 * arrives opaque, and refusing those would cache nothing at all.
 */
registerRoute(
  ({ url }) => url.hostname === 'i.discogs.com',
  new CacheFirst({
    cacheName: 'fidelity-covers',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 6000,
        maxAgeSeconds: 60 * 60 * 24 * 90,
        purgeOnQuotaError: true,
      }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
  'GET',
)
