import { statSync } from 'node:fs'
import { join } from 'node:path'
import { backup, DatabaseSync } from 'node:sqlite'

/**
 * A consistent copy of the hub's file while it is in use, and the drill that
 * proves a copy is worth anything: a hub started from it that answers
 * health with the same counts.
 */
export async function backupHub(
  dbPath: string,
  dir: string,
  now: () => Date = () => new Date(),
): Promise<{ path: string; bytes: number }> {
  const stamp = now().toISOString().slice(0, 10)
  const path = join(dir, `hub-${stamp}.sqlite`)
  const source = new DatabaseSync(dbPath, { readOnly: true })
  try {
    await backup(source, path)
  } finally {
    source.close()
  }
  return { path, bytes: statSync(path).size }
}

/** What a restored hub would say: the counts health reports, read off the copy. */
export function inspectBackup(path: string): {
  horizon: number
  shipping: number
  vault: number
  watchers: number
  vapid: boolean
} {
  const db = new DatabaseSync(path, { readOnly: true })
  try {
    const count = (table: string) =>
      (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n
    const vapid = db.prepare("SELECT 1 FROM meta WHERE key = 'vapid'").get()
    return {
      horizon: count('horizon'),
      shipping: count('shipping'),
      vault: count('vault'),
      watchers: count('watchers'),
      vapid: Boolean(vapid),
    }
  } finally {
    db.close()
  }
}
