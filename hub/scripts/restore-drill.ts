/*
 * The restore drill (docs/17 §4, M23): last night's copy, started as a
 * throwaway hub, asked for health. A backup nobody has restored is a hope.
 *
 *   node scripts/restore-drill.ts [backup dir]
 *
 * Exit 0 when the newest copy opens, has its tables and its VAPID keys, and
 * a hub built on it answers health with the copy's counts.
 */
/* eslint-disable no-console */
import { copyFileSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createHubApp } from '../src/app.ts'
import { inspectBackup } from '../src/backup.ts'
import { openHubDb } from '../src/db.ts'

const dir = process.argv[2] ?? process.env.HUB_BACKUP_DIR ?? './backup'
const newest = readdirSync(dir)
  .filter((name) => /^hub-\d{4}-\d{2}-\d{2}\.sqlite$/.test(name))
  .sort()
  .at(-1)
if (!newest) {
  console.error(`restore drill: no hub-<date>.sqlite in ${dir}`)
  process.exit(1)
}

const copy = join(mkdtempSync(join(tmpdir(), 'fidelity-restore-')), newest)
copyFileSync(join(dir, newest), copy)
let expected: ReturnType<typeof inspectBackup>
try {
  expected = inspectBackup(copy)
} catch (error) {
  console.error(
    `restore drill: ${newest} is not a hub — ${error instanceof Error ? error.message : String(error)}`,
  )
  process.exit(1)
}

const db = openHubDb(copy)
const app = createHubApp({ db, secret: null })
const health = (await (await app.request('/v1/health')).json()) as {
  ok: boolean
  horizon: number
  shipping: number
}
db.close()
rmSync(join(copy, '..'), { recursive: true, force: true })

const sound =
  health.ok && health.horizon === expected.horizon && health.shipping === expected.shipping
console.log(
  `restore drill: ${newest} — ${sound ? 'ok' : 'FAILED'} · horizon ${health.horizon} · shipping ${health.shipping} · vault ${expected.vault} · watchers ${expected.watchers} · vapid keys ${expected.vapid ? 'present' : 'MISSING'}`,
)
process.exit(sound && expected.vapid ? 0 : 1)
