import { DatabaseSync } from 'node:sqlite'

/**
 * The catalogue's storage: one SQLite file per build, read-only once
 * published (docs/16 §4). `node:sqlite` for the same reason the hub uses it —
 * no driver, no native build, nothing to keep compiled.
 *
 * The tables are docs/16 §4 with three small differences the first cut of
 * real data asked for: `release_artist.role_name` keeps the dump's credit
 * string next to the table index, so a credit the table has no name for is
 * still a row; `release_style` carries genres and styles as (kind, name)
 * rows, because a genre has no style and a style has one genre only by
 * convention; and `artist_name` has a `self` row and the other artist's id,
 * so the lexicon can be built in one query. `credit` is an index on
 * `release_artist`, not a second copy of it.
 */
export function openCatalogueDb(path: string): DatabaseSync {
  return new DatabaseSync(path)
}

export function createSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

    CREATE TABLE release (
      id           INTEGER PRIMARY KEY,
      master_id    INTEGER,
      title        TEXT NOT NULL,
      year         INTEGER,
      country      TEXT NOT NULL,
      data_quality TEXT NOT NULL
    );
    CREATE TABLE release_artist (
      release_id INTEGER NOT NULL,
      artist_id  INTEGER NOT NULL,
      role       INTEGER NOT NULL,
      role_name  TEXT NOT NULL,
      position   INTEGER NOT NULL
    );
    CREATE TABLE release_label (
      release_id   INTEGER NOT NULL,
      label_id     INTEGER NOT NULL,
      catno        TEXT NOT NULL,
      catno_prefix TEXT,
      catno_num    INTEGER
    );
    CREATE TABLE release_format (
      release_id   INTEGER NOT NULL,
      name         TEXT NOT NULL,
      qty          INTEGER NOT NULL,
      text         TEXT NOT NULL,
      descriptions TEXT NOT NULL
    );
    CREATE TABLE release_style (
      release_id INTEGER NOT NULL,
      kind       TEXT NOT NULL,
      name       TEXT NOT NULL
    );
    CREATE TABLE identifier (
      release_id INTEGER NOT NULL,
      type       TEXT NOT NULL,
      value_norm TEXT NOT NULL,
      value      TEXT NOT NULL
    );
    CREATE TABLE master (
      id           INTEGER PRIMARY KEY,
      main_release INTEGER,
      year         INTEGER,
      title        TEXT NOT NULL
    );
    CREATE TABLE artist (
      id        INTEGER PRIMARY KEY,
      name      TEXT NOT NULL,
      real_name TEXT NOT NULL
    );
    CREATE TABLE artist_name (
      artist_id INTEGER NOT NULL,
      name_norm TEXT NOT NULL,
      name      TEXT NOT NULL,
      relation  TEXT NOT NULL,
      other_id  INTEGER
    );
    CREATE TABLE label (
      id        INTEGER PRIMARY KEY,
      name      TEXT NOT NULL,
      parent_id INTEGER
    );
    CREATE TABLE label_prefix (
      label_id INTEGER NOT NULL,
      prefix   TEXT NOT NULL,
      count    INTEGER NOT NULL,
      PRIMARY KEY (label_id, prefix)
    );
  `)
}

/** After the load, not before: an index fed row by row costs the load twice over. */
export function createIndexes(db: DatabaseSync): void {
  db.exec(`
    CREATE INDEX release_master ON release (master_id);
    CREATE INDEX release_artist_release ON release_artist (release_id);
    CREATE INDEX credit ON release_artist (artist_id, role, release_id);
    CREATE INDEX release_label_release ON release_label (release_id);
    CREATE INDEX label_run ON release_label (label_id, catno_prefix, catno_num);
    CREATE INDEX release_format_release ON release_format (release_id);
    CREATE INDEX release_style_release ON release_style (release_id);
    CREATE INDEX identifier_value ON identifier (value_norm);
    CREATE INDEX identifier_release ON identifier (release_id);
    CREATE INDEX artist_name_norm ON artist_name (name_norm);
    CREATE INDEX artist_name_artist ON artist_name (artist_id);
  `)
}

/** The series a label actually has: every prefix with its count. */
export function deriveLabelPrefixes(db: DatabaseSync): void {
  db.exec(`
    INSERT INTO label_prefix (label_id, prefix, count)
    SELECT label_id, catno_prefix, COUNT(*)
    FROM release_label
    WHERE catno_prefix IS NOT NULL
    GROUP BY label_id, catno_prefix
  `)
}

export const TABLES = [
  'release',
  'release_artist',
  'release_label',
  'release_format',
  'release_style',
  'identifier',
  'master',
  'artist',
  'artist_name',
  'label',
  'label_prefix',
] as const

export function counts(db: DatabaseSync): Record<(typeof TABLES)[number], number> {
  const out = {} as Record<(typeof TABLES)[number], number>
  for (const table of TABLES) {
    const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }
    out[table] = row.n
  }
  return out
}
