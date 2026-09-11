/**
 * Without a token, nobody belongs on a screen full of data.
 *
 * Until 2026-08-14 the redirect lived in the start page's `onMounted` alone.
 * Anyone opening `/shelf` from a bookmark, anyone who had closed the app on
 * `/dealers` and reopened it, or anyone following a link, landed on a finished
 * page saying "No records here yet. Fetch the collection in the settings." — a
 * statement about the collection where one about the state of the app belongs.
 * The reason is not that there is nothing there, but that nobody is set up.
 *
 * A middleware rather than a repeat of that `onMounted` on every page: there
 * are twelve of them, and the thirteenth forgets.
 */

/**
 * Where you may go without a token.
 *
 * `/settings` is the most important exception and not an oversight: **that is
 * where the token is entered.** Shutting that branch out shuts out the way in
 * — and shuts it out precisely for the people who need it.
 *
 * Privacy and the legal notice are statutory texts; putting them behind a
 * sign-in would be absurd.
 *
 * `/demo` stood here until 2026-09-10, with a note that it showed invented
 * data and was the reason anybody sets themselves up at all. That address does
 * not exist — there is no `app/pages/demo.vue`, and this line was the only
 * place in the whole repository that mentioned it. The demo is `DemoDig.vue`
 * and sits on `/welcome`, so it is open already. Nobody notices an exception
 * for a 404, but its comment claims a screen that people then go looking for.
 */
/*
 * `/shared` is the second important exception, and for the opposite reason:
 * somebody who does **not** have Fidelity lands there. A shared link that
 * redirects to the setup is the worst possible way to introduce an app — and
 * the screen needs none of what the setup arranges: no collection, no token,
 * no hub. Everything it shows is in the link.
 */
/*
 * And `/whats-new` belongs with them: what is in this release is information
 * about the app, not about anybody's collection. Somebody tapping the footer
 * link without a token should not end up in the setup.
 */
const OPEN = ['/welcome', '/settings', '/privacy', '/legal', '/shared', '/whats-new']

export default defineNuxtRouteMiddleware(async (to) => {
  /*
   * In the browser only.
   *
   * `ssr: false` means no server renders here anyway — but the middleware runs
   * during static page generation, and there is neither IndexedDB nor a worker
   * to ask there.
   */
  if (import.meta.server) return

  if (OPEN.some((path) => to.path === path || to.path.startsWith(`${path}/`))) return

  const { identity, ready, load } = useIdentity()
  if (!ready.value) await load()
  if (identity.value) return

  /*
   * Pass along where somebody came from.
   *
   * Otherwise the setup always ends on the start page, and anyone who actually
   * wanted to see their basket goes looking for it by hand afterwards. Costs
   * nothing and turns an interruption into a detour.
   */
  return navigateTo({
    path: '/welcome',
    query: to.fullPath === '/' ? {} : { next: to.fullPath },
  })
})
