/**
 * The Content-Security-Policy, computed from the build.
 *
 * A static site cannot hand out nonces, so the two inline scripts Nuxt writes
 * — the colour-mode bootstrap and `window.__NUXT__.config` — and the import
 * map are allowed by hash. The hashes change with every build (the config
 * carries the version and the release note), which is why this runs after
 * `nuxt build` and not by hand.
 *
 * `connect-src https:` rather than a host list: the hub and the catalogue are
 * origins the user names in the settings, the vault talks to Dropbox and
 * Google, and Discogs is the fourth. What the policy still forbids is the
 * thing that matters for the token — a `http:` endpoint, a `ws:` socket, a
 * data: URL — and everything a script could inject that is not a script of
 * this build.
 */
import { createHash } from 'node:crypto'

const INLINE = /<script(?![^>]*\ssrc=)([^>]*)>([\s\S]*?)<\/script>/g

/** Hashes for every inline script that the browser would execute — importmaps included, JSON data excluded. */
export function inlineHashes(html) {
  const hashes = new Set()
  for (const match of html.matchAll(INLINE)) {
    const attributes = match[1] ?? ''
    if (/type=["']application\/(ld\+)?json["']/.test(attributes)) continue
    const body = match[2] ?? ''
    hashes.add(`'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`)
  }
  return [...hashes]
}

export function policy(hashes) {
  return [
    "default-src 'self'",
    "connect-src 'self' https:",
    "img-src 'self' https://i.discogs.com data: blob:",
    /*
     * The audio preview's player (ADR-012) is driven by a script from
     * www.youtube.com — the iframe API, and the widget script it loads in
     * turn. From v0.91.2 to v0.105.0 the policy allowed the frame and not the
     * script, and the play button silently went away on every screen.
     */
    `script-src 'self' https://www.youtube.com ${hashes.join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "worker-src 'self' blob:",
    'frame-src https://www.youtube-nocookie.com https://www.youtube.com',
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    "manifest-src 'self'",
    "form-action 'self'",
  ].join('; ')
}
