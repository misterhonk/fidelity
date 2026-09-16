import { serve } from '@hono/node-server'

import { createKeyLimiter, createRevocationList } from './access.ts'
import { createHubApp } from './app.ts'
import { openHubDb } from './db.ts'
import { STALE_AFTER_MS, watchRound } from './watch.ts'

/**
 * Starting the hub.
 *
 * Everything is configured by environment variable and everything has a
 * default that works, because the target is somebody who wants this running in
 * one command on a machine they already own.
 */
const port = Number(process.env.HUB_PORT ?? 8787)
const dbPath = process.env.HUB_DB ?? './hub.sqlite'
const secret = process.env.HUB_SECRET ?? null
const vapidSubject = process.env.HUB_VAPID_SUBJECT ?? 'mailto:hub@fidelity.invalid'
/** Off until somebody switches it on: it is the only thing here that reaches out by itself. */
const watching = process.env.HUB_WATCH === '1'

/**
 * Which Discogs application the watcher knocks as — if any.
 *
 * Both or neither: with only one half Discogs rejects the credentials, and the
 * hub would run at a faster pace than it is allowed.
 */
const discogsKey = process.env.HUB_DISCOGS_KEY
const discogsSecret = process.env.HUB_DISCOGS_SECRET
const identity = discogsKey && discogsSecret ? { key: discogsKey, secret: discogsSecret } : null

/*
 * The second door (docs/17 §3.2): keys signed by the access service. The
 * public key alone makes keys valid here; the URL keeps the revocation list
 * fresh; `HUB_ACCESS_REVOKED` is the list by hand. None of it set: no door.
 */
const accessPublicKey = process.env.HUB_ACCESS_PUBLIC_KEY ?? null
const access = accessPublicKey
  ? {
      publicKey: accessPublicKey,
      revoked: createRevocationList({
        url: process.env.HUB_ACCESS_URL ?? null,
        fixed: (process.env.HUB_ACCESS_REVOKED ?? '')
          .split(',')
          .map((kid) => kid.trim())
          .filter(Boolean),
      }).current,
      limiter: createKeyLimiter(),
    }
  : null

const db = openHubDb(dbPath)
const app = createHubApp({ db, secret, access, limiter: createKeyLimiter() })

serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, (info) => {
  // A server's startup line belongs on stdout, and this is a server rather
  // than the browser code the no-console rule is written for.
  // eslint-disable-next-line no-console
  console.log(`Fidelity-Hub auf :${info.port}, Datenbank ${dbPath}`)
  // Same reasoning as the line above: a server's startup output belongs on
  // stdout, and the no-console rule is written for browser code.
  // eslint-disable-next-line no-console
  console.log(
    watching
      ? `Wächter an — je Laden höchstens einmal pro ${Math.round(STALE_AFTER_MS / 60000)} Minuten`
      : 'Wächter aus (HUB_WATCH=1 schaltet ihn ein)',
  )
  if (watching) {
    // Said, not assumed: the difference is the pace at which this service runs
    // against somebody else's limit, and half-entered credentials show up
    // nowhere else.
    // eslint-disable-next-line no-console
    console.log(
      identity
        ? 'Als Discogs-Anwendung angemeldet — 1.200 ms zwischen zwei Abfragen'
        : 'Ohne Discogs-Kennung — 2.400 ms zwischen zwei Abfragen',
    )
  }
  if (access) {
    // eslint-disable-next-line no-console
    console.log('Zweite Tür: Zugangsschlüssel, geprüft mit HUB_ACCESS_PUBLIC_KEY')
  }
  if (!secret && !access) {
    // Said out loud, every start. An open hub on a public IP is somebody
    // else's cache to fill, and silence would let that happen unnoticed.
    console.warn(
      'HUB_SECRET ist nicht gesetzt — der Hub ist offen für jeden, der ihn erreicht.',
    )
  }
})

/*
 * The watcher, when it is switched on.
 *
 * Every ten minutes, look whether a watched shop has gone longer than an hour
 * unchecked. The tick is not the check interval — it is only finer than it, so
 * that a shop falling due does not wait for the full hour.
 *
 * `unref()`, so this timer does not keep the process from ending.
 */
if (watching) {
  const tick = () => {
    void watchRound({ db, subject: vapidSubject, identity }).catch((error: unknown) => {
      // A pass that fails is no reason to end the service.
      console.warn('[watch] Durchgang fehlgeschlagen:', String(error))
    })
  }
  setTimeout(tick, 10_000).unref()
  setInterval(tick, 10 * 60 * 1000).unref()
}

const shutdown = () => {
  db.close()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
