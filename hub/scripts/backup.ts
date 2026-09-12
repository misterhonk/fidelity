/*
 * The nightly copy of the hub's file (docs/17 §3.2, M23).
 *
 *   node scripts/backup.ts            → one copy now, then one a day
 *   BACKUP_ONCE=1 node scripts/backup.ts → one copy and exit
 *
 * `node:sqlite`'s online backup: a consistent snapshot while the hub keeps
 * writing, into HUB_BACKUP_DIR (/backup) as hub-<date>.sqlite. Fourteen
 * dailies stay. The one thing that cannot be rebuilt — the VAPID keys in
 * `meta` — is in every copy; the rest is a cache, and a cache is what a
 * backup of a cache is for: not losing the keys.
 *
 * A job talking to its log; the no-console rule is written for browser code.
 */
/* eslint-disable no-console */
import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import { backupHub } from '../src/backup.ts'

const dbPath = process.env.HUB_DB ?? './hub.sqlite'
const dir = process.env.HUB_BACKUP_DIR ?? './backup'
const keep = Number(process.env.HUB_BACKUP_KEEP ?? 14)
const once = process.env.BACKUP_ONCE === '1'

const DAY = 24 * 60 * 60 * 1000
for (;;) {
  mkdirSync(dir, { recursive: true })
  try {
    const { path, bytes } = await backupHub(dbPath, dir)
    console.log(`${new Date().toISOString()} backup: ${path} (${bytes} bytes)`)
    const old = readdirSync(dir)
      .filter((name) => /^hub-\d{4}-\d{2}-\d{2}\.sqlite$/.test(name))
      .sort()
      .slice(0, -keep)
    for (const name of old) {
      rmSync(join(dir, name), { force: true })
      console.log(`backup: ${name} removed, ${keep} kept`)
    }
  } catch (error) {
    console.error(`backup: failed — ${error instanceof Error ? error.message : String(error)}`)
    // A failed copy leaves an empty file behind; the drill would trip on it.
    rmSync(join(dir, `hub-${new Date().toISOString().slice(0, 10)}.sqlite`), { force: true })
    if (once) process.exit(1)
  }
  if (once) process.exit(0)
  await new Promise((resolve) => setTimeout(resolve, DAY))
}
