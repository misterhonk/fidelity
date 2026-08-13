import { globSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Nothing a person reads is written into a template.
 *
 * `accessible-names.spec.ts` secured the attributes a screen reader announces.
 * This does the same for the text everybody else sees, and it exists because
 * the attribute sweep was not enough: a screenshot of a seeded browser, taken
 * the same afternoon, showed the record's own page — market position, signals,
 * pressing, discography — still entirely in German on an English interface.
 *
 * It was found by eye, and then hunted with hand-written lists of German
 * words, which missed things three times running: "Gelesen" is not in anybody's
 * word list, and "von" appears in half the templates in the project. A rule
 * about *language* needs a vocabulary and will always have holes. A rule about
 * *shape* does not: text in a template is the violation, whatever language it
 * happens to be in.
 *
 * What is allowed through is deliberately tiny — separators and symbols that
 * are the same in every language, and never a word.
 */

const ROOT = join(import.meta.dirname, '../..')

/** `>…<` in the template, with the mustaches taken out. */
const NODE = /(?<=>)[^<>]+(?=<)/g
const MUSTACHE = /\{\{[\s\S]*?\}\}/g
/** The same, with the expression itself kept. */
const MUSTACHE_BODY = /\{\{([\s\S]*?)\}\}/g
const COMMENT = /<!--[\s\S]*?-->/g

/**
 * Two letters in a row is the line.
 *
 * One letter is a unit or an initial — "5 h", "A". Two is a word, and a word
 * is something somebody translated or forgot to.
 */
const WORD = /\p{L}{2,}/u

const STYLE = /<style[\s\S]*?<\/style>/g

/**
 * Names, addresses and one catalogue number.
 *
 * Everything here is the same in every language, and translating it would make
 * it wrong rather than foreign: a person's name, a URL somebody has to type,
 * the wordmark, and the specimen text on the typeface picker — which is a
 * record's catalogue number precisely because it has to show the figures.
 */
const NOT_PROSE = new Set([
  'Fidelity',
  'PFR 81',
  'Martin Melcher',
  'discogs.com/settings/developers',
  'github.com/misterhonk',
  '/users/…/friends',
])

/**
 * A word in quotes, inside the braces.
 *
 * The sweep above takes the mustaches out before it looks, which is right for
 * what it does and left a hole exactly their size: `{{ x === 'a' ? 'bestellt'
 * : 'befreundet' }}` is not a text node, so nothing saw it. Two of them were
 * still in the app on 2026-08-13 — one in the shop importer, one on the
 * in-store screen, where the English build read out "Suchst du".
 *
 * Comparisons are pulled out first: `x === 'wantlist'` is a value the code
 * tests against, never a value it shows, and those are the only literals in
 * the project's mustaches that legitimately carry a word.
 */
const COMPARISON = /[=!]==?\s*(['"])[^'"]*\1/g
/** And a key into the message pack itself: `d.empty['incremental-empty']`. */
const LOOKUP = /\[\s*(['"])[^'"]*\1\s*\]/g
const LITERAL = /(['"])([^'"]*)\1/g

function templates(): { file: string; template: string }[] {
  return ['app/components', 'app/pages'].flatMap((dir) =>
    globSync('**/*.vue', { cwd: join(ROOT, dir) }).map((name) => {
      const file = join(ROOT, dir, name)
      const source = readFileSync(file, 'utf8')
      const at = source.indexOf('<template>')
      // Mustaches go first: an expression like `{{ n > 0 ? a : b }}` contains a
      // `>` and would otherwise cut a text node in half, leaving half an
      // expression to be reported as prose.
      const template =
        at === -1
          ? ''
          : source.slice(at).replace(COMMENT, '').replace(STYLE, '').replace(MUSTACHE, '')
      return { file: join(dir, name), template }
    }),
  )
}

describe('text in a template', () => {
  const found = templates()

  it('is looked for in every screen, so an empty result means something', () => {
    expect(found.length).toBeGreaterThan(20)
  })

  it('always comes from a message pack', () => {
    const literals: string[] = []

    for (const { file, template } of found) {
      for (const [node] of template.matchAll(NODE)) {
        const text = node.replace(/\s+/g, ' ').trim()
        if (!WORD.test(text) || NOT_PROSE.has(text)) continue
        literals.push(`${file}: ${text.slice(0, 70)}`)
      }
    }

    expect(literals).toEqual([])
  })

  it('never puts a word in quotes inside an expression', () => {
    const literals: string[] = []

    for (const { file } of found) {
      const source = readFileSync(join(ROOT, file), 'utf8')
      const at = source.indexOf('<template>')
      if (at === -1) continue

      const template = source.slice(at).replace(COMMENT, '').replace(STYLE, '')
      for (const [, expression] of template.matchAll(MUSTACHE_BODY)) {
        for (const [, , value] of expression
          .replace(COMPARISON, '')
          .replace(LOOKUP, '')
          .matchAll(LITERAL)) {
          if (!value || !WORD.test(value) || NOT_PROSE.has(value)) continue
          literals.push(`${file}: ${value.slice(0, 70)}`)
        }
      }
    }

    expect(literals).toEqual([])
  })
})
