import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { vapidKeys } from './watch.ts'
import type { DatabaseSync } from 'node:sqlite'
import { z } from 'zod'

/**
 * The hub's five routes.
 *
 * Two things it caches, both public facts that cost the client requests to
 * work out: which releases an artist or label has, and what a dealer charges
 * for postage. Whoever expanded Conny Plank first saves everybody else eleven
 * requests, and with three users the thirteen-minute first run becomes seconds.
 *
 * The rule that shapes every handler: **a hub that is wrong must be no worse
 * than a hub that is absent.** So a malformed body is rejected rather than
 * stored, a miss is a plain 404, and nothing here ever tells the client
 * anything it could not have worked out itself. The client treats every answer
 * as a suggestion and falls back silently (CLAUDE.md rule 8).
 */

/** Same shape as `shared/wire.ts`, validated here because bodies are untrusted. */
const wireChunkSchema = z.object({
  version: z.number().int(),
  key: z.string().min(3).max(64),
  kind: z.enum(['artist', 'label', 'master']),
  entityId: z.number().int().positive(),
  name: z.string().max(300),
  fetchedAt: z.number().int().nonnegative(),
  complete: z.boolean(),
  requests: z.number().int().nonnegative(),
  catalogueSize: z.number().int().nonnegative().optional(),
  catnoPrefix: z.string().max(32).optional(),
  releaseIds: z.string(),
  roles: z.string(),
  years: z.string(),
  catnoNums: z.string().optional(),
})

const tierSchema = z.object({
  minItems: z.number().int().positive(),
  maxItems: z.number().int().positive().nullable(),
  price: z.number().nonnegative(),
  currency: z.string().length(3),
})

const tiersSchema = z.array(tierSchema).min(1).max(30)

/**
 * How large a contributed chunk may be.
 *
 * A base64 Int32Array of 200.000 ids is about 1 MB, and three of those plus
 * overhead fits in four. Past that it is not a horizon chunk, it is either a
 * mistake or somebody using the hub as a hard disk.
 */
export const MAX_CHUNK_BYTES = 4 * 1024 * 1024

/**
 * A whole horizon plus a shortlist, sealed and base64'd, with room to grow.
 * Larger than a chunk because this is everything at once, and still small
 * enough that a runaway client cannot fill a Raspberry Pi's card overnight.
 */
export const MAX_VAULT_BYTES = 32 * 1024 * 1024

export interface HubOptions {
  db: DatabaseSync
  /** Shared secret. Absent means open — the server says so at startup. */
  secret?: string | null
  now?: () => number
}

