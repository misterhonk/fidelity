import { DatabaseSync } from 'node:sqlite'

/**
 * The hub's storage.
 *
 * `node:sqlite` ships with Node, so there is no driver, no native build step
 * and nothing to keep compiled against a moving ABI. For a service whose whole
 * point is being trivial to self-host on a Raspberry Pi, that matters more
 * than any feature a real driver would add.
 *
 * Two tables and no relations. What is stored here is a cache of public facts
 * — release ids, roles, catalogue numbers, postage ladders — and a cache does
 * not need referential integrity, it needs to be cheap to throw away.
 *
 * What is deliberately *not* here: Discogs tokens, marketplace prices, user
 * accounts. See the README for why each one would undo the architecture.
 *
 * The third table is the exception that proves it. `vault` holds a block of
 * ciphertext per person so their own devices can find each other — and the hub
 * cannot read a byte of it. It never sees the key, so what it stores is not
 * personal data in any sense it could act on, which is the condition ADR-008
 * sets for it being here at all.
 */
export function openHubDb(path: string): DatabaseSync {
  const db = new DatabaseSync(path)

  // WAL so a read during a write does not block. The hub is tiny, but "tiny"
  // is not "single-threaded" once two friends open the app at once.
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS horizon (
      key         TEXT PRIMARY KEY,
      kind        TEXT NOT NULL,
      entity_id   INTEGER NOT NULL,
      fetched_at  INTEGER NOT NULL,
      release_ids INTEGER NOT NULL,
      body        TEXT NOT NULL,
      updated_at  INTEGER NOT NULL
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS shipping (
      key        TEXT PRIMARY KEY,
      dealer     TEXT NOT NULL,
      country    TEXT NOT NULL,
      body       TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS vault (
      id         TEXT PRIMARY KEY,
      body       TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)

  // What the hub is asked most: "is this entity already expanded?"
  db.exec('CREATE INDEX IF NOT EXISTS horizon_fetched ON horizon (fetched_at)')

  return db
}
