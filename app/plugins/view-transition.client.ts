/**
 * Keeps Nuxt's page crossfade (#226) from holding the screen.
 *
 * While a view transition waits for its new picture the browser paints
 * nothing, and Nuxt's transition waits for the next page to finish. Two cases
 * turned that into a blank screen in WebKit:
 *
 * - **The first page of a load.** The guard's redirect to the setup is a page
 *   change, so Nuxt began a crossfade from an empty document — nothing to fade
 *   out of, and no paint until the redirected page was done. On a busy machine
 *   that was longer than any test waits for `main`.
 * - **A page that never finishes.** Chromium gives up on a stuck update after
 *   four seconds; WebKit kept the old picture for the whole minute.
 */
const STUCK_MS = 1000

export default defineNuxtPlugin((nuxtApp) => {
  let shown = false
  nuxtApp.hook('page:finish', () => {
    shown = true
  })

  useRouter().beforeEach((to) => {
    if (!shown) to.meta.viewTransition = false
  })

  nuxtApp.hook('page:view-transition:start', (transition) => {
    let updated = false
    transition.updateCallbackDone.then(
      () => (updated = true),
      () => (updated = true),
    )
    // Skipping lifts the paint hold at once; the route change still runs.
    setTimeout(() => {
      if (!updated) transition.skipTransition()
    }, STUCK_MS)
  })
})
