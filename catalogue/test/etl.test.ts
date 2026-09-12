import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as fsSync from 'node:fs'
import { describe, test } from 'node:test'

import { buildCatalogue, check } from '../src/etl/build.ts'
import { parseCatno } from '../src/etl/catno.ts'
import { identifierKind, normaliseIdentifier } from '../src/etl/identifiers.ts'
import { norm } from '../src/etl/names.ts'
import { roleIndex } from '../src/etl/roles.ts'
import { yearOf } from '../src/etl/shape.ts'

/**
 * The ETL on the mini-dump (docs/16 §9, M21.2): four hundred real releases
 * and what they point at, cut from the dump of 2026-09-01, built in memory
 * in well under a second.
 *
 * The golden files under `test/golden/` freeze what the build made of the
 * fixture's messiest fields — every catalogue number, every identifier,
 * every credit string, every artist name — so a change to the parsing is a
 * diff to read, not a number that quietly moved. Regenerate them with
 * `UPDATE_GOLDEN=1 npm test` and explain the diff in the commit.
 */
const golden = <T>(name: string): T =>
  JSON.parse(readFileSync(new URL(`./golden/${name}.json`, import.meta.url), 'utf8')) as T

const built = await buildCatalogue({
  dumpDir: new URL('../fixtures/mini-dump/', import.meta.url).pathname,
  date: '20260901',
  out: ':memory:',
})
const { db } = built

/** node:sqlite rows have no prototype, and strict deepEqual minds — plain copies. */
const plain = <T>(rows: T[]): T[] => rows.map((row) => ({ ...row }))
const one = <T>(row: T): T => ({ ...row })

describe('the build', () => {
  test('reads every row of the four files', () => {
    assert.deepEqual(built.counts, {
      release: 400,
      release_artist: 1467,
      release_label: 438,
      release_format: 400,
      release_style: 1187,
      identifier: 965,
      master: 336,
      artist: 731,
      artist_name: 8669,
      label: 180,
      label_prefix: 164,
    })
  })

  test('names itself after the dump', () => {
    assert.equal(built.build, '2026-09-01')
    const row = db.prepare("SELECT value FROM meta WHERE key = 'build'").get() as {
      value: string
    }
    assert.equal(row.value, '2026-09-01')
  })

  test('keeps the first release the way Discogs has it', () => {
    const first = one(db.prepare('SELECT * FROM release WHERE id = 1').get() as object)
    assert.deepEqual(first, {
      id: 1,
      master_id: 1660109,
      title: 'Stockholm',
      year: 1999,
      country: 'Sweden',
      data_quality: 'Correct',
    })
  })

  test('reads "master 0" as no master', () => {
    const none = db
      .prepare('SELECT COUNT(*) AS n FROM release WHERE master_id IS NULL')
      .get() as {
      n: number
    }
    const zero = db.prepare('SELECT COUNT(*) AS n FROM release WHERE master_id = 0').get() as {
      n: number
    }
    assert.equal(none.n, 61)
    assert.equal(zero.n, 0)
  })
})

describe('what the catalogue is for', () => {
  test('a family: every pressing of a master, oldest first', () => {
    const family = plain(
      db
        .prepare(
          'SELECT id, year, country FROM release WHERE master_id = 1315 ORDER BY year, id',
        )
        .all(),
    )
    assert.deepEqual(family, [
      { id: 157, year: 1994, country: 'UK' },
      { id: 158, year: 1994, country: 'UK' },
    ])
  })

  test('a person: every other name, with the id where there is one', () => {
    const names = db
      .prepare(
        'SELECT name, relation, other_id FROM artist_name WHERE artist_id = 1 ORDER BY relation, name',
      )
      .all() as { name: string; relation: string; other_id: number | null }[]
    assert.equal(names.find((n) => n.relation === 'self')?.name, 'The Persuader')
    assert.deepEqual(
      names.filter((n) => n.relation === 'alias').map((n) => `${n.name}:${n.other_id}`),
      [
        'Dick Track:19541',
        'Faxid:278760',
        'Groove Machine:16055',
        "Janne Me' Amazonen:196957",
        'Jesper Dahlbäck:239',
        'Lenk:25227',
        'The Pinguin Man:439150',
      ],
    )
    assert.deepEqual(
      names.filter((n) => n.relation === 'variation').map((n) => n.name),
      ['Persuader', 'The Presuader'],
    )
  })

  test('a run-out, typed with or without the spaces, is one release', () => {
    const find = db.prepare('SELECT release_id FROM identifier WHERE value_norm = ?')
    const typed = 'mpo sk 032 a1 g phrupmastergeneral t2t london'
    assert.deepEqual(plain(find.all(normaliseIdentifier(typed))), [{ release_id: 1 }])
    assert.deepEqual(
      plain(find.all(normaliseIdentifier('MPO-SK032-A1-G-PHRUPMASTERGENERAL-T2T-LONDON'))),
      [{ release_id: 1 }],
    )
    // A fragment is a fragment: this index answers exact stamps, the search
    // request answers the rest.
    assert.deepEqual(plain(find.all(normaliseIdentifier('MPO SK 032'))), [])
  })

  test("a label's series: the prefixes it actually has", () => {
    const svek = plain(
      db
        .prepare(
          'SELECT prefix, count FROM label_prefix WHERE label_id = 5 ORDER BY count DESC',
        )
        .all(),
    )
    assert.deepEqual(svek, [{ prefix: 'SK', count: 18 }])
  })

  test('a credit: the producer rows for one person, by the index the engine uses', () => {
    const credits = db
      .prepare(
        'SELECT release_id FROM release_artist WHERE artist_id = 239 AND role = 1 ORDER BY release_id',
      )
      .all() as { release_id: number }[]
    assert.ok(credits.length > 0)
    assert.ok(credits.every((c) => c.release_id >= 1 && c.release_id <= 400))
  })

  test('a label knows its parent', () => {
    const svek = one(
      db.prepare('SELECT name, parent_id FROM label WHERE id = 5').get() as object,
    )
    assert.deepEqual(svek, { name: 'Svek', parent_id: 4711 })
  })
})

