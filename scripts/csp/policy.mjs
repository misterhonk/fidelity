/**
 * The Content-Security-Policy, computed from the build.
 *
 * A static site cannot hand out nonces, so the two inline scripts Nuxt writes
 * — the colour-mode bootstrap and `window.__NUXT__.config` — and the import
 * map are allowed by hash. The hashes change with every build (the config
 * carries the version and the release note), which is why this runs after
 * `nuxt build` and not by hand.
 *
 * `connect-src` is a host list (#204): a script that runs in the origin —
 * injected, or slipped in by a dependency — must not be able to send the
 * token anywhere it likes, and `https:` let it. The hub and the catalogue are
 * found on this origin (`/hub`, `/catalogue`) or on this machine; a
 * self-hoster who runs them on another host names it at build time in
 * `FIDELITY_CONNECT_SRC`, space-separated https origins.
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

/** Every host the app itself fetches from. A new one is a new line here and in the test. */
const CONNECT = [
  'https://api.discogs.com',
  // The service worker's cover cache (app/sw/sw.ts) fetches the covers.
  'https://i.discogs.com',
  // The vault (app/utils/cloud-vault.ts, app/composables/useVaultCloud.ts).
  'https://api.dropboxapi.com',
  'https://content.dropboxapi.com',
  'https://oauth2.googleapis.com',
  'https://www.googleapis.com',
  // A hub or a catalogue on this machine (hub.discover, catalogue.discover).
  'http://localhost:8787',
  'http://127.0.0.1:8787',
  'http://localhost:8788',
  'http://127.0.0.1:8788',
]

const ORIGIN = /^https:\/\/[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?\/?$/i

/** The extra origins a self-hoster names at build time — origins only, so nothing can ride along into the header. */
export function connectHosts(value) {
  return (value ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((origin) => {
      if (!ORIGIN.test(origin))
        throw new Error(`FIDELITY_CONNECT_SRC: ${origin} is not an https origin`)
      return origin.replace(/\/$/, '')
    })
}

export function policy(hashes, extraConnect = []) {
  return [
    "default-src 'self'",
    ["connect-src 'self'", ...CONNECT, ...extraConnect].join(' '),
    "img-src 'self' https://i.discogs.com data: blob:",
    /*
     * No third party. The audio preview's player (ADR-012) used to be driven
     * by YouTube's iframe API, a script from www.youtube.com running with this
     * app's rights; since #203 the frame is driven by postMessage instead.
     */
    `script-src 'self' ${hashes.join(' ')}`.trim(),
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
