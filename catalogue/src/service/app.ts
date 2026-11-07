import { type Context, Hono } from 'hono'
import { cors } from 'hono/cors'
import type { DatabaseSync } from 'node:sqlite'
import { Worker } from 'node:worker_threads'

import { identifierKind, normaliseIdentifier } from '../etl/identifiers.ts'
import { statsSql } from './stats-sql.ts'

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
  /**
   * The file behind `db`, for a worker thread to open on its own — a build
   * from before the `stats` table is counted there, not on this thread.
   * Absent (in tests, in memory): counted here, which is fine for 400 rows.
   */
  path?: () => string | null
  /** Where a read leaves the request thread; a test has fewer rows than `HEAVY_ROWS`. */
  heavyRows?: number
  now?: () => number
}

/** One read, as `read-worker.ts` takes it. */
export interface Read {
  sql: string
  args: (number | string | null)[]
}

type Row = Record<string, unknown>

/** A build this old means the monthly job has stopped — the alert's threshold. */
export const STALE_AFTER_DAYS = 40

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
/** Past this many rows a run or a credit list is read off the request thread. */
export const HEAVY_ROWS = 20_000

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

export function createCatalogueApp({
  db,
  path,
  heavyRows = HEAVY_ROWS,
  now = Date.now,
}: CatalogueAppOptions) {
  const app = new Hono()

  app.use('/v1/*', cors({ origin: '*', allowMethods: ['GET', 'OPTIONS'], maxAge: 86_400 }))

  const meta = (key: string): string | null =>
    (
      db().prepare('SELECT value FROM meta WHERE key = ?').get(key) as
        { value: string } | undefined
    )?.value ?? null

  const onThisThread = (reads: Read[]) =>
    reads.map(
      ({ sql, args }) =>
        db()
          .prepare(sql)
          .all(...args) as Row[],
    )

  const offThread = (file: string, reads: Read[]) =>
    new Promise<Row[][]>((resolve, reject) => {
      const worker = new Worker(new URL('./read-worker.ts', import.meta.url), {
        workerData: { path: file, reads },
      })
      worker.once('message', resolve)
      worker.once('error', reject)
      // Gone without a word: a promise nobody settles would hold `working` for good.
      worker.once('exit', () => reject(new Error('read worker exited')))
    })

  /*
   * The two routes whose size the asker chooses. A label of 350,000 rows took
   * 24 s cold on the home lab (measured 2026-11-07), and on this thread every
   * other route would have waited with it, for anybody who knows the address.
   * So what is large is read off this thread, one at a time, and remembered
   * until the next build: about a hundred labels and people are that large, so
   * the memory stays small and asking twice costs nothing. A second large read
   * while one runs is a 503, which the client treats like any miss.
   *
   * shortcut: below `heavyRows` the read stays here, about a second for 20,000
   * cold rows; lower the line if that ever shows.
   */
  const remembered = new Map<string, string>()
  let rememberedFor: string | null = null
  let working: { key: string; text: Promise<string> } | null = null
  const AS_JSON = { 'Content-Type': 'application/json' }

  async function sized<T>(
    c: Context,
    table: 'release_label' | 'release_artist',
    column: 'label_id' | 'artist_id',
    id: number,
    rows: Read,
    shape: (total: number, rows: T[]) => unknown,
  ): Promise<Response> {
    const build = meta('build')
    // The key carries the build; clearing only keeps last month out of memory.
    if (rememberedFor !== build) {
      remembered.clear()
      rememberedFor = build
    }
    const key = `${build}:${table}:${id}`
    const known = remembered.get(key)
    if (known !== undefined) return c.body(known, 200, AS_JSON)

    const reads: Read[] = [
      {
        sql: `SELECT COUNT(DISTINCT release_id) AS n FROM ${table} WHERE ${column} = ?`,
        args: [id],
      },
      rows,
    ]
    const finish = ([counted, found]: Row[][]) =>
      shape((counted![0] as { n: number }).n, found as unknown as T[])

    const file = path?.() ?? null
    const { n } = db()
      .prepare(`SELECT COUNT(*) AS n FROM (SELECT 1 FROM ${table} WHERE ${column} = ? LIMIT ?)`)
      .get(id, heavyRows + 1) as { n: number }
    if (!file || n <= heavyRows) return c.json(finish(onThisThread(reads)))

    if (working && working.key !== key) {
      return c.json({ error: 'busy' }, 503, { 'Retry-After': '5' })
    }
    working ??= {
      key,
      text: offThread(file, reads)
        .then((read) => JSON.stringify(finish(read)))
        .finally(() => {
          working = null
        }),
    }
    const text = await working.text
    remembered.set(key, text)
    return c.body(text, 200, AS_JSON)
  }

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
    // A 503 is about this moment, and thirty days of it would outlive the moment.
    const lifetime = c.req.path.endsWith('/health') ? 'no-cache' : 'public, max-age=2592000'
    c.header('Cache-Control', c.res.status === 503 ? 'no-store' : lifetime)
  })

  /**
   * Health, with the one failure that looks like success named: a build
   * older than forty days means the job stopped running — the dump is
   * monthly, and a few days of slack for the 1st. Uptime Kuma watches the
   * word `"stale":false` (docs/16 §7); nothing else here has a date.
   */
  app.get('/v1/catalogue/health', (c) => {
    const build = meta('build')
    if (!build) return c.json({ ok: false, build: null, releases: 0, stale: true }, 503)
    const ageDays = (now() - Date.parse(build)) / 86_400_000
    return c.json({
      ok: true,
      build,
      releases: Number(meta('count:release') ?? 0),
      stale: ageDays > STALE_AFTER_DAYS,
    })
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
                (SELECT rf.descriptions FROM release_format rf WHERE rf.release_id = r.id ORDER BY rf.rowid LIMIT 1) AS descriptions,
                (SELECT COALESCE(SUM(rf.qty), 1) FROM release_format rf WHERE rf.release_id = r.id) AS discs
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
        // How many discs, summed over the format blocks the way the app's
        // sync counts them (M34.3): a 2×LP with a bonus 7" is three.
        discs: Math.max(1, Number(row.discs) || 1),
      })),
    })
  })

  /**
   * A label's releases with their catalogue numbers, the series first —
   * what the horizon's label expansion gets from the API, without the
   * 1,500-release cut (S6, any size). Rows, not a packed chunk: the client
   * packs with the app's own `packChunk`, so the two paths cannot disagree.
   */
  app.get('/v1/catalogue/label/:id/run', async (c) => {
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

    return sized<{
      id: number
      year: number | null
      num: number | null
      prefix: string | null
    }>(
      c,
      'release_label',
      'label_id',
      labelId,
      {
        sql: `SELECT rl.release_id AS id, r.year, rl.catno_num AS num, rl.catno_prefix AS prefix
         FROM release_label rl JOIN release r ON r.id = rl.release_id
         WHERE rl.label_id = ?
         ORDER BY (rl.catno_prefix IS ?) DESC, rl.catno_num, rl.release_id
         LIMIT ?`,
        args: [labelId, prefix, MAX_ROWS],
      },
      (total, rows) => ({
        id: label.id,
        name: label.name,
        build: meta('build'),
        total,
        prefix,
        releases: rows.map((row) => [row.id, row.year, row.num, row.prefix]),
      }),
    )
  })

  /**
   * Every release a person is credited on, with the role index the engine
   * uses — what `/artists/{id}/releases` gives the horizon, for anybody
   * (S8, the second degree). A credit the table has no name for counts as
   * main, exactly as the API path does, so a score cannot move between them.
   */
  app.get('/v1/catalogue/artist/:id/credits', async (c) => {
    const artistId = Number(c.req.param('id'))
    if (!Number.isSafeInteger(artistId) || artistId <= 0)
      return c.json({ error: 'not an artist id' }, 400)

    const artist = db().prepare('SELECT id, name FROM artist WHERE id = ?').get(artistId) as
      { id: number; name: string } | undefined
    if (!artist) return c.json({ error: 'unknown artist' }, 404)

    return sized<{ id: number; role: number; year: number | null }>(
      c,
      'release_artist',
      'artist_id',
      artistId,
      {
        sql: `SELECT ra.release_id AS id, MIN(CASE WHEN ra.role < 0 THEN 0 ELSE ra.role END) AS role, r.year
         FROM release_artist ra JOIN release r ON r.id = ra.release_id
         WHERE ra.artist_id = ?
         GROUP BY ra.release_id
         ORDER BY ra.release_id
         LIMIT ?`,
        args: [artistId, MAX_ROWS],
      },
      (total, rows) => ({
        id: artist.id,
        name: artist.name,
        build: meta('build'),
        total,
        releases: rows.map((row) => [row.id, row.role, row.year]),
      }),
    )
  })

  /**
   * Which releases carry this barcode or run-out (M21.6): the index over
   * every identifier in the dump, normalised the way the build normalised
   * it, answering exact stamps — a fragment is the search request's job,
   * as `worker/identify.ts` measured.
   */
  app.get('/v1/catalogue/identify', (c) => {
    const barcode = c.req.query('barcode')?.trim()
    const runout = c.req.query('runout')?.trim()
    const [type, value] = barcode ? ['barcode', barcode] : runout ? ['matrix', runout] : []
    if (!type || !value) return c.json({ error: 'barcode or runout' }, 400)
    if (identifierKind(type) === 'other') return c.json({ error: 'barcode or runout' }, 400)

    const rows = db()
      .prepare(
        'SELECT DISTINCT release_id FROM identifier WHERE type = ? AND value_norm = ? ORDER BY release_id LIMIT 50',
      )
      .all(type, normaliseIdentifier(value)) as unknown as { release_id: number }[]
    return c.json({ releaseIds: rows.map((row) => row.release_id), exact: true })
  })

  /** One release, the CC0 fields the shop screen shows — what a search row would carry. */
  app.get('/v1/catalogue/release/:id', (c) => {
    const releaseId = Number(c.req.param('id'))
    if (!Number.isSafeInteger(releaseId) || releaseId <= 0)
      return c.json({ error: 'not a release id' }, 400)

    const release = db().prepare('SELECT * FROM release WHERE id = ?').get(releaseId) as
      | {
          id: number
          master_id: number | null
          title: string
          year: number | null
          country: string
        }
      | undefined
    if (!release) return c.json({ error: 'unknown release' }, 404)

    const artists = db()
      .prepare(
        `SELECT a.name FROM release_artist ra JOIN artist a ON a.id = ra.artist_id
         WHERE ra.release_id = ? AND ra.role = 0 AND ra.role_name = '' ORDER BY ra.position`,
      )
      .all(releaseId) as unknown as { name: string }[]
    const labels = db()
      .prepare(
        `SELECT l.name, rl.catno FROM release_label rl JOIN label l ON l.id = rl.label_id
         WHERE rl.release_id = ? ORDER BY rl.rowid`,
      )
      .all(releaseId) as unknown as { name: string; catno: string }[]
    const formats = db()
      .prepare(
        'SELECT name, qty, descriptions FROM release_format WHERE release_id = ? ORDER BY rowid',
      )
      .all(releaseId) as unknown as { name: string; qty: number; descriptions: string }[]

    return c.json({
      id: release.id,
      title: release.title,
      year: release.year,
      country: release.country,
      masterId: release.master_id ?? 0,
      artists: artists.map((row) => row.name),
      labels: labels.map((row) => ({ name: row.name, catno: row.catno })),
      formats: formats.map((row) => formatOf(row.name, row.descriptions)),
      // The count stays beside the format words, not inside them: the words
      // are what the matching engine compares, the count is what a parcel
      // weighs (M34.3, `qty` summed the way the app's sync sums it).
      discs: Math.max(
        1,
        formats.reduce((total, row) => total + (Number(row.qty) || 1), 0),
      ),
    })
  })

  /**
   * The catalogue's own distribution (M21.6): what share of everything
   * Discogs knows is from the seventies, is Techno, is British. Counted at
   * build time into `stats`; a build from before that table has it counted
   * once here and remembered for the process.
   */
  const STATS_KINDS = ['decades', 'styles', 'genres', 'countries'] as const
  type Stats = { build: string; total: number; rows: [string, number][] }
  const statsCache = new Map<string, Stats>()
  const statsInFlight = new Map<string, Promise<Stats>>()

  /** Off the request thread when there is a file; on it when there is only memory. */
  async function countStats(kind: string, build: string): Promise<Stats> {
    const reads: Read[] = [
      { sql: statsSql(kind), args: [] },
      { sql: 'SELECT COUNT(*) AS n FROM release', args: [] },
    ]
    const file = path?.() ?? null
    const [rows, counted] = file ? await offThread(file, reads) : onThisThread(reads)
    return {
      build,
      total: (counted![0] as { n: number }).n,
      rows: (rows as unknown as { key: string; count: number }[]).map((row) => [
        row.key,
        row.count,
      ]),
    }
  }

  app.get('/v1/catalogue/stats/:kind', async (c) => {
    const kind = c.req.param('kind') as (typeof STATS_KINDS)[number]
    if (!STATS_KINDS.includes(kind))
      return c.json({ error: 'decades, styles, genres or countries' }, 400)
    const build = meta('build') ?? 'none'
    const cacheKey = `${build}:${kind}`
    const cached = statsCache.get(cacheKey)
    if (cached) return c.json(cached)

    const hasTable = db()
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'stats'")
      .get()
    if (hasTable) {
      const rows = db()
        .prepare('SELECT key, count FROM stats WHERE kind = ? ORDER BY count DESC')
        .all(kind) as unknown as { key: string; count: number }[]
      const total = Number(
        (
          db().prepare("SELECT count FROM stats WHERE kind = 'releases'").get() as
            { count: number } | undefined
        )?.count ?? 0,
      )
      const answer: Stats = { build, total, rows: rows.map((row) => [row.key, row.count]) }
      statsCache.set(cacheKey, answer)
      return c.json(answer)
    }

    // Counted once, off this thread; the first asker waits, the rest share the wait.
    let pending = statsInFlight.get(cacheKey)
    if (!pending) {
      pending = countStats(kind, build).finally(() => statsInFlight.delete(cacheKey))
      statsInFlight.set(cacheKey, pending)
    }
    const answer = await pending
    statsCache.set(cacheKey, answer)
    return c.json(answer)
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
