import { serve } from '@hono/node-server'

import { createHubApp } from './app.ts'
import { openHubDb } from './db.ts'

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

const db = openHubDb(dbPath)
const app = createHubApp({ db, secret })

serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, (info) => {
  // A server's startup line belongs on stdout, and this is a server rather
  // than the browser code the no-console rule is written for.
  // eslint-disable-next-line no-console
  console.log(`Fidelity-Hub auf :${info.port}, Datenbank ${dbPath}`)
  if (!secret) {
    // Said out loud, every start. An open hub on a public IP is somebody
    // else's cache to fill, and silence would let that happen unnoticed.
    console.warn(
      'HUB_SECRET ist nicht gesetzt — der Hub ist offen für jeden, der ihn erreicht.',
    )
  }
})

const shutdown = () => {
  db.close()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
