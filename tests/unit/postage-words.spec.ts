import { readdirSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * One word for one thing (#313): the app says "postage tiers" and
 * "Versandstaffel" everywhere, so no label may call the same table something
 * else. Comments may; only the strings a reader sees are checked.
 */
const code = readdirSync('app/i18n')
  .filter((file) => file.endsWith('.ts'))
  .map((file) =>
    readFileSync(`app/i18n/${file}`, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, ''),
  )
  .join('\n')

describe('the postage words', () => {
  it('never says postage table or Portotabelle to a reader', () => {
    expect(code.match(/.*(postage table|Portotabelle).*/gi) ?? []).toEqual([])
  })
})