export function createHubApp({ db, secret, now = Date.now }: HubOptions) {
  const app = new Hono()

  /*
   * The client is a browser on a different origin, so CORS is not optional.
   * `x-hub-secret` has to be allowed explicitly — it is not a simple header,
   * and without it every request would fail preflight.
   *
   * **POST belongs in this list.** The two watch routes are POST, and without
   * it a browser refuses them at the preflight — no device could ever register
   * for notifications, which is the one thing the hub is running for.
   * Measured 2026-08-13 against the deployed hub, and it survived #110 only
   * because that day's subscription went out through curl, which does not ask
   * anybody's permission.
   */
  app.use(
    '/v1/*',
    cors({
      origin: '*',
      allowMethods: ['GET', 'POST', 'PUT', 'OPTIONS'],
      allowHeaders: ['content-type', 'x-hub-secret'],
      maxAge: 86_400,
    }),
  )

  app.use('/v1/*', async (c, next) => {
    // No secret configured means an open hub, which is a legitimate choice for
    // something on a home network. Health stays open either way so a monitor
    // does not need the secret.
    if (!secret || c.req.path === '/v1/health') return next()
    if (c.req.header('x-hub-secret') !== secret) {
      return c.json({ error: 'wrong or missing x-hub-secret' }, 401)
    }
    return next()
  })

  app.get('/v1/health', (c) =>
    c.json({
      ok: true,
      // Counts, not contents. Enough to see the cache is doing something.
      horizon: (db.prepare('SELECT COUNT(*) AS n FROM horizon').get() as { n: number }).n,
      shipping: (db.prepare('SELECT COUNT(*) AS n FROM shipping').get() as { n: number }).n,
      covers: (db.prepare('SELECT COUNT(*) AS n FROM covers').get() as { n: number }).n,
      watching: (
        db.prepare('SELECT COUNT(DISTINCT dealer) AS n FROM watches').get() as { n: number }
      ).n,
      secured: Boolean(secret),
    }),
  )

  // --- Horizon ------------------------------------------------------------

  app.get('/v1/horizon/:kind/:id', (c) => {
    const key = `${c.req.param('kind')}:${c.req.param('id')}`
    const row = db.prepare('SELECT body FROM horizon WHERE key = ?').get(key) as
      { body: string } | undefined

    // A miss is a 404 and nothing more. The client expands it itself and,
    // if it feels like it, offers the result back.
    if (!row) return c.json({ error: 'not cached' }, 404)
    return c.json(JSON.parse(row.body))
  })

  app.put('/v1/horizon/:kind/:id', async (c) => {
    const raw = await c.req.text()
    if (raw.length > MAX_CHUNK_BYTES) return c.json({ error: 'too large' }, 413)

    const parsed = wireChunkSchema.safeParse(safeJson(raw))
    if (!parsed.success) return c.json({ error: 'not a horizon chunk' }, 400)

    const chunk = parsed.data
    const expected = `${c.req.param('kind')}:${c.req.param('id')}`
    // The body has to be about the thing the URL names. Otherwise one
    // contribution could quietly overwrite an unrelated entity.
    if (chunk.key !== expected) return c.json({ error: 'key does not match the path' }, 400)

    const existing = db
      .prepare('SELECT fetched_at FROM horizon WHERE key = ?')
      .get(expected) as { fetched_at: number } | undefined

    // Older than what is already here changes nothing. Contributions arrive
    // out of order from several clients and the newest expansion wins.
    if (existing && existing.fetched_at >= chunk.fetchedAt) {
      return c.json({ stored: false, reason: 'older than cached' })
    }

    db.prepare(
      `INSERT INTO horizon (key, kind, entity_id, fetched_at, release_ids, body, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         fetched_at = excluded.fetched_at,
         release_ids = excluded.release_ids,
         body = excluded.body,
         updated_at = excluded.updated_at`,
    ).run(
      expected,
      chunk.kind,
      chunk.entityId,
      chunk.fetchedAt,
      // Decoded length is the client's business; the byte count is enough here
      // to see at a glance whether a chunk is plausible.
      chunk.releaseIds.length,
      JSON.stringify(chunk),
      now(),
    )

    return c.json({ stored: true })
  })

  // --- Der Wächter ------------------------------------------------------------

  /*
   * Der öffentliche VAPID-Schlüssel. Ohne ihn kann ein Browser gar nicht erst
   * eine Subscription anlegen, also ist das der erste Aufruf des Clients.
   */
  app.get('/v1/watch/key', (c) => c.json({ publicKey: vapidKeys(db).publicKey }))

  app.post('/v1/watch/subscribe', async (c) => {
    const parsed = subscribeSchema.safeParse(safeJson(await c.req.text()))
    if (!parsed.success) return c.json({ error: 'not a subscription' }, 400)

    const { subscription, dealers } = parsed.data
    const at = now()

    db.prepare(
      `INSERT INTO watchers (endpoint, p256dh, auth, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET
         p256dh = excluded.p256dh, auth = excluded.auth, updated_at = excluded.updated_at`,
    ).run(subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, at, at)

    /*
     * Die Liste wird ersetzt, nicht ergänzt. Sie ist der vollständige Wunsch
     * dieses Geräts — wer einen Laden nicht mehr beobachtet, schickt ihn
     * einfach nicht mehr mit, und ohne dieses Löschen bliebe er für immer.
     */
    db.prepare('DELETE FROM watches WHERE endpoint = ?').run(subscription.endpoint)
    const insert = db.prepare('INSERT INTO watches (endpoint, dealer) VALUES (?, ?)')
    for (const dealer of new Set(dealers)) insert.run(subscription.endpoint, dealer)

    /*
     * Kein Grundwert für neue Läden.
     *
     * `watch_state` bleibt leer, bis der Wächter das erste Mal nachgesehen hat
     * — und dieser erste Blick ist eine Grundlinie und keine Nachricht. Wer
     * einen Laden neu aufnimmt, bekommt also nicht sofort eine Meldung über
     * zweitausend „neue" Platten.
     */
    return c.json({ watching: [...new Set(dealers)].length })
  })

  app.post('/v1/watch/unsubscribe', async (c) => {
    const parsed = unsubscribeSchema.safeParse(safeJson(await c.req.text()))
    if (!parsed.success) return c.json({ error: 'no endpoint' }, 400)

    db.prepare('DELETE FROM watchers WHERE endpoint = ?').run(parsed.data.endpoint)
    db.prepare('DELETE FROM watches WHERE endpoint = ?').run(parsed.data.endpoint)
    return c.json({ removed: true })
  })

  // --- Covers ---------------------------------------------------------------

  /*
   * Gebündelt, nicht einzeln.
   *
   * A screen asks for about a dozen covers at once, and a dozen round trips to
   * a Raspberry Pi — each with its own two-second ceiling — would cost more
   * than the requests they are meant to save.
   */
  app.get('/v1/covers', (c) => {
    const ids = parseIds(c.req.query('ids') ?? '')
    if (ids.length === 0) return c.json({ covers: {} })

    const rows = db
      .prepare(
        `SELECT release_id, thumb_url, cover_url FROM covers
         WHERE release_id IN (${ids.map(() => '?').join(',')})`,
      )
      .all(...ids) as { release_id: number; thumb_url: string; cover_url: string }[]

    const covers: Record<number, { thumbUrl: string; coverUrl: string }> = {}
    for (const row of rows) {
      covers[row.release_id] = { thumbUrl: row.thumb_url, coverUrl: row.cover_url }
    }
    // Misses are simply absent. The client fetches those itself and may offer
    // the answers back.
    return c.json({ covers })
  })

  app.put('/v1/covers', async (c) => {
    const raw = await c.req.text()
    if (raw.length > MAX_COVERS_BYTES) return c.json({ error: 'too large' }, 413)

    const parsed = coversSchema.safeParse(safeJson(raw))
    if (!parsed.success) return c.json({ error: 'not a cover list' }, 400)

    const statement = db.prepare(
      `INSERT INTO covers (release_id, thumb_url, cover_url, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(release_id) DO UPDATE SET
         thumb_url = excluded.thumb_url,
         cover_url = excluded.cover_url,
         updated_at = excluded.updated_at`,
    )

    let stored = 0
    let rejected = 0
    for (const cover of parsed.data.covers) {
      /*
       * Die eigentliche Prüfung, und sie ist keine Formalie.
       *
       * These addresses end up in an `<img src>` on every device that shares
       * this hub. A contributor who could put an arbitrary URL in here could
       * make every one of them fetch anything — a tracking pixel at minimum.
       * So only Discogs' own image host is accepted, and an empty pair, which
       * is how "there is no picture" is recorded.
       *
       * The client checks again on the way in. Neither end trusts the other,
       * which is the only arrangement that survives one of them being wrong.
       */
      if (!isDiscogsImage(cover.thumbUrl) || !isDiscogsImage(cover.coverUrl)) {
        rejected += 1
        continue
      }
      statement.run(cover.releaseId, cover.thumbUrl, cover.coverUrl, now())
      stored += 1
    }

    return c.json({ stored, rejected })
  })

  // --- Shipping -----------------------------------------------------------

  const shippingKey = (dealer: string, country: string) =>
    `${dealer.toLowerCase()}|${country.toLowerCase()}`

  app.get('/v1/shipping/:dealer/:country', (c) => {
    const key = shippingKey(c.req.param('dealer'), c.req.param('country'))
    const row = db.prepare('SELECT body FROM shipping WHERE key = ?').get(key) as
      { body: string } | undefined

    if (!row) return c.json({ error: 'not known' }, 404)
    return c.json({ tiers: JSON.parse(row.body) })
  })

  app.put('/v1/shipping/:dealer/:country', async (c) => {
    const parsed = tiersSchema.safeParse(safeJson(await c.req.text()))
    if (!parsed.success) return c.json({ error: 'not a shipping ladder' }, 400)

    const dealer = c.req.param('dealer')
    const country = c.req.param('country')

    db.prepare(
      `INSERT INTO shipping (key, dealer, country, body, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         body = excluded.body,
         updated_at = excluded.updated_at`,
    ).run(
      shippingKey(dealer, country),
      dealer.toLowerCase(),
      country.toLowerCase(),
      // Stored without the `source` field: on the hub every ladder is
      // somebody's contribution, and the client labels it 'bundled' when it
      // arrives. Keeping a claimed source would let one client's guess look
      // like another's hand-entered table.
      JSON.stringify(parsed.data),
      now(),
    )

    return c.json({ stored: true })
  })

  // --- Vault ---------------------------------------------------------------
  //
  // One block of ciphertext per person, so their own devices can find each
  // other. The hub stores it and can do nothing else with it: the key is
  // derived on the device from a passphrase that never leaves it, so what sits
  // in this table is bytes without meaning.
  //
  // That is the condition ADR-008 attaches to it being here at all. A hub that
  // could read this would be a hub holding somebody's collection, their
  // judgements and their shopping — and then every sentence in ADR-007 about
  // there being no server would be untrue.

  /** Ids are opaque and fixed-length; anything else is not one of ours. */
  const VAULT_ID = /^[a-f0-9]{16,64}$/

  app.get('/v1/vault/:id', (c) => {
    const id = c.req.param('id')
    if (!VAULT_ID.test(id)) return c.json({ error: 'not a vault id' }, 400)

    const row = db.prepare('SELECT body, updated_at FROM vault WHERE id = ?').get(id) as
      { body: string; updated_at: number } | undefined

    // Nothing there yet is the normal first answer, not an error worth a log.
    if (!row) return c.json({ error: 'empty' }, 404)
    return c.json({ sealed: JSON.parse(row.body), updatedAt: row.updated_at })
  })

  app.put('/v1/vault/:id', async (c) => {
    const id = c.req.param('id')
    if (!VAULT_ID.test(id)) return c.json({ error: 'not a vault id' }, 400)

    const raw = await c.req.text()
    if (raw.length > MAX_VAULT_BYTES) return c.json({ error: 'too large' }, 413)

    const parsed = sealedSchema.safeParse(safeJson(raw))
    if (!parsed.success) return c.json({ error: 'not a sealed vault' }, 400)

    db.prepare(
      `INSERT INTO vault (id, body, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         body = excluded.body,
         updated_at = excluded.updated_at`,
    ).run(id, JSON.stringify(parsed.data), now())

    return c.json({ stored: true })
  })

  return app
}

