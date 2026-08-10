import { existsSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * Der Index verweist auf nichts, was es nicht gibt.
 *
 * The settings overview is a list of links and nothing else. A renamed page
 * file breaks it without breaking a type, without breaking a build, and
 * without anybody noticing until they tap the entry — which is exactly the
 * failure a static check is good at.
 */
const INDEX = 'app/pages/einstellungen/index.vue'

describe('the settings overview', () => {
  const source = readFileSync(INDEX, 'utf8')
  const targets = [...source.matchAll(/to: '\/einstellungen\/([a-z-]+)'/g)].map(
    (match) => match[1],
  )

  it('links to at least the sections that exist', () => {
    // Not an exact count on purpose: adding a section should not need this
    // number edited. What must hold is that the index is not empty.
    expect(targets.length).toBeGreaterThanOrEqual(7)
  })

  it.each(targets)('/einstellungen/%s has a page behind it', (name) => {
    expect(existsSync(`app/pages/einstellungen/${name}.vue`)).toBe(true)
  })
})
