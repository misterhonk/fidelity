import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'

import type { DatabaseSync } from 'node:sqlite'

import {
  counts,
  createIndexes,
  createSchema,
  deriveLabelPrefixes,
  deriveStats,
  openCatalogueDb,
  TABLES,
} from './db.ts'
import { shapeArtist, shapeLabel, shapeMaster, shapeRelease } from './shape.ts'
import { entities, openDump } from './xml.ts'

/**
 * The build (docs/16 §4): four files in, one SQLite file out.
 *
 * One pass per file, one transaction per ten thousand entities, indexes
 * after the load. No DuckDB and no Parquet between the dump and the file —
 * the shaping turned out to be row-local (one entity becomes its rows and
 * nothing else's), and a row-local job wants a stream, not a warehouse. The
 * one set-oriented step, the label prefixes, is a GROUP BY at the end. If a
 * full run on the home lab takes longer than a night (M21.3 measures it),
 * DuckDB is the fallback §4 named; nothing here would change but this file.
 *
 * `check` is rule 4 of §4: row counts against the previous build, within
 * ten percent or the build refuses to publish. A dump that shrank by a third
 * is a broken dump, not a smaller one.
 */
export interface BuildOptions {
  /** The four files by their published names, `discogs_<date>_<entity>.xml[.gz]`. */
  dumpDir: string
  /** "20260901" — the dump's own date, which becomes the build's name. */
  date: string
  /** The SQLite file to write; ':memory:' for a test. Replaced if it exists. */
  out: string
  /** Last month's file, for the row-count check; absent on the first build. */
  previous?: string
  batch?: number
  log?: (line: string) => void
  /** Called when a file's rows are all in — the job deletes it here to make room. */
  afterFile?: (entity: string, path: string) => Promise<void> | void
}

export interface BuildResult {
  db: DatabaseSync
  build: string
  counts: Record<(typeof TABLES)[number], number>
}

const BATCH = 10_000

