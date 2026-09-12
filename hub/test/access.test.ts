import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  createKeyLimiter,
  createRevocationList,
  generateAccessKeyPair,
  issueKey,
  parseKey,
  verifyKey,
} from '../src/access.ts'
import { createHubApp } from '../src/app.ts'
import { openHubDb } from '../src/db.ts'

/**
 * The second door (docs/17 §3.2, §6.2): a key is a signed statement the hub
 * verifies with a public key and nothing else. Every way a key can be wrong
 * is a 401 with its reason; every way a hub can be configured — secret only,
 * key only, both, neither — opens the doors it should and no other.
 */
const issuer = generateAccessKeyPair()
const stranger = generateAccessKeyPair()
const NOW = 1_800_000_000_000
const now = () => NOW
const key = (sub = 'payer-1', over: Partial<Parameters<typeof issueKey>[0]> = {}) =>
  issueKey({ privateKeyPem: issuer.privateKeyPem, sub, tier: 'lp', now, ...over })

describe('a key', () => {
  test('parses, verifies, and carries its claims', () => {
    const token = key('payer-1', { kid: 'abcdef01' })
    assert.deepEqual(parseKey(token), {
      kid: 'abcdef01',
      sub: 'payer-1',
      tier: 'lp',
      iat: NOW / 1000,
      exp: NOW / 1000 + 35 * 86_400,
    })
    const verdict = verifyKey(token, { publicKey: issuer.publicKey, now })
    assert.equal(verdict.ok, true)
  })

  test('is refused with its reason: signature, expired, not yet, revoked, malformed', () => {
    const forged = issueKey({
      privateKeyPem: stranger.privateKeyPem,
      sub: 'x',
      tier: 'lp',
      now,
    })
    assert.deepEqual(verifyKey(forged, { publicKey: issuer.publicKey, now }), {
      ok: false,
      reason: 'signature',
    })

    const old = key('p', { now: () => NOW - 40 * 86_400_000 })
    assert.deepEqual(verifyKey(old, { publicKey: issuer.publicKey, now }), {
      ok: false,
      reason: 'expired',
    })

    const future = key('p', { now: () => NOW + 86_400_000 })
    assert.deepEqual(verifyKey(future, { publicKey: issuer.publicKey, now }), {
      ok: false,
      reason: 'not-yet',
    })

    const revoked = key('p', { kid: 'deadbeef' })
    assert.deepEqual(
      verifyKey(revoked, { publicKey: issuer.publicKey, now, revoked: new Set(['deadbeef']) }),
      { ok: false, reason: 'revoked' },
    )

    for (const junk of ['', 'fk1', 'fk1.x.y', 'jwt.eyJ.sig', key().replace('fk1', 'fk2')]) {
      assert.equal(verifyKey(junk, { publicKey: issuer.publicKey, now }).ok, false, junk)
    }
    // A tampered payload: the signature no longer matches.
    const [, payload, sig] = key().split('.')
    const tampered = `fk1.${Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload!, 'base64url').toString()), tier: 'first' })).toString('base64url')}.${sig}`
    assert.deepEqual(verifyKey(tampered, { publicKey: issuer.publicKey, now }), {
      ok: false,
      reason: 'signature',
    })
  })
})

function hub(options: { secret?: string | null; keys?: boolean; revoked?: Set<string> } = {}) {
  const db = openHubDb(':memory:')
  const app = createHubApp({
    db,
    secret: options.secret ?? null,
    access: options.keys
      ? { publicKey: issuer.publicKey, revoked: async () => options.revoked ?? new Set() }
      : null,
    now,
  })
  return { app, db }
}

const withKey = (token: string) => ({ headers: { 'x-fidelity-key': token } })
const withSecret = (word: string) => ({ headers: { 'x-hub-secret': word } })

describe('the doors', () => {
  test('secret only: the secret opens, a key does not', async () => {
    const { app } = hub({ secret: 'word' })
    assert.equal((await app.request('/v1/horizon/artist/55', withSecret('word'))).status, 404)
    assert.equal((await app.request('/v1/horizon/artist/55', withKey(key()))).status, 401)
    assert.equal((await app.request('/v1/horizon/artist/55')).status, 401)
  })

  test('keys only: a valid key opens, the secret is not a thing', async () => {
    const { app } = hub({ keys: true })
    assert.equal((await app.request('/v1/horizon/artist/55', withKey(key()))).status, 404)
    assert.equal((await app.request('/v1/horizon/artist/55', withSecret('word'))).status, 401)
    const refused = await app.request(
      '/v1/horizon/artist/55',
      withKey(key('p', { now: () => NOW - 40 * 86_400_000 })),
    )
    assert.equal(refused.status, 401)
    assert.match(((await refused.json()) as { error: string }).error, /expired/)
  })

  test('both: either opens', async () => {
    const { app } = hub({ secret: 'word', keys: true })
    assert.equal((await app.request('/v1/horizon/artist/55', withSecret('word'))).status, 404)
    assert.equal((await app.request('/v1/horizon/artist/55', withKey(key()))).status, 404)
    assert.equal((await app.request('/v1/horizon/artist/55')).status, 401)
  })

  test('neither: open, as today', async () => {
    const { app } = hub()
    assert.equal((await app.request('/v1/horizon/artist/55')).status, 404)
  })

  test('a revoked key is shut out, and health names the doors', async () => {
    const { app } = hub({ keys: true, revoked: new Set(['deadbeef']) })
    assert.equal(
      (await app.request('/v1/horizon/artist/55', withKey(key('p', { kid: 'deadbeef' }))))
        .status,
      401,
    )
    const health = (await (await app.request('/v1/health')).json()) as { doors: string[] }
    assert.deepEqual(health.doors, ['key'])
  })
})

