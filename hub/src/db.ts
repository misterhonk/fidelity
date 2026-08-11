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

  /*
   * Cover, nach Release-Id.
   *
   * The marketplace returns listings without images — 1.200 of 1.200 rows
   * across four shops, measured 2026-08-10 — so every cover a client shows
   * costs it one `/releases/{id}`. That is the most expensive per-user cost in
   * the app and it is the same answer for everybody, which is exactly what
   * this hub is for.
   *
   * An empty pair is stored on purpose: "Discogs has no picture for this
   * release" is worth sharing too, and saves the next person the same wasted
   * request.
   */
  db.exec(`
    CREATE TABLE IF NOT EXISTS covers (
      release_id INTEGER PRIMARY KEY,
      thumb_url  TEXT NOT NULL,
      cover_url  TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)

  /*
   * Der Wächter — die eine Sache, die einen laufenden Prozess rechtfertigt.
   *
   * Ohne Hub fragt jedes Gerät jeden beobachteten Laden selbst ab: hundert
   * Nutzer, die denselben Laden beobachten, sind hundert Abfragen für dieselbe
   * Zahl. Mit Hub ist es **eine**, und alle bekommen dieselbe Antwort.
   *
   * `meta` hält die VAPID-Schlüssel. Die werden beim ersten Start einmal
   * erzeugt und müssen danach bleiben: der öffentliche Teil steckt in jeder
   * Push-Subscription, die je vergeben wurde, und ein neuer Schlüssel macht
   * sie alle ungültig.
   */
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)

  /*
   * Ein Empfänger. Der Endpunkt kommt vom Push-Dienst des Browsers und ist
   * die Adresse — nicht die Person. Der Hub weiß nicht, wer dahintersteht,
   * und hat auch keine Stelle, an der er es erfahren könnte.
   */
  db.exec(`
    CREATE TABLE IF NOT EXISTS watchers (
      endpoint   TEXT PRIMARY KEY,
      p256dh     TEXT NOT NULL,
      auth       TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS watches (
      endpoint TEXT NOT NULL,
      dealer   TEXT NOT NULL,
      PRIMARY KEY (endpoint, dealer)
    )
  `)

  /*
   * Was der Hub zuletzt bei einem Laden gesehen hat. Eine Zeile je Laden, egal
   * wie viele ihn beobachten — genau das ist der Gewinn.
   */
  db.exec(`
    CREATE TABLE IF NOT EXISTS watch_state (
      dealer       TEXT PRIMARY KEY,
      num_for_sale INTEGER NOT NULL,
      checked_at   INTEGER NOT NULL
    )
  `)

  // What the hub is asked most: "is this entity already expanded?"
  db.exec('CREATE INDEX IF NOT EXISTS horizon_fetched ON horizon (fetched_at)')
  // Und: "wer will von diesem Laden hören?"
  db.exec('CREATE INDEX IF NOT EXISTS watches_dealer ON watches (dealer)')

  return db
}
