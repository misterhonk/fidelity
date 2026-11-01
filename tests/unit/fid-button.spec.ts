import { readFileSync, readdirSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { withoutComments } from '../helpers/german'

/**
 * Four tiers, nothing else (#221).
 *
 * Primary, secondary, tertiary, destructive — all of them `FidButton`. What
 * this file holds is the part a type cannot: that nobody spells a filled
 * surface by hand again, and that a destructive button always has its way back.
 */

const files = readdirSync('app', { recursive: true, encoding: 'utf8' })
  .filter((file) => file.endsWith('.vue') || file.endsWith('.css') || file.endsWith('.ts'))
  .map((file) => ({ file, source: readFileSync(`app/${file}`, 'utf8') }))

const BUTTON = readFileSync('app/components/FidButton.vue', 'utf8')

describe('FidButton', () => {
  it('is the only place a filled surface is spelled', () => {
    const strays = files
      .filter(({ file }) => file !== 'components/FidButton.vue')
      .filter(({ source }) => /\bfid-fill\b/.test(withoutComments(source)))
      .map(({ file }) => file)

    expect(strays).toEqual([])
  })

  it('has exactly the four tiers', () => {
    const tiers = BUTTON.match(/variant\?: ([^\n]+)/)?.[1]
    expect(tiers).toBe("'primary' | 'secondary' | 'tertiary' | 'destructive'")
  })

  /**
   * A thumb, not a cursor: 44 px under `pointer: coarse`. The e2e in
   * `tests/e2e/buttons.spec.ts` measures it on a touch profile; this keeps the
   * rule from being deleted along with a refactor of the styles.
   */
  it('grows to 44 px under a coarse pointer', () => {
    const coarse = BUTTON.slice(BUTTON.indexOf('@media (pointer: coarse)'))
    expect(coarse).toMatch(/min-height:\s*44px/)
    expect(coarse).toMatch(/min-width:\s*44px/)
  })

  /**
   * Destructive always comes with an undo line.
   *
   * The undo is read in the same file, or — where the card that holds the
   * button disappears with its last line — on the page named here.
   */
  const UNDO_ON = { 'components/BasketCard.vue': 'pages/basket.vue' } as const

  it('never destroys without a way back', () => {
    const destructive = files.filter(({ source }) =>
      /<FidButton\b[^>]*\bvariant="destructive"/s.test(withoutComments(source)),
    )
    expect(destructive.length, 'nothing is destructive yet').toBeGreaterThan(0)

    for (const { file, source } of destructive) {
      const where = UNDO_ON[file as keyof typeof UNDO_ON]
      const page = where ? readFileSync(`app/${where}`, 'utf8') : source
      expect(page, `${file} has no undo line`).toMatch(
        /role="status"[\s\S]*@click="undo\w*\(?\)?"/,
      )
    }
  })
})
