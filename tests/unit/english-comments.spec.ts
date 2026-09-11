import { globSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { OVERLAPPING, germanComments } from '../helpers/german'

/**
 * ADR-010 says English everywhere — code, comments, commits. The docs were
 * translated on 2026-09-11; the comments were not, and there were 5,473 lines
 * of them across 141 files.
 *
 * **A single pass would only have reset a counter.** Two of those files were
 * written in German *during* the session that translated the docs, by somebody
 * who had just read the rule. A rule nothing enforces is a preference.
 *
 * So the translation ran behind a ratchet: `tests/fixtures/german-comments.txt`
 * listed the files that still carried German, the list could only get shorter,
 * and the test failed both ways — on a German comment in a file that was not
 * on it, and on a name on it whose file was already clean. The second
 * direction was the one that mattered: a list that keeps names it no longer
 * needs stops being a measurement, which is exactly what had happened to the
 * roadmap.
 *
 * **The list reached zero the same day and is gone.** What stays is the half
 * that was never about the backlog: no German comment, anywhere. M16 said to
 * delete the test with the list — that was written before it was clear the two
 * halves do different jobs. The list was scaffolding. This is the rule.
 */
const IGNORED = /node_modules|[/.](nuxt|output|nitro|cache)|dist\/|coverage\//
const SOURCES = globSync('**/*.{ts,mts,vue,css}', {
  exclude: (path) => IGNORED.test(path),
})

describe('comments are English (ADR-010)', () => {
  it('finds the files it is meant to look at', () => {
    // If the glob ever breaks, the assertion below passes vacuously.
    expect(SOURCES.length).toBeGreaterThan(300)
  })

  it('has no German comment anywhere', () => {
    expect(SOURCES.filter((path) => germanComments(path).length > 0).sort()).toEqual([])
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
