import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { setMeta } from '~~/db/meta'
import { deleteFidelityDb } from '~~/db/open'
import { discogs } from '~~/worker/auth'
import { handlers } from '~~/worker/handlers'
import { createHubClient } from '~~/worker/hub/client'
import { forgetSecrets, redact, redactString, registerSecret } from '~~/worker/log'
import { revokeCloudTokens } from '~~/worker/vault/revoke'

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

/**
 * Every secret the worker holds, registered by the code that holds it (#208).
 *
 * Asserted through the real entry points rather than `registerSecret` itself:
 * the bug this guards against is a new credential that nobody remembered to
 * register, and calling the registry directly would never notice that.
 */
describe('every secret type', () => {
  const HUB_SECRET = 'hub-secret-word-1'
  const ACCESS_KEY = 'access-key-claims-2'
  const PASSPHRASE = 'vault passphrase three'
  const CLOUD = { accessToken: 'cloud-access-4', refreshToken: 'cloud-refresh-5', expiresAt: 1 }

  afterEach(async () => {
    vi.unstubAllGlobals()
    await deleteFidelityDb()
  })

  it('the hub secret and the access key, whenever a hub client is made', () => {
    createHubClient({ baseUrl: 'https://hub.test', secret: HUB_SECRET, accessKey: ACCESS_KEY })
    expect(redactString(`401 for ${HUB_SECRET} / ${ACCESS_KEY}`)).toBe(
      '401 for [redacted] / [redacted]',
    )
  })

  it('the hub secret and the access key, when a connection is tested', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('offline'))),
    )
    await handlers['hub.check'](
      { url: 'https://hub.test', secret: HUB_SECRET, accessKey: ACCESS_KEY },
      {} as never,
    ).catch(() => {})
    expect(redactString(`${HUB_SECRET} ${ACCESS_KEY}`)).toBe('[redacted] [redacted]')
  })

  it('the vault passphrase, on both ways into the vault', async () => {
    await handlers['vault.merge'](
      { passphrase: PASSPHRASE, remote: { not: 'sealed' } },
      {} as never,
    ).catch(() => {})
    expect(redactString(`wrong: ${PASSPHRASE}`)).toBe('wrong: [redacted]')

    forgetSecrets()
    await handlers['vault.sync']({ passphrase: PASSPHRASE }, {} as never).catch(() => {})
    expect(redactString(`wrong: ${PASSPHRASE}`)).toBe('wrong: [redacted]')
  })

  it('the cloud tokens, when they are revoked', async () => {
    await setMeta('cloudTokens', { drive: CLOUD })
    await revokeCloudTokens(vi.fn(async () => new Response('{}')) as typeof fetch)
    expect(redactString(`${CLOUD.accessToken} ${CLOUD.refreshToken}`)).toBe(
      '[redacted] [redacted]',
    )
  })

  it('the Discogs token, whenever a request reads it', async () => {
    await setMeta('token', TOKEN)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}')),
    )
    await discogs()
      .get('/oauth/identity', z.unknown())
      .catch(() => {})
    expect(redactString(`token ${TOKEN}`)).toBe('token [redacted]')
  })
})
