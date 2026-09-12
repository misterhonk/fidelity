import { readlink } from 'node:fs/promises'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import { serve } from '@hono/node-server'

import { createCatalogueApp } from './app.ts'

/**
 * Starting the catalogue service: `current` in the data dir, read-only.
 *
 * The job (`etl/run.ts`) moves `current` to a new build by renaming a
 * symlink; this process notices within a minute and opens the new file,
 * so a new month arrives without a restart and without a request ever
 * seeing half a file. Until the first build exists, health says so and
 * every other route is a 503.
 */
const port = Number(process.env.CATALOGUE_PORT ?? 8788)
const dataDir = process.env.CATALOGUE_DATA ?? '/data'
const current = join(dataDir, 'current')

let db: DatabaseSync | null = null
let opened: string | null = null

async function follow(): Promise<void> {
  const target = await readlink(current).catch(() => null)
  if (target === opened) return
  const next = target ? new DatabaseSync(join(dataDir, target), { readOnly: true }) : null
  const old = db
  db = next
  opened = target
  old?.close()
  // A server's startup and swap lines belong on stdout; the no-console rule
  // is written for browser code.
  // eslint-disable-next-line no-console
  console.log(target ? `catalogue: serving ${target}` : 'catalogue: no build yet')
}

const app = createCatalogueApp({
  db: () => {
    if (!db) throw new Error('no build')
    return db
  },
})

/*
 * The four distributions, counted once per build in the background: the
 * first build measured 25 s for `stats/decades` on a build from before the
 * `stats` table, and a client waits two seconds — so the first person to
 * open the map would have seen nothing, and only the second the lift.
 * Asked from inside, the answers are in the cache before anybody asks.
 */
async function warm(): Promise<void> {
  if (!db) return
  for (const kind of ['decades', 'styles', 'genres', 'countries']) {
    await app.request(`/v1/catalogue/stats/${kind}`).catch(() => undefined)
  }
}

await follow()
void warm()
setInterval(() => {
  void follow().then(warm)
}, 60_000).unref()
// Without a build, every route but health is a 503 rather than a crash.
app.onError((error, c) =>
  error.message === 'no build'
    ? c.json({ ok: false, build: null, releases: 0 }, 503)
    : c.json({ error: 'catalogue failed' }, 500),
)

serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`fidelity-catalogue on :${info.port}, data ${dataDir}`)
})

const shutdown = () => {
  db?.close()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