/**
 * The envelope, and only the envelope.
 *
 * The hub checks that this looks like something Fidelity sealed — a version,
 * an iv, a salt, a body — and refuses anything else, which keeps the table
 * from becoming a free pastebin. It cannot check the contents and must not
 * try: it has no key and is not supposed to have one.
 */
const sealedSchema = z.object({
  version: z.number().int().positive(),
  iv: z.string().min(1),
  salt: z.string().min(1),
  cipher: z.string().min(1),
})

/** Never throws. An unparseable body is a 400, not a 500. */
function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** A dozen ids is the normal ask; the cap is against a runaway query. */
const MAX_COVER_IDS = 200

/** Enough for two hundred pairs of URLs and nothing like enough for abuse. */
export const MAX_COVERS_BYTES = 256 * 1024

const coversSchema = z.object({
  covers: z
    .array(
      z.object({
        releaseId: z.number().int().positive(),
        thumbUrl: z.string(),
        coverUrl: z.string(),
      }),
    )
    .max(MAX_COVER_IDS),
})

/**
 * Nur Discogs' eigener Bildhost — oder gar nichts.
 *
 * Empty is a real answer: it records that Discogs holds no picture for that
 * release, which is worth sharing and saves the next person a request. Anything
 * else is refused, because these strings become `<img src>` on every device
 * that shares this hub.
 *
 * Parsed rather than pattern-matched: `https://i.discogs.com.evil.test/x` and
 * `https://evil.test/?a=https://i.discogs.com` both pass a naive `includes`,
 * and neither is Discogs.
 */
