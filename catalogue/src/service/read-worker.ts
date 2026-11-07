import { parentPort, workerData } from 'node:worker_threads'
import { DatabaseSync } from 'node:sqlite'

import type { Read } from './app.ts'

/**
 * Reads too long for the request thread (docs/16 §5).
 *
 * SQLite's queries are synchronous. A GROUP BY over twenty million rows took
 * 25 s on the home lab (measured 2026-09-12), a label of 350,000 rows 24 s
 * cold (2026-11-07): on the request thread that is as long in which health, a
 * family and a barcode all wait, and Traefik answers 502 for everybody. Here it
 * costs nobody anything but the answer's delay.
 */
const { path, reads } = workerData as { path: string; reads: Read[] }
const db = new DatabaseSync(path, { readOnly: true })
try {
  parentPort?.postMessage(reads.map(({ sql, args }) => db.prepare(sql).all(...args)))
} finally {
  db.close()
}