export async function buildCatalogue(options: BuildOptions): Promise<BuildResult> {
  const { dumpDir, date, out, log = () => {} } = options
  const batch = options.batch ?? BATCH
  if (out !== ':memory:' && existsSync(out)) rmSync(out)
  const db = openCatalogueDb(out)
  // Bulk load: nothing to protect until the file is published, so no journal
  // and no fsync per transaction. A crash here leaves a file to delete.
  db.exec('PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF; PRAGMA temp_store = MEMORY')
  createSchema(db)

  const file = (entity: string) => {
    const plain = join(dumpDir, `discogs_${date}_${entity}.xml`)
    return existsSync(plain) ? plain : `${plain}.gz`
  }

  /**
   * Streams one file into the prepared statements, `batch` entities per
   * transaction. One entity the shaping or the database refuses is logged
   * and skipped, not the end of a forty-minute run: eighteen million rows
   * have shapes nobody has seen, and the row-count check below is where a
   * build with too many of them is caught.
   */
  async function load<T>(entity: string, tag: string, insert: (node: T) => void) {
    const path = file(entity)
    let n = 0
    let skipped = 0
    db.exec('BEGIN')
    for await (const node of entities(openDump(path), tag)) {
      try {
        insert(node as T)
      } catch (error) {
        skipped += 1
        if (skipped <= 10) {
          const id = (node as { attrs?: { id?: string } }).attrs?.id ?? '?'
          log(
            `${entity}: skipped ${id} — ${error instanceof Error ? error.message : String(error)}`,
          )
        }
      }
      n += 1
      if (n % batch === 0) {
        db.exec('COMMIT')
        db.exec('BEGIN')
        if (n % (batch * 10) === 0) log(`${entity}: ${n}`)
      }
    }
    db.exec('COMMIT')
    log(`${entity}: ${n} done${skipped ? `, ${skipped} skipped` : ''}`)
    if (skipped > n / 1000) {
      throw new Error(
        `check: ${entity} — ${skipped} of ${n} entities could not be shaped, which is not a dump but a bug`,
      )
    }
    await options.afterFile?.(entity, path)
  }

  const ins = {
    release: db.prepare('INSERT INTO release VALUES (?, ?, ?, ?, ?, ?)'),
    artist: db.prepare('INSERT INTO release_artist VALUES (?, ?, ?, ?, ?)'),
    label: db.prepare('INSERT INTO release_label VALUES (?, ?, ?, ?, ?)'),
    format: db.prepare('INSERT INTO release_format VALUES (?, ?, ?, ?, ?)'),
    style: db.prepare('INSERT INTO release_style VALUES (?, ?, ?)'),
    identifier: db.prepare('INSERT INTO identifier VALUES (?, ?, ?, ?)'),
    master: db.prepare('INSERT OR REPLACE INTO master VALUES (?, ?, ?, ?)'),
    artistRow: db.prepare('INSERT OR REPLACE INTO artist VALUES (?, ?, ?)'),
    artistName: db.prepare('INSERT INTO artist_name VALUES (?, ?, ?, ?, ?)'),
    labelRow: db.prepare('INSERT OR REPLACE INTO label VALUES (?, ?, ?)'),
  }

  await load('releases', 'release', (node) => {
    const r = shapeRelease(node as never)
    ins.release.run(
      r.release.id,
      r.release.master_id,
      r.release.title,
      r.release.year,
      r.release.country,
      r.release.data_quality,
    )
    for (const a of r.artists)
      ins.artist.run(a.release_id, a.artist_id, a.role, a.role_name, a.position)
    for (const l of r.labels)
      ins.label.run(l.release_id, l.label_id, l.catno, l.catno_prefix, l.catno_num)
    for (const f of r.formats)
      ins.format.run(f.release_id, f.name, f.qty, f.text, f.descriptions)
    for (const s of r.styles) ins.style.run(s.release_id, s.kind, s.name)
    for (const i of r.identifiers)
      ins.identifier.run(i.release_id, i.type, i.value_norm, i.value)
  })
  await load('masters', 'master', (node) => {
    const m = shapeMaster(node as never)
    ins.master.run(m.id, m.main_release, m.year, m.title)
  })
  await load('artists', 'artist', (node) => {
    const { artist, names } = shapeArtist(node as never)
    ins.artistRow.run(artist.id, artist.name, artist.real_name)
    for (const n of names)
      ins.artistName.run(n.artist_id, n.name_norm, n.name, n.relation, n.other_id)
  })
  await load('labels', 'label', (node) => {
    const l = shapeLabel(node as never)
    ins.labelRow.run(l.id, l.name, l.parent_id)
  })

  deriveLabelPrefixes(db)
  deriveStats(db)
  createIndexes(db)
  db.exec('ANALYZE')

  const build = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`
  const now = counts(db)
  if (options.previous) check(now, options.previous, log)

  const meta = db.prepare('INSERT INTO meta VALUES (?, ?)')
  meta.run('build', build)
  meta.run('built_at', new Date().toISOString())
  for (const table of TABLES) meta.run(`count:${table}`, String(now[table]))

  return { db, build, counts: now }
}

/** ±10 % per table against last month, or refuse — docs/16 §4 step 4. */
export function check(
  now: Record<string, number>,
  previous: string,
  log: (line: string) => void,
): void {
  const before = openCatalogueDb(previous)
  try {
    for (const table of TABLES) {
      const row = before
        .prepare(`SELECT value FROM meta WHERE key = ?`)
        .get(`count:${table}`) as { value: string } | undefined
      if (!row) continue
      const was = Number(row.value)
      const is = now[table] ?? 0
      const drift = was === 0 ? 0 : Math.abs(is - was) / was
      if (drift > 0.1) {
        throw new Error(
          `check: ${table} went from ${was} to ${is} rows (${Math.round(drift * 100)} %) — not publishing`,
        )
      }
      log(`check: ${table} ${was} → ${is}`)
    }
  } finally {
    before.close()
  }
}

/* The command line: `node src/etl/build.ts --dump <dir> --date 20260901 --out <file> [--previous <file>]` */
if (process.argv[1]?.endsWith('build.ts')) {
  const { values } = parseArgs({
    options: {
      dump: { type: 'string' },
      date: { type: 'string' },
      out: { type: 'string' },
      previous: { type: 'string' },
    },
  })
  if (!values.dump || !values.date || !values.out) {
    console.error(
      'usage: build.ts --dump <dir> --date <yyyymmdd> --out <file> [--previous <file>]',
    )
    process.exit(2)
  }
  const started = Date.now()
  const result = await buildCatalogue({
    dumpDir: values.dump,
    date: values.date,
    out: values.out,
    previous: values.previous,
    // A command-line tool talking to whoever ran it, not browser code.
    // eslint-disable-next-line no-console
    log: (line) => console.log(line),
  })
  result.db.close()
  // eslint-disable-next-line no-console
  console.log(
    `build ${result.build}: ${JSON.stringify(result.counts)} in ${Math.round((Date.now() - started) / 1000)} s`,
  )
}
