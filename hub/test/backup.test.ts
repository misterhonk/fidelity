import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, test } from 'node:test'

import { createHubApp } from '../src/app.ts'
import { backupHub, inspectBackup } from '../src/backup.ts'
import { openHubDb } from '../src/db.ts'
import { vapidKeys } from '../src/watch.ts'

/**
 * A copy that a hub can be started from (M23): the online backup while the
 * source is open, the counts on the copy, and a hub built on the copy
 * answering health the same.
 */
describe('the backup', () => {
  test('is a consistent copy with the keys in it, and a hub runs on it', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'fidelity-backup-'))
    try {
      const source = join(dir, 'hub.sqlite')
      const db = openHubDb(source)
      vapidKeys(db)
      db.prepare(
        'INSERT INTO horizon (key, kind, entity_id, fetched_at, release_ids, body, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).run('artist:1', 'artist', 1, 1, 1, '{}', 1)

      const { path, bytes } = await backupHub(
        source,
        dir,
        () => new Date('2026-09-12T02:00:00Z'),
      )
      assert.equal(path, join(dir, 'hub-2026-09-12.sqlite'))
      assert.ok(bytes > 0)
      db.close()

      const seen = inspectBackup(path)
      assert.equal(seen.horizon, 1)
      assert.equal(seen.vapid, true)

      const restored = openHubDb(path)
      const app = createHubApp({ db: restored, secret: null })
      const health = (await (await app.request('/v1/health')).json()) as {
        ok: boolean
        horizon: number
      }
      assert.equal(health.ok, true)
      assert.equal(health.horizon, 1)
      restored.close()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
