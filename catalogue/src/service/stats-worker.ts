import { parentPort, workerData } from 'node:worker_threads'
import { DatabaseSync } from 'node:sqlite'

import { statsSql } from './stats-sql.ts'

/**
 * One distribution, counted off the request thread (docs/16 §5).
 *
 * A build from before the `stats` table needs a GROUP BY over twenty
 * million rows — 25 s on the home lab, measured 2026-09-12 — and SQLite's
 * queries are synchronous: on the request thread that is 25 s in which
 * health, a family and a barcode all wait, and Traefik answers 502 for
 * everybody. Here it costs nobody anything but the answer's delay.
 */
const { path, kind } = workerData as { path: string; kind: string }
const db = new DatabaseSync(path, { readOnly: true })
try {
  const rows = db.prepare(statsSql(kind)).all() as unknown as { key: string; count: number }[]
  const total = (db.prepare('SELECT COUNT(*) AS n FROM release').get() as { n: number }).n
  parentPort?.postMessage({ total, rows: rows.map((row) => [row.key, row.count]) })
} finally {
  db.close()
}
