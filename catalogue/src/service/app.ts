import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { DatabaseSync } from 'node:sqlite'

/**
 * The catalogue service (docs/16 §5): the hub's shape, read-only, no secret.
 *
 * Every answer is the build's answer — the same for everybody, valid for
 * the month — so every answer carries the build date as its ETag and may be
 * cached by anything between here and the browser for thirty days. A new
 * build is a new ETag; there is nothing to invalidate.
 *
 * M21.4 is the two routes the app already asks the API for: a master's
 * family, and a person's other names. The rest of §5 comes route by route.
 */
export interface CatalogueAppOptions {
  /** The current build, read-only. Swapped by the server when `current` moves. */
  db: () => DatabaseSync
}

export const MAX_SIBLINGS = 200
export const MAX_NAMES = 100
/**
 * A label's or a person's whole list, capped. Columbia has 200,000 releases
 * and a horizon chunk that size is 800 kB packed; as JSON rows over a home
 * connection it is not. Twenty thousand covers every label the engine's
 * signals can say something about — the series rows come first, so a cut
 * label still carries its run.
 */
export const MAX_ROWS = 20_000

interface ReleaseRow {
  id: number
  year: number | null
  country: string
  label: string | null
  catno: string | null
  format: string | null
  descriptions: string | null
}

/** "Vinyl" + ["12\"", "33 ⅓ RPM"] → "Vinyl, 12\", 33 ⅓ RPM" — the API's shape. */
export function formatOf(name: string | null, descriptions: string | null): string {
  const parts = [name ?? '']
  try {
    if (descriptions) parts.push(...(JSON.parse(descriptions) as string[]))
  } catch {
    // A description that is not a list is no description.
  }
  return parts.filter(Boolean).join(', ')
}

