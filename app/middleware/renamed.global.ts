/**
 * The addresses this app used to have.
 *
 * Every screen was under a German path until ADR-010 — `/korb`, `/regal`,
 * `/einstellungen/abgleich`. Renaming them without this file would break three
 * things that are not hypothetical:
 *
 * 1. **Bookmarks.** Somebody's link to their basket.
 * 2. **Installed PWAs.** `start_url` is `/`, so those survive — but any deeper
 *    shortcut somebody made does not.
 * 3. **OAuth registrations.** This is the one that would have hurt. The vault's
 *    Dropbox and Google Drive flows need a redirect URI *registered by the
 *    user, at the provider*, and it was `…/einstellungen/abgleich`. Nobody can
 *    change that from here, and a provider answers a mismatch by refusing the
 *    whole exchange. The query has to survive the redirect for those to keep
 *    working, which is why `query` and `hash` are carried across rather than
 *    dropped — `?code=…` is the entire point of that request.
 *
 * A middleware rather than a server rule, because there is no server (ADR-007).
 * `deploy/nginx.conf` and `deploy/.htaccess` do send a real 301 for anybody who
 * runs one, and this catches the rest — including the file:// and offline cases
 * where nothing but the app itself is listening.
 */
const RENAMED: Record<string, string> = {
  '/korb': '/basket',
  '/regal': '/collection',
  '/haendler': '/shops',
  '/landkarte': '/insights',
  '/gemerkt': '/saved',
  '/im-laden': '/in-store',
  '/willkommen': '/welcome',
  '/datenschutz': '/privacy',
  '/impressum': '/legal',
  '/einstellungen': '/settings',
  '/einstellungen/abgleich': '/settings/account#sync',
  '/einstellungen/darstellung': '/settings/look',
  '/einstellungen/daten': '/settings/account#data',
  '/einstellungen/hilfe': '/settings/help',
  '/einstellungen/hub': '/settings/advanced',
  '/einstellungen/konto': '/settings/account',
  '/einstellungen/sammlung': '/settings/collection',
  '/einstellungen/suche': '/settings/finds',
  /** Folded into the hub screen on 2026-09-12 (M26.3): one door field. */
  '/settings/access': '/settings/advanced',
  /*
   * Nine settings pages became five and an advanced one (#229). `/settings/sync`
   * is also the OAuth redirect URI registered at Dropbox and Google
   * (app/utils/pkce.ts), so it must keep its query on the way through.
   */
  '/settings/sync': '/settings/account#sync',
  '/settings/data': '/settings/account#data',
  '/settings/search': '/settings/finds',
  '/settings/appearance': '/settings/look',
  '/settings/hub': '/settings/advanced',
  /*
   * The second move (#228): the shop is the unit, and dig is the verb on it.
   * The query carries the address — `?dealer=`, `?id=` — so a static host
   * needs no route per shop. Old targets above point straight at the new
   * addresses, so nothing redirects twice.
   */
  '/dig': '/shop',
  '/dealers': '/shops',
  '/shelf': '/collection',
  '/map': '/insights',
  '/review': '/insights/year',
}

export default defineNuxtRouteMiddleware((to) => {
  // Trailing slashes come from hand-typed addresses and from a few clients.
  const path = to.path.length > 1 ? to.path.replace(/\/+$/, '') : to.path
  const moved = RENAMED[path]
  if (!moved) return

  // A section of a merged page carries its anchor; a hash already in the address wins.
  const [target, anchor] = moved.split('#')
  // `replace`, so the back button does not bounce off the old address.
  return navigateTo(
    { path: target, query: to.query, hash: to.hash || (anchor ? `#${anchor}` : '') },
    { replace: true },
  )
})
