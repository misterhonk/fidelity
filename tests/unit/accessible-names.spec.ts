import { globSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * An accessible name is text, and all text comes from a pack.
 *
 * This is here because of what a seeded browser test found on the day the
 * interface was supposedly translated: twenty-odd `aria-label`s still in
 * German, on match cards, feedback buttons, the command palette and the
 * in-store list. Every one of them had survived a file-by-file translation of
 * thirty-six files, and none of them was a mystery afterwards — they are
 * invisible. Nobody proofreads a string they cannot see, and until
 * `populated.spec.ts` existed no test rendered the components that carry them.
 *
 * So the rule is structural rather than linguistic: a name a screen reader
 * announces may not be a literal in a template. Not because a literal is
 * always wrong — because "is this German?" is a question a person has to
 * remember to ask, and "is this bound?" is one a machine can ask every time.
 *
 * Three things are allowed to stay literal, and the list is deliberately short:
 *
 * - `alt=""`, which is not a name but the explicit absence of one.
 * - A URL. `https://www.discogs.com/sell/item/1260275694` in a paste field is
 *   an example of the input, and translating it would break it.
 * - Something with no letters in it at all, like the `60` in a budget field.
 *
 * "Germany" was not on that list and was caught by it — an English word in a
 * German interface is as wrong as the reverse, and rather easier to walk past.
 */

const ROOT = join(import.meta.dirname, '../..')
const NAMED = /(?:^|\s)(aria-label|alt|title|placeholder)="([^"]*)"/g

/** An example of machine input, rather than something written for a person. */
function isNotProse(value: string): boolean {
  return (
    value === '' ||
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    !/\p{L}/u.test(value)
  )
}

function templatesUnder(dir: string): string[] {
  return globSync('**/*.vue', { cwd: join(ROOT, dir) }).map((file) => join(dir, file))
}

describe('anything a screen reader reads out', () => {
  const files = [...templatesUnder('app/components'), ...templatesUnder('app/pages')]

  it('covers the whole interface, so the guard cannot pass by finding nothing', () => {
    // A glob that silently matches zero files is a green test that checks
    // nothing — the exact failure this file exists to prevent.
    expect(files.length).toBeGreaterThan(20)
  })

  it('comes from a message pack, never from a literal in the template', () => {
    const literals: string[] = []

    for (const file of files) {
      const source = readFileSync(join(ROOT, file), 'utf8')
      for (const [, attribute, value] of source.matchAll(NAMED)) {
        if (isNotProse(value)) continue
        literals.push(`${file}: ${attribute}="${value}"`)
      }
    }

    expect(literals).toEqual([])
  })
})
