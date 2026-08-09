import { afterEach, describe, expect, it } from 'vitest'

import { forgetSecrets, redact, redactString, registerSecret } from '~~/worker/log'

const TOKEN = 'kRjWnQPzXbLmTvHgYcAeDsFuIoNpMwZqBtVxCr'

afterEach(() => {
  forgetSecrets()
})

describe('token redaction', () => {
  it('removes the literal token once it has been registered', () => {
    registerSecret(TOKEN)
    expect(redactString(`Anfrage mit ${TOKEN} fehlgeschlagen`)).toBe(
      'Anfrage mit [redacted] fehlgeschlagen',
    )
  })

  it('removes an Authorization header even for an unregistered token', () => {
    expect(redactString('Authorization: Discogs token=abcdefghijklmnop')).toBe(
      'Authorization: [redacted]',
    )
  })

  it('removes a token that leaked into a query string', () => {
    expect(redactString('https://api.discogs.com/x?token=abcdefghijklmnop&page=2')).toContain(
      '[redacted]',
    )
  })

  it('reaches into nested objects and arrays', () => {
    registerSecret(TOKEN)
    const redacted = redact({
      request: { headers: { Authorization: `Discogs token=${TOKEN}` } },
      trail: [`retry with ${TOKEN}`],
    }) as { request: { headers: { Authorization: string } }; trail: string[] }

    expect(redacted.request.headers.Authorization).toBe('[redacted]')
    expect(redacted.trail[0]).toBe('retry with [redacted]')
  })

  it('scrubs error messages and stacks', () => {
    registerSecret(TOKEN)
    const redacted = redact(new Error(`401 für ${TOKEN}`)) as Error

    expect(redacted.message).toBe('401 für [redacted]')
    expect(redacted.stack ?? '').not.toContain(TOKEN)
  })

  it('survives a circular structure instead of hanging', () => {
    const loop: Record<string, unknown> = { name: 'dig' }
    loop.self = loop
    expect(() => redact(loop)).not.toThrow()
  })

  it('forgets the secret on sign-out', () => {
    registerSecret(TOKEN)
    forgetSecrets()
    expect(redactString(`noch da: ${TOKEN}`)).toContain(TOKEN)
  })

  it('ignores values too short to be a token', () => {
    registerSecret('abc')
    expect(redactString('abc taucht überall auf')).toBe('abc taucht überall auf')
  })
})
