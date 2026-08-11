import { globSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * The one way to use the message pack wrongly.
 *
 * `useMessages()` returns a ref, and reading `.value` at the top of a
 * `<script setup>` reads it exactly once — at mount, in whichever language
 * happened to be active. The component then keeps those words through a
 * language switch while everything around it changes, which reads as the switch
 * being broken rather than as one panel being stale.
 *
 * It is the same trap as an `Intl` formatter built at import time, one layer
 * up, and it is invisible in review: `const f = useMessages().value.settings`
 * looks perfectly ordinary and works until somebody changes language. It was
 * written once, in `MatchPreferences.vue`, which is why this exists.
 *
 * The shape is specific: a top-level `const` in a `<script setup>`, so the
 * check is too. `.value` inside a `computed()`, inside a function body, or in a
 * template is a read per evaluation and correct — `since()` in `when.ts` does
 * exactly that. Nothing here tries to be a general dataflow analysis; it
 * catches the one line somebody actually writes.
 */
describe('the message pack', () => {
  const FILES = globSync('app/**/*.vue')

  it('is never read into a top-level constant of a <script setup>', () => {
    // Zero indentation is what makes it top-level: everything inside a
    // function, a computed or an object literal is indented by the formatter.
    const AT_SETUP_LEVEL = /^const\s+\w+\s*=\s*useMessages\(\)\.value/m

    const offenders = FILES.filter((file) => AT_SETUP_LEVEL.test(readFileSync(file, 'utf8')))
    expect(offenders).toEqual([])
  })
})
