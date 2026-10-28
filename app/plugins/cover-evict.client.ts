/**
 * Forget a cover that failed to draw.
 *
 * i.discogs.com sends no CORS header, so the service worker caches every cover
 * opaque — status 0, whether Discogs answered 200 or a Cloudflare 429 (docs/02).
 * It cannot tell the two apart; the <img> can, because a 429 does not decode.
 * Dropping that entry lets the next showing ask again instead of serving the
 * broken answer for 90 days. Nothing is fetched here.
 */
export default defineNuxtPlugin(() => {
  if (!('caches' in window)) return
  // Image errors do not bubble, so listen in the capture phase.
  document.addEventListener(
    'error',
    (event) => {
      const img = event.target
      if (!(img instanceof HTMLImageElement)) return
      const src = img.currentSrc || img.src
      if (!src.startsWith('https://i.discogs.com/')) return
      const evict = () =>
        void caches
          .open('fidelity-covers')
          .then((cache) => cache.delete(src))
          .catch(() => {})
      evict()
      // On a first load the worker stores the answer only after handing it over, so look again.
      setTimeout(evict, 1000)
    },
    true,
  )
})
