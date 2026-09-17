import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * The voice (docs/20): four checks that catch the relapse.
 *
 * The person behind the counter does not talk about "this app", does not
 * bracket a second thought between dashes, does not write German in the
 * passive of an office letter, does not shout, and says "dig" where the
 * code says "scan". A pack goes on the list below once it has been through
 * the rewrite; from then on a line that slips back is named here.
 */
const DONE = [
  'welcome.ts',
  'dealers.ts',
  'reason.ts',
  'dig.ts',
  'basket.ts',
  'collection.ts',
  'en.ts',
  'de.ts',
]

/** Every string literal in a pack, with the line it starts on. */
function literals(source: string): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = []
  const pattern = /'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g
  for (const hit of source.matchAll(pattern)) {
    // Template holes are code: `${scanned}` is a variable, not a word.
    // "${artist} — ${title}" is how a record is written, not a bracketed thought.
    const text = (hit[1] ?? hit[2] ?? '')
      .replace(/\$\{[^}]*\}\s[—–]\s\$\{[^}]*\}/g, 'A B')
      .replace(/\$\{[^}]*\}/g, '')
    const line = source.slice(0, hit.index).split('\n').length
    // Code, not prose: imports, keys, template holes on their own.
    if (/^[~#./@A-Za-z0-9_-]+$/.test(text) && !/\s/.test(text)) continue
    out.push({ line, text })
  }
  return out
}

const CHECKS: { name: string; bad: RegExp }[] = [
  // "die App öffnest" is you handling a thing; "diese App sieht nicht" is the thing talking about itself.
  { name: 'talks about itself', bad: /\b(?:this app|diese App|the user|der Nutzer)\b/ },
  { name: 'brackets a thought in dashes', bad: /\s[—–]\s/ },
  {
    name: 'writes German like an office',
    bad: /\b(?:wurde|erfolgt|ermöglicht|ist erforderlich)\b/,
  },
  { name: 'shouts', bad: /!(?:\s|$)/ },
  { name: 'says scan for dig', bad: /\b[Ss]cann?(?:s|ed|ing|en|t)?\b/ },
]

describe('the voice', () => {
  for (const pack of DONE) {
    it(`holds in ${pack}`, () => {
      const source = readFileSync(`app/i18n/${pack}`, 'utf8')
      const strays: string[] = []
      for (const { line, text } of literals(source)) {
        for (const check of CHECKS) {
          if (check.bad.test(text)) strays.push(`${pack}:${line} ${check.name}: ${text}`)
        }
      }
      expect(strays).toEqual([])
    })
  }
})