export function createCatalogueApp({ db }: CatalogueAppOptions) {
  const app = new Hono()

  app.use('/v1/*', cors({ origin: '*', allowMethods: ['GET', 'OPTIONS'], maxAge: 86_400 }))

  const meta = (key: string): string | null =>
    (
      db().prepare('SELECT value FROM meta WHERE key = ?').get(key) as
        { value: string } | undefined
    )?.value ?? null

  /*
   * The build date on every answer. A `304` when the browser already has
   * this month's answer — a family asked twice in one dig costs bytes once.
   */
  app.use('/v1/catalogue/*', async (c, next) => {
    const build = meta('build') ?? 'none'
    const tag = `"${build}"`
    if (c.req.header('if-none-match') === tag && c.req.path !== '/v1/catalogue/health') {
      return c.body(null, 304, { ETag: tag })
    }
    await next()
    c.header('ETag', tag)
    c.header(
      'Cache-Control',
      c.req.path.endsWith('/health') ? 'no-cache' : 'public, max-age=2592000',
    )
  })

  app.get('/v1/catalogue/health', (c) => {
    const build = meta('build')
    if (!build) return c.json({ ok: false, build: null, releases: 0 }, 503)
    return c.json({ ok: true, build, releases: Number(meta('count:release') ?? 0) })
  })

  /** Every pressing of a master, oldest first — `PressingFamilyFacts`, CC0 fields only. */
  app.get('/v1/catalogue/master/:id/family', (c) => {
    const masterId = Number(c.req.param('id'))
    if (!Number.isSafeInteger(masterId) || masterId <= 0)
      return c.json({ error: 'not a master id' }, 400)

    const total = (
      db().prepare('SELECT COUNT(*) AS n FROM release WHERE master_id = ?').get(masterId) as {
        n: number
      }
    ).n
    if (total === 0) return c.json({ error: 'unknown master' }, 404)

    const rows = db()
      .prepare(
        `SELECT r.id, r.year, r.country,
                (SELECT l.name FROM release_label rl JOIN label l ON l.id = rl.label_id
                  WHERE rl.release_id = r.id ORDER BY rl.rowid LIMIT 1) AS label,
                (SELECT rl.catno FROM release_label rl WHERE rl.release_id = r.id ORDER BY rl.rowid LIMIT 1) AS catno,
                (SELECT rf.name FROM release_format rf WHERE rf.release_id = r.id ORDER BY rf.rowid LIMIT 1) AS format,
                (SELECT rf.descriptions FROM release_format rf WHERE rf.release_id = r.id ORDER BY rf.rowid LIMIT 1) AS descriptions
         FROM release r
         WHERE r.master_id = ?
         ORDER BY r.year IS NULL, r.year, r.id
         LIMIT ?`,
      )
      .all(masterId, MAX_SIBLINGS) as unknown as ReleaseRow[]

    const build = meta('build') ?? '1970-01-01'
    return c.json({
      masterId,
      total,
      // The build's date, so a client's freshness rule reads it as this month's.
      fetchedAt: Date.parse(build),
      siblings: rows.map((row) => ({
        releaseId: row.id,
        year: row.year,
        country: row.country,
        label: row.label ?? '',
        catno: row.catno ?? '',
        format: formatOf(row.format, row.descriptions),
      })),
    })
  })

  /**
   * A label's releases with their catalogue numbers, the series first —
   * what the horizon's label expansion gets from the API, without the
   * 1,500-release cut (S6, any size). Rows, not a packed chunk: the client
   * packs with the app's own `packChunk`, so the two paths cannot disagree.
   */
  app.get('/v1/catalogue/label/:id/run', (c) => {
    const labelId = Number(c.req.param('id'))
    if (!Number.isSafeInteger(labelId) || labelId <= 0)
      return c.json({ error: 'not a label id' }, 400)

    const label = db().prepare('SELECT id, name FROM label WHERE id = ?').get(labelId) as
      { id: number; name: string } | undefined
    if (!label) return c.json({ error: 'unknown label' }, 404)

    const prefix =
      (
        db()
          .prepare(
            'SELECT prefix FROM label_prefix WHERE label_id = ? ORDER BY count DESC, prefix LIMIT 1',
          )
          .get(labelId) as { prefix: string } | undefined
      )?.prefix ?? null
    const total = (
      db()
        .prepare('SELECT COUNT(DISTINCT release_id) AS n FROM release_label WHERE label_id = ?')
        .get(labelId) as {
        n: number
      }
    ).n
    const rows = db()
      .prepare(
        `SELECT rl.release_id AS id, r.year, rl.catno_num AS num, rl.catno_prefix AS prefix
         FROM release_label rl JOIN release r ON r.id = rl.release_id
         WHERE rl.label_id = ?
         ORDER BY (rl.catno_prefix IS ?) DESC, rl.catno_num, rl.release_id
         LIMIT ?`,
      )
      .all(labelId, prefix, MAX_ROWS) as unknown as {
      id: number
      year: number | null
      num: number | null
      prefix: string | null
    }[]

    return c.json({
      id: label.id,
      name: label.name,
      build: meta('build'),
      total,
      prefix,
      releases: rows.map((row) => [row.id, row.year, row.num, row.prefix]),
    })
  })

  /**
   * Every release a person is credited on, with the role index the engine
   * uses — what `/artists/{id}/releases` gives the horizon, for anybody
   * (S8, the second degree). A credit the table has no name for counts as
   * main, exactly as the API path does, so a score cannot move between them.
   */
  app.get('/v1/catalogue/artist/:id/credits', (c) => {
    const artistId = Number(c.req.param('id'))
    if (!Number.isSafeInteger(artistId) || artistId <= 0)
      return c.json({ error: 'not an artist id' }, 400)

    const artist = db().prepare('SELECT id, name FROM artist WHERE id = ?').get(artistId) as
      { id: number; name: string } | undefined
    if (!artist) return c.json({ error: 'unknown artist' }, 404)

    const total = (
      db()
        .prepare(
          'SELECT COUNT(DISTINCT release_id) AS n FROM release_artist WHERE artist_id = ?',
        )
        .get(artistId) as {
        n: number
      }
    ).n
    const rows = db()
      .prepare(
        `SELECT ra.release_id AS id, MIN(CASE WHEN ra.role < 0 THEN 0 ELSE ra.role END) AS role, r.year
         FROM release_artist ra JOIN release r ON r.id = ra.release_id
         WHERE ra.artist_id = ?
         GROUP BY ra.release_id
         ORDER BY ra.release_id
         LIMIT ?`,
      )
      .all(artistId, MAX_ROWS) as unknown as { id: number; role: number; year: number | null }[]

    return c.json({
      id: artist.id,
      name: artist.name,
      build: meta('build'),
      total,
      releases: rows.map((row) => [row.id, row.role, row.year]),
    })
  })

  /** A person and every other name they go by — the lexicon's shape (`Kin`). */
  app.get('/v1/catalogue/artist/:id', (c) => {
    const artistId = Number(c.req.param('id'))
    if (!Number.isSafeInteger(artistId) || artistId <= 0)
      return c.json({ error: 'not an artist id' }, 400)

    const artist = db().prepare('SELECT id, name FROM artist WHERE id = ?').get(artistId) as
      { id: number; name: string } | undefined
    if (!artist) return c.json({ error: 'unknown artist' }, 404)

    const rows = db()
      .prepare(
        `SELECT name, relation FROM artist_name
         WHERE artist_id = ? AND relation != 'self'
         ORDER BY CASE relation WHEN 'variation' THEN 0 WHEN 'alias' THEN 1 WHEN 'member' THEN 2 ELSE 3 END, rowid
         LIMIT ?`,
      )
      .all(artistId, MAX_NAMES) as unknown as { name: string; relation: string }[]

    // A spelling and a side project are both "alias" to the matcher — Discogs
    // says it is the same person either way (worker/horizon/expand.ts, kinOf).
    const seen = new Set<string>()
    const names = rows
      .map((row) => ({
        name: row.name,
        relation: (row.relation === 'variation' ? 'alias' : row.relation) as
          'alias' | 'member' | 'group',
      }))
      .filter((kin) => {
        const key = kin.name.toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

    return c.json({ id: artist.id, name: artist.name, names })
  })

  return app
}