const sealed = () => ({ version: 1, iv: 'aXY=', salt: 'c2FsdA==', cipher: 'Y2lwaGVy' })
const ID = 'a'.repeat(32)

describe('personal rows', () => {
  test('a vault belongs to the key that wrote it', async () => {
    const { app } = hub({ keys: true })
    const alice = withKey(key('alice'))
    const bob = withKey(key('bob'))
    const put = (who: typeof alice) =>
      app.request(`/v1/vault/${ID}`, {
        method: 'PUT',
        body: JSON.stringify(sealed()),
        headers: { 'content-type': 'application/json', ...who.headers },
      })

    assert.equal((await put(alice)).status, 200)
    assert.equal((await app.request(`/v1/vault/${ID}`, alice)).status, 200)
    // Bob does not see it, cannot overwrite it, cannot delete it.
    assert.equal((await app.request(`/v1/vault/${ID}`, bob)).status, 404)
    assert.equal((await put(bob)).status, 403)
    assert.equal(
      (await app.request(`/v1/vault/${ID}`, { method: 'DELETE', ...bob })).status,
      200,
    )
    assert.equal(
      (await app.request(`/v1/vault/${ID}`, alice)).status,
      200,
      'still there after bob’s delete',
    )
  })

  test('a secret-only hub keeps every row as its own — nothing changes for self-hosters', async () => {
    const { app, db } = hub({ secret: 'word' })
    await app.request(`/v1/vault/${ID}`, {
      method: 'PUT',
      body: JSON.stringify(sealed()),
      headers: { 'content-type': 'application/json', 'x-hub-secret': 'word' },
    })
    const row = db.prepare('SELECT owner FROM vault WHERE id = ?').get(ID) as { owner: string }
    assert.equal(row.owner, '')
    assert.equal((await app.request(`/v1/vault/${ID}`, withSecret('word'))).status, 200)
  })

  test('a push registration cannot be silenced by another key', async () => {
    const { app } = hub({ keys: true })
    const subscription = {
      endpoint: 'https://push.example/abc',
      keys: { p256dh: 'p', auth: 'a' },
    }
    const post = (path: string, body: unknown, who: ReturnType<typeof withKey>) =>
      app.request(path, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json', ...who.headers },
      })
    assert.equal(
      (
        await post(
          '/v1/watch/subscribe',
          { subscription, dealers: ['shop'] },
          withKey(key('alice')),
        )
      ).status,
      200,
    )
    assert.equal(
      (
        await post(
          '/v1/watch/unsubscribe',
          { endpoint: subscription.endpoint },
          withKey(key('bob')),
        )
      ).status,
      403,
    )
    assert.equal(
      (
        await post(
          '/v1/watch/unsubscribe',
          { endpoint: subscription.endpoint },
          withKey(key('alice')),
        )
      ).status,
      200,
    )
  })
})

describe('the small parts', () => {
  test('the limiter refills and says how long to wait', () => {
    let at = 0
    const limiter = createKeyLimiter({ capacity: 3, perSecond: 1, now: () => at })
    assert.equal(limiter.take('k').ok, true)
    assert.equal(limiter.take('k').ok, true)
    assert.equal(limiter.take('k').ok, true)
    assert.deepEqual(limiter.take('k'), { ok: false, retryAfterSeconds: 1 })
    at = 1000
    assert.equal(limiter.take('k').ok, true)
    assert.equal(limiter.take('other').ok, true)
  })

  test('the revocation list fetches once an hour and keeps the last list on a failure', async () => {
    let calls = 0
    let at = 0
    const fetchImpl = (async () => {
      calls += 1
      if (calls === 2) throw new Error('down')
      return new Response(JSON.stringify({ kids: ['dead'] }))
    }) as unknown as typeof fetch
    const list = createRevocationList({
      url: 'https://access.test',
      fixed: ['fixed'],
      fetchImpl,
      now: () => at,
    })
    assert.deepEqual([...(await list.current())].sort(), ['dead', 'fixed'])
    assert.deepEqual([...(await list.current())].sort(), ['dead', 'fixed'])
    assert.equal(calls, 1)
    at = 2 * 60 * 60 * 1000
    assert.deepEqual(
      [...(await list.current())].sort(),
      ['dead', 'fixed'],
      'kept through the failure',
    )
    assert.equal(calls, 2)
  })
})
