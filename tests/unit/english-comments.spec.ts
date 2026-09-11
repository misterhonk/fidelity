import { globSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { OVERLAPPING, germanComments } from '../helpers/german'

/**
 * ADR-010 says English everywhere — code, comments, commits. The docs were
 * translated on 2026-09-11; the comments were not, and there were 5,473 lines
 * of them across 156 files.
 *
 * **A single pass would only reset a counter.** Two of those files were written
 * in German *during* the session that translated the docs, by somebody who had
 * just read the rule. A rule nothing enforces is a preference.
 *
 * So this is a ratchet, not a pass/fail. `german-comments.txt` lists the files
 * that still carry German, and it can only get shorter:
 *
 * - a file with German comments that is **not** on the list fails — that is a
 *   new one, and the whole point;
 * - a file on the list with **no** German comments left fails too — because a
 *   list that keeps names it no longer needs stops being a measurement, which
 *   is exactly what happened to the roadmap.
 */
/**
 * The whole tree, not a list of places somebody happened to look.
 *
 * It started as six roots and missed two: `hub/test/` and `nuxt.config.ts`,
 * both of which are full of German. A guard with a hand-picked search area
 * guards the search area, and the gaps are invisible from inside it.
 */
const IGNORED = /node_modules|[/.](nuxt|output|nitro|cache)|dist\/|coverage\//
const SOURCES = globSync('**/*.{ts,mts,vue,css}', {
  exclude: (path) => IGNORED.test(path),
})

const LIST = 'tests/fixtures/german-comments.txt'

const listed = new Set(
  readFileSync(LIST, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#')),
)

const german = new Set(SOURCES.filter((path) => germanComments(path).length > 0))

describe('comments are English (ADR-010)', () => {
  it('finds the files it is meant to look at', () => {
    // If the glob ever breaks, every assertion below passes vacuously.
    expect(SOURCES.length).toBeGreaterThan(300)
  })

  it('has no German comment outside the list', () => {
    expect([...german].filter((path) => !listed.has(path)).sort()).toEqual([])
  })

  it('keeps no name on the list that is already clean', () => {
    expect([...listed].filter((path) => !german.has(path)).sort()).toEqual([])
  })
})

/**
 * The heuristic checked against the cases that would make it useless.
 *
 * A detector that flags English prose gets switched off, and one that misses
 * German is decoration. Both halves need a case, and the second one caught
 * this very file's neighbour: `german.ts` flagged its own documentation on
 * 2026-09-11, because the comment quoted three German words while explaining
 * which German words to look for.
 */
describe('the detector', () => {
  const write = (comment: string) => {
    const file = join(tmpdir(), `german-probe-${Math.random().toString(36).slice(2)}.ts`)
    writeFileSync(file, `${comment}\nexport const x = 1\n`)
    return file
  }

  it('does not flag an English sentence that happens to use one of these', () => {
    for (const word of OVERLAPPING) {
      const file = write(`/** The process may ${word} here, and that is fine. */`)
      expect(germanComments(file), word).toEqual([])
      rmSync(file)
    }
  })

  it('flags a German comment of a single line', () => {
    const file = write('// Der Wächter räumt hier nichts weg, und das ist Absicht.')
    expect(germanComments(file)).toHaveLength(1)
    rmSync(file)
  })

  /** The bug that made the scanner necessary — a route pattern, not a comment. */
  it('does not read a comment out of a string literal', () => {
    const file = join(tmpdir(), `german-probe-${Math.random().toString(36).slice(2)}.ts`)
    writeFileSync(
      file,
      [
        "app.use('/v1/*', cors())",
        '// Der Wächter, und zwar nur dieser Kommentar.',
        'const y = 1',
        '/* done */',
      ].join('\n'),
    )
    const found = germanComments(file)
    expect(found).toHaveLength(1)
    expect(found[0]).not.toMatch(/cors/)
    rmSync(file)
  })
})
