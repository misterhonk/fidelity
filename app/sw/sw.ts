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

import { watchNotice } from '../../shared/notify'

/**
 * Fidelity's service worker.
 *
 * It used to be generated: `generateSW` wrote it from the `pwa.workbox` block
 * in nuxt.config.ts, which works right up to the moment the worker has to do
 * something the config has no word for. Push is that moment — a notification
 * arrives when no tab is open, and only code inside the worker can answer it.
 *
 * It started as that generated worker written out by hand, doing exactly the
 * three things it did, so that the file which then grew a `push` listener was
 * one whose behaviour was already known and already tested. It has since grown
 * that listener, and the notification the hub asks for.
 *
 * The acceptance is `tests/e2e/offline.spec.ts` and
 * `tests/e2e/service-worker.spec.ts` — over the built output, which is the only
 * place a service worker exists at all. The one thing those cannot reach is the
 * notification itself: a headless browser refuses to show one (measured
 * 2026-08-12), so the wording lives in `shared/notify.ts` with unit tests, and
 * only the wiring is left here.
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
 * A shop got records while nobody was looking.
 *
 * This is the reason the file exists. The hub asks each watched shop once an
 * hour — one request for everybody rather than one per person (hub/src/watch.ts)
 * — and what it finds arrives here, in a worker that runs when no tab does.
 *
 * The payload carries data and no words: `{ dealer, newListings, seenAt }`.
 * The sentence is built here, because the hub has no business knowing what
 * language somebody reads.
 */
self.addEventListener('push', (event: PushEvent) => {
  /*
   * Every push says so, out loud, before anything else happens.
   *
   * This worker is the last stretch of a chain that spans four parties — hub,
   * VAPID, the platform's push service, the browser — and until 2026-08-13 it
   * was the only stretch with no way to report. The hub could say "delivered,
   * no error" while somebody looked at a silent phone, and there was no way to
   * tell "the device never got it" from "the device got it and showed
   * nothing". Three hours went into that gap; one line closes it.
   *
   * A service worker has no other channel. It runs when no tab does, so the
   * console of whichever page later attaches is where this ends up — and that
   * is exactly where somebody debugging it will be looking.
   */
  // eslint-disable-next-line no-console -- see above: the worker's only voice
  console.info('[fidelity] push arrived')
  event.waitUntil(announce(event))
})

async function announce(event: PushEvent): Promise<void> {
  /*
   * A payload that is not JSON must not take the handler down with it.
   *
   * `event.data.json()` throws on anything else, and a throw inside
   * `waitUntil` is a rejected promise nobody sees — the notification simply
   * never appears. Anyone can push to this endpoint who has the address; not
   * every one of them sends what this worker expects.
   */
  let data: unknown
  try {
    data = event.data?.json()
  } catch (error) {
    console.warn('[fidelity] push carried nothing readable', error)
    return
  }

  // The wording, and the decision not to show anything at all, live in
  // `shared/notify.ts` — a notification is the one thing here a headless
  // browser refuses to show, so the sentence is testable where a browser is
  // not needed. Null means: not ours, and better silent than an empty buzz.
  const notice = watchNotice(data, await language())
  if (!notice) {
    // Silence with a reason. Without this line an unexpected payload and a
    // notification the system swallowed look identical from the outside.
    console.warn('[fidelity] push was not the watchman speaking', data)
    return
  }

  /*
   * And whether it was actually shown.
   *
   * `showNotification` refuses when the permission is missing, and on iOS when
   * the app is not running from the home screen. Unhandled, that rejection
   * goes nowhere: the hub reports a clean delivery, the screen stays empty,
   * and those two facts together are the most confusing answer there is.
   */
  try {
    await self.registration.showNotification(notice.title, {
      body: notice.body,
      icon: new URL('icons/icon-192.png', self.registration.scope).href,
      badge: new URL('icons/icon-192.png', self.registration.scope).href,
      // One notification per shop: two rounds an hour apart should replace each
      // other, not stack into a column of near-identical lines.
      tag: `watch:${notice.title}`,
      data: { dealer: notice.title },
    })
    // eslint-disable-next-line no-console -- see the handler above
    console.info('[fidelity] notification shown:', notice.title)
  } catch (error) {
    console.warn('[fidelity] the system refused to show it', error)
  }
}

/*
 * Which language the notification speaks.
 *
 * The app keeps that choice in `localStorage`, which a worker cannot see, and
 * reading it out of IndexedDB would mean the database schema in a second
 * place. So the page tells this worker whenever the language is set, and the
 * answer is kept in a cache of its own — the only store here that survives the
 * worker being stopped and started, which happens between every notification.
 */
const LANGUAGE_CACHE = 'fidelity-notify'
const LANGUAGE_URL = 'language'

async function language(): Promise<string> {
  try {
    const stored = await (await caches.open(LANGUAGE_CACHE)).match(LANGUAGE_URL)
    return stored ? await stored.text() : 'en'
  } catch {
    return 'en'
  }
}

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const data = event.data as { type?: string; language?: string } | undefined
  if (data?.type !== 'LANGUAGE' || typeof data.language !== 'string') return

  event.waitUntil(
    caches
      .open(LANGUAGE_CACHE)
      .then((cache) => cache.put(LANGUAGE_URL, new Response(data.language)))
      .catch(() => {}),
  )
})

/*
 * Tapping it lands on that shop's records, not on the front door.
 *
 * An already open tab is used rather than a second one: somebody who has the
 * app open on their phone should not end up with two of it because a shop got
 * a delivery.
 */
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()

  const dealer = (event.notification.data as { dealer?: string } | undefined)?.dealer
  const target = new URL(
    dealer ? `dig?dealer=${encodeURIComponent(dealer)}` : '',
    self.registration.scope,
  ).href

  event.waitUntil(
    (async () => {
      const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of open) {
        if (!client.url.startsWith(self.registration.scope)) continue
        await client.focus()
        // `navigate` is refused in some browsers for a client that is not
        // controlled; the focus above is the part that must not be lost.
        await client.navigate(target).catch(() => {})
        return
      }
      await self.clients.openWindow(target)
    })(),
  )
})

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
