import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * `public/.well-known/security.txt` (RFC 9116) carries a date that runs out.
 *
 * An expired file tells a reporter the contact is stale — worse than none. This
 * turns red before that happens, so somebody moves the date and checks the
 * contact still answers (docs/21 §5).
 */
const text = readFileSync(join(process.cwd(), 'public/.well-known/security.txt'), 'utf8')

describe('security.txt', () => {
  it('names a contact and points at the policy', () => {
    expect(text).toMatch(/^Contact: https:\/\/\S+$/m)
    expect(text).toMatch(/^Policy: https:\/\/\S+SECURITY\.md$/m)
  })

  it('has not expired, and expires within a year as RFC 9116 advises', () => {
    const expires = Date.parse(/^Expires: (\S+)$/m.exec(text)?.[1] ?? '')
    const now = Date.now()
    expect(expires).toBeGreaterThan(now + 30 * 86_400_000) // a month's warning
    expect(expires).toBeLessThan(now + 400 * 86_400_000)
  })
})
