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
  '/regal': '/shelf',
  '/haendler': '/dealers',
  '/landkarte': '/map',
  '/gemerkt': '/saved',
  '/im-laden': '/in-store',
  '/willkommen': '/welcome',
  '/datenschutz': '/privacy',
  '/impressum': '/legal',
  '/einstellungen': '/settings',
  '/einstellungen/abgleich': '/settings/sync',
  '/einstellungen/darstellung': '/settings/appearance',
  '/einstellungen/daten': '/settings/data',
  '/einstellungen/hilfe': '/settings/help',
  '/einstellungen/hub': '/settings/hub',
  '/einstellungen/konto': '/settings/account',
  '/einstellungen/sammlung': '/settings/collection',
  '/einstellungen/suche': '/settings/search',
}

export default defineNuxtRouteMiddleware((to) => {
  // Trailing slashes come from hand-typed addresses and from a few clients.
  const path = to.path.length > 1 ? to.path.replace(/\/+$/, '') : to.path
  const moved = RENAMED[path]
  if (!moved) return

  // `replace`, so the back button does not bounce off the old address.
  return navigateTo({ path: moved, query: to.query, hash: to.hash }, { replace: true })
})
