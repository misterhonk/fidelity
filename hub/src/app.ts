import { Hono } from 'hono'
import { cors } from 'hono/cors'
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
   */
  app.use(
    '/v1/*',
    cors({
      origin: '*',
      allowMethods: ['GET', 'PUT', 'OPTIONS'],
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

  return app
}

/** Never throws. An unparseable body is a 400, not a 500. */
function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}
