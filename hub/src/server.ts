import { serve } from '@hono/node-server'

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
/** Aus, bis jemand ihn einschaltet: er ist das Einzige hier, das von selbst hinausgeht. */
const watching = process.env.HUB_WATCH === '1'

/**
 * Als welche Discogs-Anwendung der Wächter anklopft — wenn überhaupt.
 *
 * Beides oder nichts: mit nur einer Hälfte weist Discogs die Kennung ab und
 * der Hub liefe schneller getaktet, als er darf.
 */
const discogsKey = process.env.HUB_DISCOGS_KEY
const discogsSecret = process.env.HUB_DISCOGS_SECRET
const identity = discogsKey && discogsSecret ? { key: discogsKey, secret: discogsSecret } : null

const db = openHubDb(dbPath)
const app = createHubApp({ db, secret })

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
    // Gesagt, nicht vermutet: der Unterschied ist der Takt, mit dem dieser
    // Dienst gegen ein fremdes Limit läuft, und eine halb hinterlegte Kennung
    // fällt sonst nirgends auf.
    // eslint-disable-next-line no-console
    console.log(
      identity
        ? 'Als Discogs-Anwendung angemeldet — 1.200 ms zwischen zwei Abfragen'
        : 'Ohne Discogs-Kennung — 2.400 ms zwischen zwei Abfragen',
    )
  }
  if (!secret) {
    // Said out loud, every start. An open hub on a public IP is somebody
    // else's cache to fill, and silence would let that happen unnoticed.
    console.warn(
      'HUB_SECRET ist nicht gesetzt — der Hub ist offen für jeden, der ihn erreicht.',
    )
  }
})

/*
 * Der Wächter, wenn er eingeschaltet ist.
 *
 * Alle zehn Minuten nachsehen, ob ein beobachteter Laden länger als eine
 * Stunde nicht geprüft wurde. Der Takt ist nicht der Prüfabstand — er ist nur
 * feiner als dieser, damit ein Laden, der gerade fällig wird, nicht bis zur
 * vollen Stunde wartet.
 *
 * `unref()`, damit dieser Timer den Prozess nicht am Beenden hindert.
 */
if (watching) {
  const tick = () => {
    void watchRound({ db, subject: vapidSubject, identity }).catch((error: unknown) => {
      // Ein Durchgang, der scheitert, ist kein Grund, den Dienst zu beenden.
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
