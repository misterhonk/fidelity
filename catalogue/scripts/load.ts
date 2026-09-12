/*
 * The load test (docs/17 §4, M23): `autocannon` against `family` and
 * `credits` for a stated number of seconds, and a stated floor.
 *
 *   node scripts/load.ts [--url http://…] [--seconds 10] [--floor 200]
 *
 * Without `--url` the mini-dump is built and served by a child process —
 * the smoke number CI records. With `--url` it is the real service. Point it
 * at the container, not the proxy: Traefik's rate limit answers most of a
 * load test with 429 (measured 2026-09-12 on the home lab, 95 % non-2xx),
 * which is the proxy doing its job and says nothing about the service.
 * Measured past the proxy the same day: ~1,750 requests a second for a
 * family and for a person's credits on the real build, p50 10 ms — the
 * target of 200 met eight times over.
 *
 * A command-line tool talking to whoever ran it; the no-console rule is
 * written for browser code.
 */
/* eslint-disable no-console */
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from 'node:util'

import autocannon from 'autocannon'

import { buildCatalogue } from '../src/etl/build.ts'

const { values } = parseArgs({
  options: {
    url: { type: 'string' },
    seconds: { type: 'string', default: '10' },
    floor: { type: 'string', default: '0' },
    connections: { type: 'string', default: '20' },
  },
})
const seconds = Number(values.seconds)
const floor = Number(values.floor)

let base = values.url
let stop: (() => void) | null = null
if (!base) {
  /*
   * The service in its own process, as it runs for real: client and server
   * in one event loop measure the loop, not the service — and, measured on
   * 2026-09-12, run the process out of memory in three seconds.
   */
  const dataDir = mkdtempSync(join(tmpdir(), 'fidelity-load-'))
  const built = await buildCatalogue({
    dumpDir: new URL('../fixtures/mini-dump/', import.meta.url).pathname,
    date: '20260901',
    out: join(dataDir, '2026-09-01.sqlite'),
  })
  built.db.close()
  symlinkSync('2026-09-01.sqlite', join(dataDir, 'current'))
  const port = 18_788
  const child = spawn(
    process.execPath,
    [new URL('../src/service/server.ts', import.meta.url).pathname],
    {
      env: { ...process.env, CATALOGUE_DATA: dataDir, CATALOGUE_PORT: String(port) },
      stdio: 'ignore',
    },
  )
  base = `http://127.0.0.1:${port}`
  stop = () => {
    child.kill()
    rmSync(dataDir, { recursive: true, force: true })
  }
  // Up when health answers; a second is plenty for a 1 MB build.
  for (let i = 0; i < 50; i++) {
    const ok = await fetch(`${base}/v1/catalogue/health`).then(
      (r) => r.ok,
      () => false,
    )
    if (ok) break
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

const routes = [
  { name: 'family', path: '/v1/catalogue/master/1315/family' },
  { name: 'credits', path: '/v1/catalogue/artist/239/credits' },
]
// The real build has other ids; the first release's master and person exist in both.
if (values.url) {
  routes[0] = { name: 'family', path: '/v1/catalogue/master/1660109/family' }
  routes[1] = { name: 'credits', path: '/v1/catalogue/artist/1/credits' }
}

let worst = Number.POSITIVE_INFINITY
for (const route of routes) {
  const result = await autocannon({
    url: `${base.replace(/\/+$/, '')}${route.path}`,
    connections: Number(values.connections),
    duration: seconds,
  })
  const perSecond = result.requests.average
  worst = Math.min(worst, perSecond)
  console.log(
    `${route.name.padEnd(8)} ${perSecond.toFixed(0).padStart(6)} req/s · p50 ${result.latency.p50} ms · p99 ${result.latency.p99} ms · 2xx ${result['2xx']} · non-2xx ${result.non2xx} · errors ${result.errors}`,
  )
  if (result.non2xx > result['2xx']) {
    console.warn(
      `  mostly non-2xx — a rate limit in front of the service? Point --url at the container.`,
    )
  }
}
stop?.()

if (floor > 0 && worst < floor) {
  console.error(`below the floor: ${worst.toFixed(0)} req/s < ${floor}`)
  process.exit(1)
}
console.log(`floor ${floor}: ok (worst ${worst.toFixed(0)} req/s)`)