describe('the golden files', () => {
  const update = process.env.UPDATE_GOLDEN === '1'
  const compare = (name: string, raw: object[]) => {
    const rows = plain(raw)
    if (update) {
      const { writeFileSync } = fsSync
      writeFileSync(
        new URL(`./golden/${name}.json`, import.meta.url),
        JSON.stringify(rows, null, 0) + '\n',
      )
      return
    }
    assert.deepEqual(rows, golden(name))
  }

  test('every catalogue number parses the way it did', () => {
    const rows = plain(
      db
        .prepare(
          'SELECT DISTINCT catno, catno_prefix AS prefix, catno_num AS num FROM release_label ORDER BY catno',
        )
        .all(),
    )
    compare('catnos', rows)
    // And the parser the rows came from agrees with itself on the way back.
    for (const row of rows as { catno: string; prefix: string | null; num: number | null }[]) {
      const parsed = parseCatno(row.catno)
      assert.equal(parsed?.prefix ?? null, row.prefix, row.catno)
      assert.equal(parsed?.num ?? null, row.num, row.catno)
    }
  })

  test('every identifier normalises the way it did', () => {
    compare(
      'identifiers',
      db
        .prepare('SELECT DISTINCT value, type, value_norm FROM identifier ORDER BY value')
        .all(),
    )
  })

  test('every artist name folds the way it did', () => {
    compare(
      'names',
      db
        .prepare(
          "SELECT name, name_norm FROM artist_name WHERE relation = 'self' ORDER BY artist_id",
        )
        .all(),
    )
  })

  test('every credit string maps to the role it did', () => {
    compare(
      'roles',
      plain(
        db
          .prepare(
            "SELECT DISTINCT role_name AS credit, role FROM release_artist WHERE role_name != '' ORDER BY role_name",
          )
          .all(),
      ),
    )
  })
})

describe('the small readers', () => {
  test('a year off a date, and nothing off "0"', () => {
    assert.equal(yearOf('1999-03-00'), 1999)
    assert.equal(yearOf('1999'), 1999)
    assert.equal(yearOf('0'), null)
    assert.equal(yearOf(''), null)
  })

  test('the strongest known role out of a credit string', () => {
    assert.equal(roleIndex('Producer'), 1)
    assert.equal(roleIndex('Written-By, Producer'), 1)
    assert.equal(roleIndex('Mixed By [Additional], Mastered By'), 3)
    assert.equal(roleIndex('Lacquer Cut By'), -1)
    assert.equal(roleIndex(''), -1)
  })

  test('the kinds of identifier', () => {
    assert.equal(identifierKind('Barcode'), 'barcode')
    assert.equal(identifierKind('Matrix / Runout'), 'matrix')
    assert.equal(identifierKind('Rights Society'), 'other')
  })

  test('the name fold, the same as the app’s', () => {
    assert.equal(norm('The Persuader'), 'persuader')
    assert.equal(norm('Jesper Dahlbäck'), 'jesper dahlback')
    assert.equal(norm('Nirvana (2)'), 'nirvana (2)')
  })
})

describe('the row-count check', () => {
  test('refuses a build that lost a third of a table', () => {
    const previous = new URL('../fixtures/previous.sqlite', import.meta.url).pathname
    // Written on the spot: last month, as this month's file would remember it.
    const before = buildCatalogue({
      dumpDir: new URL('../fixtures/mini-dump/', import.meta.url).pathname,
      date: '20260901',
      out: previous,
    })
    return before.then(({ db: old, counts }) => {
      old.close()
      assert.doesNotThrow(() => check({ ...counts, release: 430 }, previous, () => {}))
      assert.throws(
        () => check({ ...counts, release: 260 }, previous, () => {}),
        /release went from 400 to 260/,
      )
      const { rmSync } = fsSync
      rmSync(previous)
    })
  })
})
