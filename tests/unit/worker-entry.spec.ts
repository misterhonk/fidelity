import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * The deferred handler groups stay deferred (#299).
 *
 * The worker's start-up budget is a size-limit entry, and that catches growth
 * only once it crosses the line. This catches the cause the day it is written:
 * a static import of a group module, or a `basket.*` / `hub.*` handler written
 * inline in the table again, puts that code ahead of the first answer.
 */
const source = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

function staticImports(code: string): string[] {
  return [...code.matchAll(/^(?:import|export)\s+(?!type\b)[^'"=;]*['"]([^'"]+)['"]/gm)].map(
    (m) => m[1]!,
  )
}

const GROUPS = { basket: './basket/handlers', hub: './hub/handlers' } as const

describe('worker entry', () => {
  it('imports no deferred handler group statically', () => {
    for (const file of ['worker/index.ts', 'worker/handlers.ts']) {
      for (const group of Object.values(GROUPS)) {
        expect(staticImports(source(file))).not.toContain(group)
      }
    }
  })

  it('hands every handler of a deferred group to its module', () => {
    const table = source('worker/handlers.ts')
    for (const group of Object.keys(GROUPS)) {
      const entries = [...table.matchAll(new RegExp(`^  '${group}\\.[^']+':(.*)$`, 'gm'))]
      expect(entries.length).toBeGreaterThan(0)
      for (const [line, rest] of entries) {
        expect(rest, line).toMatch(new RegExp(`^ deferred\\(${group}Group, `))
      }
    }
  })
})
