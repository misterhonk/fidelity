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
import {
  createHubApp,
  MAX_SHARES_PER_OWNER,
  MAX_SHOPS_PER_OWNER,
  MAX_VAULTS_PER_OWNER,
  MAX_WATCHERS_PER_OWNER,
  CEILING_WINDOW_MS,
  COVER_HOLD_MS,
} from '../src/app.ts'
import { CATALOGUE_TTL_MS, openHubDb } from '../src/db.ts'

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
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
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

describe('what one key cannot do to the others', () => {
  const send = (
    app: ReturnType<typeof hub>['app'],
    method: string,
    path: string,
    body: unknown,
    who: ReturnType<typeof withKey>,
  ) =>
    app.request(path, {
      method,
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json', ...who.headers },
    })

  test('a key holds a few vaults, not a disk', async () => {
    const { app } = hub({ keys: true })
    const alice = withKey(key('alice'))
    for (let i = 0; i < MAX_VAULTS_PER_OWNER; i++) {
      assert.equal(
        (await send(app, 'PUT', `/v1/vault/${String(i).repeat(16)}`, sealed(), alice)).status,
        200,
      )
    }
    assert.equal(
      (await send(app, 'PUT', `/v1/vault/${'f'.repeat(16)}`, sealed(), alice)).status,
      403,
    )
    // Its own vault it may still replace, and another key is not counted with it.
    assert.equal(
      (await send(app, 'PUT', `/v1/vault/${'0'.repeat(16)}`, sealed(), alice)).status,
      200,
    )
    assert.equal(
      (await send(app, 'PUT', `/v1/vault/${'f'.repeat(16)}`, sealed(), withKey(key('bob'))))
        .status,
      200,
    )
  })

  test('a key holds a limited number of live shared lists', async () => {
    const { app } = hub({ keys: true })
    const alice = withKey(key('alice'))
    const share = (i: number) => ({
      id: i.toString(16).padStart(32, '0'),
      expiresAt: NOW + 60_000,
      sealed: sealed(),
    })
    for (let i = 0; i < MAX_SHARES_PER_OWNER; i++) {
      assert.equal((await send(app, 'POST', '/v1/share', share(i), alice)).status, 200)
    }
    assert.equal((await send(app, 'POST', '/v1/share', share(999), alice)).status, 403)
  })

  test('a key registers a few devices, not a thousand', async () => {
    const { app } = hub({ keys: true })
    const alice = withKey(key('alice'))
    const subscribe = (i: number) =>
      send(
        app,
        'POST',
        '/v1/watch/subscribe',
        {
          subscription: {
            endpoint: `https://fcm.googleapis.com/fcm/send/${i}`,
            keys: { p256dh: 'p', auth: 'a' },
          },
          dealers: ['shop'],
        },
        alice,
      )
    for (let i = 0; i < MAX_WATCHERS_PER_OWNER; i++) {
      assert.equal((await subscribe(i)).status, 200)
    }
    assert.equal((await subscribe(99)).status, 403)
    assert.equal((await subscribe(0)).status, 200, 'its own device may update its shops')
  })

  test('a key contributes a limited number of shops', async () => {
    const { app, db } = hub({ keys: true })
    const shop = {
      displayName: 'x',
      shipsFrom: 'Germany',
      numForSale: 1,
      seenAt: NOW,
      fingerprint: {
        sampledItems: 1,
        totalItems: 1,
        coverage: 1,
        labelDist: {},
        styleDist: {},
        decadeDist: {},
      },
    }
    const insert = db.prepare(
      `INSERT INTO shops (username, display_name, ships_from, num_for_sale, avatar_url, body, seen_at, updated_at, owner)
       VALUES (?1, 'x', '', 0, '', '{}', ?2, ?2, 'alice')`,
    )
    for (let i = 0; i < MAX_SHOPS_PER_OWNER; i++) insert.run(`shop${i}`, NOW - 1)
    assert.equal(
      (await send(app, 'PUT', '/v1/shops/another', shop, withKey(key('alice')))).status,
      403,
    )
    assert.equal(
      (await send(app, 'PUT', '/v1/shops/shop0', shop, withKey(key('alice')))).status,
      200,
    )
    assert.equal(
      (await send(app, 'PUT', '/v1/shops/another', shop, withKey(key('bob')))).status,
      200,
    )
  })

  test('another member’s fresh horizon chunk and cover are not replaced', async () => {
    const { app } = hub({ keys: true })
    const chunk = (fetchedAt: number) => ({
      version: 1,
      key: 'artist:55',
      kind: 'artist',
      entityId: 55,
      name: 'Conny Plank',
      fetchedAt,
      complete: true,
      requests: 3,
      releaseIds: 'AQAAAA==',
      roles: 'AA==',
      years: 'sAc=',
    })
    const alice = withKey(key('alice'))
    const bob = withKey(key('bob'))
    assert.deepEqual(
      await (await send(app, 'PUT', '/v1/horizon/artist/55', chunk(NOW - 10), alice)).json(),
      { stored: true },
    )
    assert.deepEqual(
      await (await send(app, 'PUT', '/v1/horizon/artist/55', chunk(NOW), bob)).json(),
      {
        stored: false,
        reason: 'held by another member',
      },
    )
    assert.deepEqual(
      await (await send(app, 'PUT', '/v1/horizon/artist/55', chunk(NOW), alice)).json(),
      { stored: true },
    )

    const cover = (url: string) => ({
      covers: [{ releaseId: 7, thumbUrl: url, coverUrl: url }],
    })
    await send(app, 'PUT', '/v1/covers', cover('https://i.discogs.com/a.jpg'), alice)
    await send(app, 'PUT', '/v1/covers', cover(''), bob)
    const got = (await (await app.request('/v1/covers?ids=7', alice)).json()) as {
      covers: Record<string, { thumbUrl: string }>
    }
    assert.equal(got.covers['7']?.thumbUrl, 'https://i.discogs.com/a.jpg')
  })

  test('a key sends one large body at a time', async () => {
    const { app } = hub({ keys: true })
    const alice = withKey(key('alice'))
    let finish!: () => void
    const held = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(JSON.stringify(sealed())))
        finish = () => controller.close()
      },
    })
    const first = app.request(`/v1/vault/${ID}`, {
      method: 'PUT',
      body: held,
      duplex: 'half',
      headers: { 'content-type': 'application/json', ...alice.headers },
    } as RequestInit)
    // Let the first request reach its body before the second arrives.
    await new Promise((resolve) => setTimeout(resolve, 10))
    assert.equal((await send(app, 'PUT', `/v1/vault/${ID}`, sealed(), alice)).status, 429)
    finish()
    assert.equal((await first).status, 200)
    assert.equal((await send(app, 'PUT', `/v1/vault/${ID}`, sealed(), alice)).status, 200)
  })

  test('a large body on one route does not hold up another, and the refusal says when to retry', async () => {
    const { app } = hub({ keys: true })
    const alice = withKey(key('alice'))
    let finish!: () => void
    const held = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{'))
        finish = () => controller.close()
      },
    })
    const upload = app.request('/v1/horizon/artist/55', {
      method: 'PUT',
      body: held,
      duplex: 'half',
      headers: { 'content-type': 'application/json', ...alice.headers },
    } as RequestInit)
    await new Promise((resolve) => setTimeout(resolve, 10))
    assert.equal((await send(app, 'PUT', `/v1/vault/${ID}`, sealed(), alice)).status, 200)
    const again = await send(app, 'PUT', '/v1/horizon/artist/55', {}, alice)
    assert.equal(again.status, 429)
    assert.equal(again.headers.get('retry-after'), '1')
    finish()
    await upload
    assert.equal((await send(app, 'PUT', '/v1/horizon/artist/55', {}, alice)).status, 400)
  })

  test('vaults untouched for a month do not count against the ceiling', async () => {
    const { app, db } = hub({ keys: true })
    const insert = db.prepare(
      `INSERT INTO vault (id, body, updated_at, owner) VALUES (?, '{}', ?, 'alice')`,
    )
    for (let i = 0; i < MAX_VAULTS_PER_OWNER; i++) {
      insert.run(String(i).repeat(16), NOW - CEILING_WINDOW_MS - 1)
    }
    assert.equal(
      (await send(app, 'PUT', `/v1/vault/${'f'.repeat(16)}`, sealed(), withKey(key('alice'))))
        .status,
      200,
    )
  })

  test('shops not seen for a month do not count, and an older reading is no 403', async () => {
    const { app, db } = hub({ keys: true })
    const alice = withKey(key('alice'))
    const shop = (seenAt: number) => ({
      displayName: 'x',
      shipsFrom: 'Germany',
      numForSale: 1,
      seenAt,
      fingerprint: {
        sampledItems: 1,
        totalItems: 1,
        coverage: 1,
        labelDist: {},
        styleDist: {},
        decadeDist: {},
      },
    })
    const insert = db.prepare(
      `INSERT INTO shops (username, display_name, ships_from, num_for_sale, avatar_url, body, seen_at, updated_at, owner)
       VALUES (?1, 'x', '', 0, '', '{}', ?2, ?2, ?3)`,
    )
    for (let i = 0; i < MAX_SHOPS_PER_OWNER; i++)
      insert.run(`old${i}`, NOW - CEILING_WINDOW_MS - 1, 'alice')
    assert.equal((await send(app, 'PUT', '/v1/shops/fresh', shop(NOW), alice)).status, 200)

    for (let i = 0; i < MAX_SHOPS_PER_OWNER; i++) insert.run(`new${i}`, NOW, 'alice')
    insert.run('bobs', NOW, 'bob')
    assert.deepEqual(
      await (await send(app, 'PUT', '/v1/shops/bobs', shop(NOW - 5), alice)).json(),
      {
        stored: false,
        reason: 'older than cached',
      },
    )
  })

  test('a back-dated seenAt does not slip past the shop ceiling', async () => {
    const { app } = hub({ keys: true })
    const alice = withKey(key('alice'))
    const shop = {
      displayName: 'x',
      shipsFrom: 'Germany',
      numForSale: 1,
      seenAt: NOW - CEILING_WINDOW_MS - 1,
      fingerprint: {
        sampledItems: 1,
        totalItems: 1,
        coverage: 1,
        labelDist: {},
        styleDist: {},
        decadeDist: {},
      },
    }
    for (let i = 0; i < MAX_SHOPS_PER_OWNER; i++) {
      assert.equal((await send(app, 'PUT', `/v1/shops/shop${i}`, shop, alice)).status, 200)
    }
    assert.equal((await send(app, 'PUT', '/v1/shops/another', shop, alice)).status, 403)
  })

  test('rewriting an own row older than the window does not revive the ceiling', async () => {
    const { app, db } = hub({ keys: true })
    const alice = withKey(key('alice'))
    const insert = db.prepare(
      `INSERT INTO vault (id, body, updated_at, owner) VALUES (?, '{}', ?, 'alice')`,
    )
    for (let i = 0; i < MAX_VAULTS_PER_OWNER; i++) {
      insert.run(String(i).repeat(16), NOW - CEILING_WINDOW_MS - 1)
      insert.run(String(i + 5).repeat(16), NOW)
    }
    assert.equal(
      (await send(app, 'PUT', `/v1/vault/${'0'.repeat(16)}`, sealed(), alice)).status,
      403,
    )
    assert.equal(
      (await send(app, 'PUT', `/v1/vault/${'5'.repeat(16)}`, sealed(), alice)).status,
      200,
    )

    const shop = {
      displayName: 'x',
      shipsFrom: 'Germany',
      numForSale: 1,
      seenAt: NOW,
      fingerprint: {
        sampledItems: 1,
        totalItems: 1,
        coverage: 1,
        labelDist: {},
        styleDist: {},
        decadeDist: {},
      },
    }
    const shops = db.prepare(
      `INSERT INTO shops (username, display_name, ships_from, num_for_sale, avatar_url, body, seen_at, updated_at, owner)
       VALUES (?1, 'x', '', 0, '', '{}', ?2, ?2, 'alice')`,
    )
    shops.run('old', NOW - CEILING_WINDOW_MS - 1)
    for (let i = 0; i < MAX_SHOPS_PER_OWNER; i++) shops.run(`new${i}`, NOW - 1)
    assert.equal((await send(app, 'PUT', '/v1/shops/old', shop, alice)).status, 403)
  })

  test('a holder’s rewrite does not renew its hold, and an ownerless row is nobody’s', async () => {
    const { app, db } = hub({ keys: true })
    const alice = withKey(key('alice'))
    const bob = withKey(key('bob'))
    const chunk = (fetchedAt: number) => ({
      version: 1,
      key: 'artist:55',
      kind: 'artist',
      entityId: 55,
      name: 'Conny Plank',
      fetchedAt,
      complete: true,
      requests: 3,
      releaseIds: 'AQAAAA==',
      roles: 'AA==',
      years: 'sAc=',
    })
    const family = (masterId: number, fetchedAt: number) => ({
      masterId,
      total: 0,
      fetchedAt,
      siblings: [],
    })
    // Alice's first writes, a month and a day ago.
    const first = NOW - CATALOGUE_TTL_MS - 1
    db.prepare(
      `INSERT INTO horizon (key, kind, entity_id, fetched_at, release_ids, body, updated_at, owner)
       VALUES ('artist:55', 'artist', 55, ?, 0, '{}', ?, 'alice')`,
    ).run(NOW - 30, first)
    db.prepare(
      `INSERT INTO covers (release_id, thumb_url, cover_url, updated_at, owner) VALUES (7, '', '', ?, 'alice')`,
    ).run(NOW - COVER_HOLD_MS - 1)
    // A row from before owners.
    db.prepare(
      `INSERT INTO families (master_id, fetched_at, body, updated_at, owner) VALUES (9, ?, '{}', ?, '')`,
    ).run(NOW - 30, NOW)

    // Alice rewrites today; that must not move the start of her hold.
    assert.deepEqual(
      await (await send(app, 'PUT', '/v1/horizon/artist/55', chunk(NOW - 20), alice)).json(),
      { stored: true },
    )
    const url = 'https://i.discogs.com/a.jpg'
    await send(
      app,
      'PUT',
      '/v1/covers',
      { covers: [{ releaseId: 7, thumbUrl: url, coverUrl: url }] },
      alice,
    )

    assert.deepEqual(
      await (await send(app, 'PUT', '/v1/horizon/artist/55', chunk(NOW - 10), bob)).json(),
      { stored: true },
    )
    assert.deepEqual(
      await (
        await send(
          app,
          'PUT',
          '/v1/covers',
          { covers: [{ releaseId: 7, thumbUrl: '', coverUrl: '' }] },
          bob,
        )
      ).json(),
      { stored: 1, rejected: 0 },
    )
    assert.deepEqual(
      await (await send(app, 'PUT', '/v1/family/9', family(9, NOW - 10), bob)).json(),
      { stored: true },
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

  test('the revocation list backs off a failing service and does not hold members up', async () => {
    let calls = 0
    let mode: 'ok' | 'hang' | 'fail' = 'ok'
    let at = 0
    const fetchImpl = (async () => {
      calls += 1
      if (mode === 'hang') return new Promise<Response>(() => {})
      if (mode === 'fail') throw new Error('down')
      return new Response(JSON.stringify({ kids: ['dead'] }))
    }) as unknown as typeof fetch
    const list = createRevocationList({ url: 'https://access.test', fetchImpl, now: () => at })
    await list.current()

    // A hanging service: the old list is served at once, one refresh behind it.
    mode = 'hang'
    at = 2 * 60 * 60 * 1000
    assert.deepEqual([...(await list.current())], ['dead'])
    assert.deepEqual([...(await list.current())], ['dead'])
    assert.equal(calls, 2)

    // Repeated failures: asked again only after the minute's back-off.
    const fresh = createRevocationList({ url: 'https://access.test', fetchImpl, now: () => at })
    mode = 'fail'
    calls = 0
    await fresh.current()
    await fresh.current()
    at += 30_000
    await fresh.current()
    assert.equal(calls, 1, 'not on every request')
    at += 31_000
    await fresh.current()
    assert.equal(calls, 2)
  })
})