function isDiscogsImage(url: string): boolean {
  if (url === '') return true
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && parsed.hostname === 'i.discogs.com'
  } catch {
    return false
  }
}

/** Ids out of `?ids=1,2,3`. Anything that is not a positive integer is dropped. */
function parseIds(raw: string): number[] {
  const seen = new Set<number>()
  for (const part of raw.split(',')) {
    const id = Number(part.trim())
    if (Number.isSafeInteger(id) && id > 0) seen.add(id)
    if (seen.size >= MAX_COVER_IDS) break
  }
  return [...seen]
}

/**
 * Was ein Browser als Push-Subscription herausgibt — und nur das.
 *
 * Der Hub prüft die Form und mehr nicht: Endpunkt und zwei Schlüssel. Es gibt
 * kein Feld für einen Namen, kein Feld für eine Kennung und keines für einen
 * Discogs-Token. Was nicht vorgesehen ist, kann auch nicht versehentlich
 * gespeichert werden.
 */
const subscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url().max(2048),
    keys: z.object({ p256dh: z.string().min(1).max(256), auth: z.string().min(1).max(256) }),
  }),
  /** Höchstens hundert Läden: eine Grenze gegen Unfug, keine Zielgröße. */
  dealers: z.array(z.string().min(1).max(120)).max(100),
})

const unsubscribeSchema = z.object({ endpoint: z.string().url().max(2048) })
