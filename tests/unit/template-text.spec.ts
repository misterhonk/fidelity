import { globSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { withoutComments } from '../helpers/german'

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

/**
 * And the other half of the file — the `<script setup>`.
 *
 * Everything above checks what stands between the tags. But text reaches a
 * screen by two routes, and the second goes through a mustache: `{{ status }}`
 * is empty to the rules above, while the sentence behind it is assembled in
 * the script. That is exactly where the ADR-010 translation left twelve German
 * sentences behind, spread across five files — found on 2026-09-10 by somebody
 * running the demo in a browser and seeing "Lese das Sortiment – Seite 1 von
 * 5" under an English heading.
 *
 * Again a rule about **shape**, not about vocabulary: two words with a space
 * between them are a sentence, and a sentence belongs in the language pack.
 * The comment above explains why word lists were wrong three times.
 */

/** `${…}` is a word boundary and not a word — otherwise `for ${n} days` slips through. */
const INTERPOLATION = /\$\{[^}]*\}/g

/**
 * Strings in pairs and in the order they stand in.
 *
 * The first version here demanded a minimum length of four characters and so
 * jumped over `'/'` — after which it paired one string's closing quote with
 * the next one's opening quote and reported `) return route.path === ` as
 * prose. Every string is recognised; filtering happens afterwards.
 */
const ANY_STRING = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/gs

/** Two words, one space. A word on its own is a key or a class. */
const TWO_WORDS = /[^\W\d_]{2,}[ ]+[^\W\d_]{2,}/u

/**
 * A Tailwind class list is not prose.
 *
 * `text-fid-text-muted hover:text-fid-text` has two words and a space and is
 * still code.
 *
 * The first version demanded that **every** word carry a hyphen or a colon.
 * That held exactly until a real class list had `flex`, `border` and `py-2`
 * side by side — on 2026-09-11, on the stack's buttons. Tailwind has bare
 * utility classes, and a rule forbidding them forbids Tailwind.
 *
 * So the majority rather than all of them: **more than half** the words carry
 * one of the two characters. That stays a rule about shape — class lists are
 * mostly compound, sentences mostly are not. "E-mail address not found" has
 * one of three and is still reported.
 *
 * **The gap, measured and left deliberately:** writing prose *inside* a long
 * class list gets through — with thirteen classes, six words fit alongside
 * before the majority tips. That is acceptable, because a string that lands as
 * `class` **never appears as text**. This guard protects what somebody reads;
 * a sentence in a class attribute is read by nobody.
 */
function isClassList(value: string): boolean {
  const parts = value.split(/\s+/).filter(Boolean)
  if (parts.length < 2) return false

  const compound = parts.filter((part) => part.includes('-') || part.includes(':')).length
  return compound * 2 > parts.length
}

describe('a sentence in a script block', () => {
  const scripts = globSync('app/**/*.vue', { cwd: ROOT }).flatMap((file) => {
    const source = readFileSync(join(ROOT, file), 'utf8')
    const block = /<script setup[^>]*>([\s\S]*?)<\/script>/.exec(source)
    if (!block?.[1]) return []
    // Comments explain things and are allowed to; they appear in no
    // interface.
    const code = withoutComments(block[1])
    return [{ file, code }]
  })

  it('looks at every screen, so a new one cannot slip past', () => {
    expect(scripts.length).toBeGreaterThan(20)
  })

  it('comes from a message pack, like everything between the tags', () => {
    const literals: string[] = []

    for (const { file, code } of scripts) {
      for (const [, single, double, backtick] of code.matchAll(ANY_STRING)) {
        const raw = single ?? double ?? backtick
        if (raw === undefined) continue

        const value = raw.replace(INTERPOLATION, ' ')
        if (!TWO_WORDS.test(value) || isClassList(value) || NOT_PROSE.has(raw)) continue
        literals.push(`${file}: ${raw.slice(0, 70)}`)
      }
    }

    expect(literals).toEqual([])
  })
})

/**
 * And a thrown error message is text somebody reads too.
 *
 * `explain.ts` ends with `title: message || words.unknown` — so a message with
 * no code becomes the **title**, red and at the top. A sentence written as
 * `new Error('…')` is therefore not in the small print; it is the headline.
 *
 * On 2026-09-10 thirteen of them were German, inside an English interface:
 * `useVaultCloud.ts`, `useVaultFile.ts`, `vault-file.ts`. Four messages in the
 * same files already read from the language pack — so the pattern stood beside
 * them and was not followed.
 *
 * Only `app/` is checked. **In the worker this rule does not apply and
 * cannot:** the packs hang off `activeLanguage()` on the main thread, and the
 * worker computes without knowing anything about language (CLAUDE.md). There
 * the right form is a `code` on the `WorkerError` that `explain()` puts into
 * words — `unauthorized`, `hub-unreachable` and `rate-limited` show how. Ten
 * thrown German sentences in the worker are still waiting for it; they are
 * deliberately not listed here as exceptions, because an exception list would
 * make them invisible.
 */
const THROWN = /throw new (?:\w*Error)\(\s*(['"`])((?:[^\\]|\\.)*?)\1/gs

describe('a thrown message', () => {
  const sources = globSync('app/**/*.{ts,vue}', { cwd: ROOT }).map((file) => ({
    file,
    source: readFileSync(join(ROOT, file), 'utf8'),
  }))

  it('reads every file under app/', () => {
    expect(sources.length).toBeGreaterThan(40)
  })

  it('comes from a message pack, because it is shown as the title', () => {
    const literals: string[] = []

    for (const { file, source } of sources) {
      for (const [, , message] of source.matchAll(THROWN)) {
        if (message === undefined) continue
        // `${…}` is a word boundary, not a word.
        if (!TWO_WORDS.test(message.replace(INTERPOLATION, ' '))) continue
        literals.push(`${file}: ${message.slice(0, 70)}`)
      }
    }

    expect(literals).toEqual([])
  })
})
