import { describe, expect, it } from 'vitest'
import { z } from 'zod'

/**
 * worker/index.ts switches zod to `jitless` without importing zod (#299): it
 * writes the flag onto `globalThis.__zod_globalConfig`, the object zod keeps
 * its config on. If a zod upgrade moves that object, the flag is silently lost
 * and the CSP violations of #204 come back — this is where that shows.
 */
describe('zod config on the global', () => {
  it('is the object z.config() reads and writes', () => {
    const global = (globalThis as { __zod_globalConfig?: object }).__zod_globalConfig
    expect(global).toBeDefined()
    expect(z.config()).toBe(global)
  })
})
