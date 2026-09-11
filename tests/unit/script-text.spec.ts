import { globSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { GERMAN, withoutComments } from '../helpers/german'

/**
 * No German in a string literal outside the message packs.
 *
 * `template-text.spec.ts` reads what stands between tags, and it is right
 * about that. It left a hole exactly the shape of a template literal: on
 * 2026-09-11 the basket said *"All still there – 4 Platten, prices current
 * again."* and the catalogue-run grid read *"– hast du"* to a screen reader,
 * both composed in a `<script>` block with backticks, both invisible to a
 * check that only looks at markup.
 *
 * So this looks at the literals themselves — `'…'`, `"…"` and `` `…` `` in
 * every source file that is not a message pack — and calls one German when it
 * carries a German function word. The word list is the one the comment guard
 * uses, and for the same reason: a rule about *language* needs a vocabulary,
 * and this one is small enough to have no false positives worth naming.
 *
 * What is not looked at, and why: the message packs (that is where German
 * belongs); the generated icon file; the demo seeds, which quote real record
 * titles, and a record may be called whatever its label called it; the
 * postage parser, whose job is to *recognise* German shipping tables ("jede
 * weitere", "alle anderen Länder"); and `shared/notify.ts`, the two-line
 * message pack the service worker carries because it cannot load the real one.
 */

const ROOT = join(import.meta.dirname, '../..')

const FILES = [
  ...globSync('app/**/*.{vue,ts}', { cwd: ROOT }),
  ...globSync('worker/**/*.ts', { cwd: ROOT }),
  ...globSync('shared/**/*.ts', { cwd: ROOT }),
  ...globSync('db/**/*.ts', { cwd: ROOT }),
].filter(
  (file) =>
    !file.startsWith('app/i18n/') &&
    !file.endsWith('.generated.ts') &&
    !file.endsWith('demo-seeds.ts') &&
    !file.endsWith('sample-finds.ts') &&
    !file.endsWith('parse-shipping.ts') &&
    file !== 'shared/notify.ts',
)

/** Every quoted span, escapes respected. `${…}` inside a backtick string is skipped. */
const LITERAL = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g
const INTERPOLATION = /\$\{[^}]*\}/g

describe('no German in a string literal', () => {
  it('finds none outside the message packs', () => {
    const found: string[] = []
    for (const file of FILES) {
      const source = withoutComments(readFileSync(join(ROOT, file), 'utf8'))
      for (const literal of source.match(LITERAL) ?? []) {
        const text = literal.replace(INTERPOLATION, ' ')
        const words = new Set(
          (text.match(GERMAN) ?? [])
            .filter((word) => word !== word.toUpperCase())
            .map((word) => word.toLowerCase()),
        )
        if (words.size > 0) found.push(`${file}: ${literal.slice(0, 60)}`)
      }
    }
    expect(found).toEqual([])
  })
})
