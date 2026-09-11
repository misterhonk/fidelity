import { globSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { germanComments } from '../helpers/german'

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
const ROOTS = ['worker', 'db', 'shared', 'app', 'tests', 'hub/src']
const SOURCES = ROOTS.flatMap((root) =>
  globSync(`${root}/**/*.{ts,vue,css}`, { exclude: (p) => /node_modules|\.nuxt|dist/.test(p) }),
)

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
