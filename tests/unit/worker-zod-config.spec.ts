import { execFileSync } from 'node:child_process'

import { describe, expect, it } from 'vitest'

/**
 * worker/zod-jitless.ts switches zod to `jitless` without importing zod (#299):
 * it writes the flag onto `globalThis.__zod_globalConfig` *before* zod loads.
 * That holds only while zod keeps an object it finds there and reads `jitless`
 * from it. If an upgrade overwrites the object or renames the flag, zod probes
 * `new Function` again and the CSP violations of #204 come back.
 *
 * A child process, because zod is loaded once per process and the order —
 * flag first, zod second — is the thing under test.
 */
const PROBE = (preset: string, postset = '') => `
  ${preset}
  let calls = 0
  const F = globalThis.Function
  globalThis.Function = new Proxy(F, { construct(t, a) { calls++; return Reflect.construct(t, a) } })
  const { z } = await import('zod')
  ${postset}
  z.object({ a: z.string() }).parse({ a: 'x' })
  process.exit(calls === 0 ? 0 : 1)
`

const FLAG = 'globalThis.__zod_globalConfig = { jitless: true };'

function exitCode(probe: string): number {
  try {
    execFileSync(process.execPath, ['--input-type=module', '-e', probe], { stdio: 'ignore' })
    return 0
  } catch (error) {
    return (error as { status: number }).status
  }
}

describe('zod jitless, set before zod loads', () => {
  it('keeps zod from calling new Function', () => {
    expect(exitCode(PROBE(FLAG))).toBe(0)
  })

  // The probe has to be able to fail, or the test above proves nothing.
  it('notices when the flag is missing', () => {
    expect(exitCode(PROBE(''))).toBe(1)
  })

  it('notices when the flag is set only after zod has loaded', () => {
    expect(exitCode(PROBE('', FLAG))).toBe(1)
  })

  it('notices when zod ignores the flag', () => {
    expect(exitCode(PROBE('globalThis.__zod_globalConfig = { jitlessRenamed: true };'))).toBe(1)
  })
})
