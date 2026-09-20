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

  /*
   * Who stands behind a ladder (M34.3, "confirmed by n").
   *
   * One vote per key and dealer-country: the ladder that key contributed
   * last. The ladder with the most votes is the one `shipping` hands out,
   * and the count goes out with it. Behind the secret door or an open hub
   * every contributor is the same empty owner, so the count there is one —
   * honest, since the hub cannot tell two people apart without keys.
   */
  db.exec(`
    CREATE TABLE IF NOT EXISTS shipping_votes (
      key    TEXT NOT NULL,
      owner  TEXT NOT NULL,
      ladder TEXT NOT NULL,
      body   TEXT NOT NULL,
      at     INTEGER NOT NULL,
      PRIMARY KEY (key, owner)
    )
  `)

  /*
   * Shops, and what they stock (ADR-014).
   *
   * The first table here that is about a *shop* rather than about a record.
   * What may be in it and what may not is the whole of that decision: the
   * name, where it ships from and the label/style/decade distribution of a
   * sampled inventory — all public or derived — and never a price, never how
   * well a shop suits a particular person.
   *
   * `body` holds the fingerprint as JSON. Kept whole rather than in columns
   * because the only question asked of it is "hand it over"; the ranking
   * happens on the device, against a collection the hub never sees.
   */
  db.exec(`
    CREATE TABLE IF NOT EXISTS shops (
      username     TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      ships_from   TEXT NOT NULL,
      num_for_sale INTEGER NOT NULL,
      avatar_url   TEXT NOT NULL,
      body         TEXT NOT NULL,
      seen_at      INTEGER NOT NULL,
      updated_at   INTEGER NOT NULL
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
   * Covers, by release id.
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
  /*
   * Pressing families, by master (M20 #7).
   *
   * What `/masters/{id}/versions` says about an album — how many pressings,
   * which came first, on what — is CC0 catalogue and the same for everybody.
   * Reading it in the shop costs a request per record; whoever fetched a
   * family first saves everybody else that request. Thirty days, like the
   * horizon: pressings are added, never taken away.
   */
  db.exec(`
    CREATE TABLE IF NOT EXISTS families (
      master_id  INTEGER PRIMARY KEY,
      fetched_at INTEGER NOT NULL,
      body       TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS covers (
      release_id INTEGER PRIMARY KEY,
      thumb_url  TEXT NOT NULL,
      cover_url  TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)

  /*
   * The watcher — the one thing that justifies a running process.
   *
   * Without a hub, every device asks every watched shop itself: a hundred
   * users watching the same shop are a hundred queries for the same number.
   * With a hub it is **one**, and everybody gets the same answer.
   *
   * `meta` holds the VAPID keys. They are generated once on first start and
   * have to stay: the public half sits inside every push subscription ever
   * handed out, and a new key invalidates all of them.
   */
  /*
   * A shared find list — ciphertext, and nothing else.
   *
   * The hub stores a block here that it cannot read: the key sits in the `#`
   * fragment of the link, and no browser sends that to a server. What lies
   * here is, to the hub, a string.
   *
   * `expires_at` is **not** "six hours from sharing" but the dig's own
   * `expiresAt`. The other way round, a find list five hours old would end up
   * eleven hours old, and rule 4 forbids showing market data older than six —
   * the clock runs from the scan, not from the sending.
   */
  db.exec(`
    CREATE TABLE IF NOT EXISTS shares (
      id         TEXT PRIMARY KEY,
      body       TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )
  `)

  // Expired rows are cleared away on read; the index makes that cheap.
  db.exec('CREATE INDEX IF NOT EXISTS shares_expires ON shares (expires_at)')

  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)

  /*
   * One recipient. The endpoint comes from the browser's push service and is
   * the address — not the person. The hub does not know who is behind it, and
   * has nowhere it could find out.
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
   * What the hub last saw at a shop. One row per shop, however many are
   * watching it — which is precisely the gain.
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
  // And: "who wants to hear about this shop?"
  db.exec('CREATE INDEX IF NOT EXISTS watches_dealer ON watches (dealer)')

  /*
   * The owner column (docs/17 §3.2): which access key's subject a personal
   * row belongs to; '' on a secret-only hub, where every row is the
   * self-hoster's. Added in place — a hub from before keys keeps its rows.
   */
  for (const table of ['vault', 'watchers']) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
    if (!columns.some((column) => column.name === 'owner')) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN owner TEXT NOT NULL DEFAULT ''`)
    }
  }
  return db
}
