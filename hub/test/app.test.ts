import assert from 'node:assert/strict'
import { test, describe } from 'node:test'

import { createKeyLimiter, generateAccessKeyPair, issueKey } from '../src/access.ts'
import { createHubApp, MAX_CHUNK_BYTES } from '../src/app.ts'
import { openHubDb } from '../src/db.ts'

/**
 * The hub, tested against the rule that shapes it: a hub that is wrong must be
 * no worse than a hub that is absent. Every route either answers correctly,
 * says it does not know, or refuses — never something in between.
 */

const chunk = (over = {}) => ({
  version: 1,
  key: 'artist:55',
  kind: 'artist',
  entityId: 55,
  name: 'Conny Plank',
  fetchedAt: 1000,
  complete: true,
  requests: 3,
  releaseIds: 'AQAAAA==',
  roles: 'AA==',
  years: 'sAc=',
  ...over,
})

function hub(secret = null) {
  const db = openHubDb(':memory:')
  return { app: createHubApp({ db, secret, now: () => 42 }), db }
}

const put = (app, path, body, headers = {}) =>
  app.request(path, {
    method: 'PUT',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...headers },
  })

/**
 * Shops, and what the hub may know about them (ADR-014).
 *
 * The first thing here that is about a shop rather than a record, so the
 * tests are mostly about the line: a name and a distribution travel, a price
 * and an affinity do not.
 */
describe('shops', () => {
  const shop = (over: Record<string, unknown> = {}) => ({
    displayName: 'Plattenkiste',
    shipsFrom: 'Germany',
    numForSale: 2_881,
    avatarUrl: 'https://i.discogs.com/shop.jpg',
    // The tests' clock stands at 42; a reading may not come from the future.
    seenAt: 40,
    fingerprint: {
      sampledItems: 100,
      totalItems: 2_881,
      coverage: 0.03,
      labelDist: { 'Blue Note': 40 },
      styleDist: { 'Hard Bop': 30 },
      decadeDist: { 1960: 50 },
    },
    ...over,
  })

  test('stores a shop and hands it back', async () => {
    const { app } = hub()

    const stored = await (await put(app, '/v1/shops/Plattenkiste', shop())).json()
    assert.deepEqual(stored, { stored: true })

    const body = await (await app.request('/v1/shops')).json()
    assert.equal(body.shops.length, 1)
    assert.equal(body.shops[0].username, 'plattenkiste')
    assert.equal(body.shops[0].displayName, 'Plattenkiste')
    assert.deepEqual(body.shops[0].fingerprint.labelDist, { 'Blue Note': 40 })
  })

  test('refuses a path that is not a dealer name', async () => {
    const { app } = hub()
    const answer = await put(
      app,
      '/v1/shops/' + encodeURIComponent('<b>not a shop</b> x'.repeat(3)),
      shop(),
    )
    assert.equal(answer.status, 400)
    const body = await (await app.request('/v1/shops')).json()
    assert.equal(body.shops.length, 0)
  })

  test('refuses a reading from the future, which would win for ever', async () => {
    const { app } = hub()
    const answer = await put(app, '/v1/shops/plattenkiste', shop({ seenAt: 42 + 60 * 60_000 }))
    assert.equal(answer.status, 400)
    assert.deepEqual(await answer.json(), { error: 'seen in the future' })
  })

  test('keeps a sign only from i.discogs.com', async () => {
    const { app } = hub()
    await put(app, '/v1/shops/plattenkiste', shop({ avatarUrl: 'https://evil.test/pixel.gif' }))
    const body = await (await app.request('/v1/shops')).json()
    assert.equal(body.shops[0].avatarUrl, '')
  })

  test('the secret door has a ceiling too', async () => {
    const db = openHubDb(':memory:')
    const app = createHubApp({
      db,
      secret: 's3cret',
      limiter: createKeyLimiter({ capacity: 2, perSecond: 0 }),
      now: () => 42,
    })
    const headers = { 'x-hub-secret': 's3cret' }
    assert.equal((await put(app, '/v1/shops/one', shop(), headers)).status, 200)
    assert.equal((await put(app, '/v1/shops/two', shop(), headers)).status, 200)
    const third = await put(app, '/v1/shops/three', shop(), headers)
    assert.equal(third.status, 429)
    assert.ok(third.headers.get('retry-after'))
  })

  test('keeps the newer reading and refuses an older one', async () => {
    const { app } = hub()
    await put(app, '/v1/shops/plattenkiste', shop({ numForSale: 2_881 }))

    const older = await (
      await put(app, '/v1/shops/plattenkiste', shop({ numForSale: 1, seenAt: 30 }))
    ).json()
    assert.equal(older.stored, false)

    const body = await (await app.request('/v1/shops')).json()
    assert.equal(body.shops[0].numForSale, 2_881)
  })

  /*
   * The line ADR-014 draws, as a test rather than a promise. A client that
   * sends a price or an affinity finds them gone: zod keeps what the schema
   * names and drops the rest, and the schema names neither.
   */
  test('drops a price and an affinity, whatever a client sends', async () => {
    const { app } = hub()
    await put(app, '/v1/shops/plattenkiste', {
      ...shop(),
      affinity: 4.2,
      fingerprint: { ...shop().fingerprint, medianPrice: 22.75 },
    })

    const body = await (await app.request('/v1/shops')).json()
    assert.equal(body.shops[0].affinity, undefined)
    assert.equal(body.shops[0].fingerprint.medianPrice, undefined)
  })

  test('refuses a distribution with thousands of entries', async () => {
    const { app } = hub()
    const labelDist = Object.fromEntries(
      Array.from({ length: 500 }, (_, i) => [`Label ${i}`, i]),
    )
    const response = await put(app, '/v1/shops/plattenkiste', {
      ...shop(),
      fingerprint: { ...shop().fingerprint, labelDist },
    })

    assert.equal(response.status, 400)
  })
})

describe('health', () => {
  test('reports counts and whether it is secured', async () => {
    const { app } = hub('geheim')
    const body = await (await app.request('/v1/health')).json()
    assert.deepEqual(body, {
      ok: true,
      doors: ['secret'],
      horizon: 0,
      shipping: 0,
      covers: 0,
      families: 0,
      shops: 0,
      watching: 0,
      secured: true,
    })
  })

  test('stays open even on a secured hub, so a monitor needs no secret', async () => {
    const { app } = hub('geheim')
    assert.equal((await app.request('/v1/health')).status, 200)
  })
})

/**
 * What a browser is allowed to send at all.
 *
 * Every route here is called from a page on another origin, so the preflight
 * is not a formality — it is the gate. `POST` was missing from the allowed
 * methods until 2026-08-13, which meant no browser could ever reach
 * `/v1/watch/subscribe`: a hub running perfectly, a watchman polling shops,
 * and not one device able to sign up for the answer.
 *
 * It survived the day push was first made to ring because that subscription
 * went out through curl, which asks nobody's permission.
 */
describe('the preflight', () => {
  const preflight = (path: string, method: string) =>
    hub('geheim').app.request(path, {
      method: 'OPTIONS',
      headers: {
        origin: 'https://example.org',
        'access-control-request-method': method,
        'access-control-request-headers': 'content-type,x-hub-secret',
      },
    })

  test('allows every method this hub actually offers', async () => {
    const allowed = (await preflight('/v1/watch/subscribe', 'POST')).headers.get(
      'access-control-allow-methods',
    )

    for (const method of ['GET', 'POST', 'PUT']) {
      assert.ok(allowed?.includes(method), `${method} fehlt in "${allowed}"`)
    }
  })

  test('allows the secret as a header — without it every request fails', async () => {
    // `x-hub-secret` is not a simple header: without explicit permission the
    // browser gives up before the actual request.
    const allowed = (await preflight('/v1/horizon/artist/1', 'PUT')).headers.get(
      'access-control-allow-headers',
    )
    assert.ok(allowed?.includes('x-hub-secret'), allowed ?? 'kein Kopf erlaubt')
  })
})

describe('the shared secret', () => {
  test('refuses without it', async () => {
    const { app } = hub('geheim')
    assert.equal((await app.request('/v1/horizon/artist/55')).status, 401)
  })

  test('lets the right one through', async () => {
    const { app } = hub('geheim')
    const res = await app.request('/v1/horizon/artist/55', {
      headers: { 'x-hub-secret': 'geheim' },
    })
    // 404 rather than 401: it got past the door and simply has nothing.
    assert.equal(res.status, 404)
  })

  test('an unconfigured hub is open, which is a choice and not an accident', async () => {
    const { app } = hub(null)
    assert.equal((await app.request('/v1/horizon/artist/55')).status, 404)
  })
})

describe('the horizon cache', () => {
  test('a miss is a plain 404 — the client expands it itself', async () => {
    const { app } = hub()
    assert.equal((await app.request('/v1/horizon/artist/55')).status, 404)
  })

  test('stores a contribution and hands it back unchanged', async () => {
    const { app } = hub()
    assert.equal((await put(app, '/v1/horizon/artist/55', chunk())).status, 200)

    const got = await (await app.request('/v1/horizon/artist/55')).json()
    assert.deepEqual(got, chunk())
  })

  test('keeps the lexicon a chunk brings along', async () => {
    const { app } = hub()
    const kin = [
      { name: 'Konrad Plank', relation: 'alias' },
      { name: 'Cluster & Eno', relation: 'group' },
    ]
    assert.equal((await put(app, '/v1/horizon/artist/55', chunk({ kin }))).status, 200)

    const got = await (await app.request('/v1/horizon/artist/55')).json()
    assert.deepEqual(got.kin, kin)
  })

  test('refuses a relation it does not know', async () => {
    const { app } = hub()
    const kin = [{ name: 'Konrad Plank', relation: 'twin' }]
    assert.equal((await put(app, '/v1/horizon/artist/55', chunk({ kin }))).status, 400)
  })

  test('refuses a body that is about something else', async () => {
    // Otherwise one contribution could quietly overwrite an unrelated entity.
    const { app } = hub()
    const res = await put(app, '/v1/horizon/artist/99', chunk({ key: 'artist:55' }))
    assert.equal(res.status, 400)
  })

  test('refuses anything that is not a horizon chunk', async () => {
    const { app } = hub()
    assert.equal((await put(app, '/v1/horizon/artist/55', { hello: 'world' })).status, 400)
    assert.equal((await put(app, '/v1/horizon/artist/55', 'not json at all')).status, 400)
  })

  test('refuses a body too large to be a chunk', async () => {
    const { app } = hub()
    const huge = 'x'.repeat(MAX_CHUNK_BYTES + 1)
    assert.equal((await put(app, '/v1/horizon/artist/55', huge)).status, 413)
  })

  test('keeps the newer expansion when contributions arrive out of order', async () => {
    const { app } = hub()
    await put(app, '/v1/horizon/artist/55', chunk({ fetchedAt: 2000, name: 'neu' }))
    const res = await put(app, '/v1/horizon/artist/55', chunk({ fetchedAt: 1000, name: 'alt' }))

    assert.deepEqual(await res.json(), { stored: false, reason: 'older than cached' })
    const got = await (await app.request('/v1/horizon/artist/55')).json()
    assert.equal(got.name, 'neu')
  })

  test('accepts a genuinely newer one', async () => {
    const { app } = hub()
    await put(app, '/v1/horizon/artist/55', chunk({ fetchedAt: 1000 }))
    await put(app, '/v1/horizon/artist/55', chunk({ fetchedAt: 3000, name: 'frisch' }))

    const got = await (await app.request('/v1/horizon/artist/55')).json()
    assert.equal(got.name, 'frisch')
  })
})

describe('the shipping ladders', () => {
  const tiers = [
    { minItems: 1, maxItems: 1, price: 6, currency: 'EUR' },
    { minItems: 2, maxItems: 3, price: 9, currency: 'EUR' },
  ]

  test('does not know a dealer it was never told about', async () => {
    const { app } = hub()
    assert.equal((await app.request('/v1/shipping/vinyl-tom/germany')).status, 404)
  })

  test('stores and returns a ladder', async () => {
    const { app } = hub()
    await put(app, '/v1/shipping/vinyl-tom/germany', tiers)

    const body = await (await app.request('/v1/shipping/vinyl-tom/germany')).json()
    assert.deepEqual(body, { tiers, confirmedBy: 1 })
  })

  test('does not care about capitalisation in the key', async () => {
    const { app } = hub()
    await put(app, '/v1/shipping/Vinyl-Tom/Germany', tiers)
    assert.equal((await app.request('/v1/shipping/vinyl-tom/germany')).status, 200)
  })

  test('refuses a ladder that is not one', async () => {
    const { app } = hub()
    assert.equal((await put(app, '/v1/shipping/x/germany', [])).status, 400)
    assert.equal((await put(app, '/v1/shipping/x/germany', [{ price: 6 }])).status, 400)
    assert.equal(
      (await put(app, '/v1/shipping/x/germany', [{ ...tiers[0], currency: 'EURO' }])).status,
      400,
    )
  })

  test('drops a claimed source, so nobody can dress a guess up as a fact', async () => {
    const { app } = hub()
    await put(app, '/v1/shipping/x/germany', [{ ...tiers[0], source: 'user' }])

    const body = await (await app.request('/v1/shipping/x/germany')).json()
    assert.equal('source' in body.tiers[0], false)
  })

  /*
   * "Confirmed by n" (M34.3): one vote per key, the ladder most keys agree
   * on wins, and the count goes out with it. Without keys the hub cannot
   * tell two people apart, so behind the secret door the count stays one.
   */
  test('counts the keys that stand behind a ladder, and hands out the one most agree on', async () => {
    const pair = generateAccessKeyPair()
    const db = openHubDb(':memory:')
    const app = createHubApp({
      db,
      secret: null,
      now: () => 42,
      access: { publicKey: pair.publicKey },
    })
    const keyFor = (sub) =>
      issueKey({ privateKeyPem: pair.privateKeyPem, sub, tier: 'lp', now: () => 42_000 })
    const as = (sub) => ({ 'x-fidelity-key': keyFor(sub) })
    const read = async () =>
      (await app.request('/v1/shipping/vinyl-tom/germany', { headers: as('reader') })).json()

    await put(app, '/v1/shipping/vinyl-tom/germany', tiers, as('anna'))
    assert.deepEqual(await read(), { tiers, confirmedBy: 1 })

    // Anna again is still one person.
    await put(app, '/v1/shipping/vinyl-tom/germany', tiers, as('anna'))
    assert.equal((await read()).confirmedBy, 1)

    await put(app, '/v1/shipping/vinyl-tom/germany', tiers, as('ben'))
    assert.equal((await read()).confirmedBy, 2)

    // A third person with another ladder does not displace two who agree.
    const other = [{ minItems: 1, maxItems: null, price: 4, currency: 'EUR' }]
    await put(app, '/v1/shipping/vinyl-tom/germany', other, as('carl'))
    assert.deepEqual(await read(), { tiers, confirmedBy: 2 })

    // Until Ben changes his mind: two to one the other way, and the newer wins a tie.
    await put(app, '/v1/shipping/vinyl-tom/germany', other, as('ben'))
    assert.deepEqual(await read(), { tiers: other, confirmedBy: 2 })
  })

  test('counts one behind the secret door, where everybody is the same owner', async () => {
    const { app } = hub('hush')
    const secret = { 'x-hub-secret': 'hush' }
    await put(app, '/v1/shipping/vinyl-tom/germany', tiers, secret)
    await put(app, '/v1/shipping/vinyl-tom/germany', tiers, secret)
    const body = await (
      await app.request('/v1/shipping/vinyl-tom/germany', { headers: secret })
    ).json()
    assert.deepEqual(body, { tiers, confirmedBy: 1 })
  })
})

describe('the vault', () => {
  const sealed = (over = {}) => ({
    version: 1,
    iv: 'AAAAAAAAAAAAAAAA',
    salt: 'AAAAAAAAAAAAAAAAAAAAAA==',
    cipher: 'Zm9vYmFy',
    ...over,
  })

  const ID = 'a'.repeat(32)

  /**
   * And getting rid of it again — the second half of the move.
   *
   * Until 2026-08-13 a vault's id hung off the public Discogs user id. It now
   * hangs off the passphrase; a move that leaves the old block at the
   * computable address has fixed precisely nothing — and would look like
   * success from outside.
   */
  test('forgets a block on request', async () => {
    const { app } = hub()
    await app.request(`/v1/vault/${ID}`, { method: 'PUT', body: JSON.stringify(sealed()) })
    assert.equal((await app.request(`/v1/vault/${ID}`)).status, 200)

    assert.equal((await app.request(`/v1/vault/${ID}`, { method: 'DELETE' })).status, 200)
    assert.equal((await app.request(`/v1/vault/${ID}`)).status, 404)
  })

  test('calls what was never there gone too', async () => {
    // "Gone" is the state that was asked for. A 404 here would fail a move
    // where there was simply nothing to clean up.
    const { app } = hub()
    assert.equal((await app.request(`/v1/vault/${ID}`, { method: 'DELETE' })).status, 200)
  })

  test('does not let through an id that is not one', async () => {
    const { app } = hub()
    assert.equal((await app.request('/v1/vault/../meta', { method: 'DELETE' })).status, 404)
    assert.equal((await app.request('/v1/vault/kurz', { method: 'DELETE' })).status, 400)
  })

  test('stores a block and hands the same one back', async () => {
    const { app } = hub()
    assert.equal((await put(app, `/v1/vault/${ID}`, sealed())).status, 200)

    const answer = await app.request(`/v1/vault/${ID}`)
    assert.equal(answer.status, 200)
    const body = await answer.json()
    assert.deepEqual(body.sealed, sealed())
    assert.equal(body.updatedAt, 42)
  })

  test('an empty vault is a 404, not an error', async () => {
    // The normal first answer on a new device, and nothing worth logging.
    const { app } = hub()
    assert.equal((await app.request(`/v1/vault/${ID}`)).status, 404)
  })

  test('refuses anything that is not a sealed block', async () => {
    /*
     * The hub cannot read what it stores and must not try. What it *can* check
     * is the envelope — which is what stops this table becoming a pastebin for
     * whoever can reach the hub.
     */
    const { app } = hub()
    assert.equal((await put(app, `/v1/vault/${ID}`, { hallo: 'welt' })).status, 400)
    assert.equal((await put(app, `/v1/vault/${ID}`, sealed({ cipher: '' }))).status, 400)
    assert.equal((await put(app, `/v1/vault/${ID}`, 'kein json')).status, 400)
  })

  test('refuses an id that is not one of ours', async () => {
    const { app } = hub()
    assert.equal((await put(app, '/v1/vault/../etc/passwd', sealed())).status, 404)
    assert.equal((await put(app, '/v1/vault/kurz', sealed())).status, 400)
    assert.equal((await app.request('/v1/vault/NICHTHEX0000000000')).status, 400)
  })

  test('replaces rather than accumulating', async () => {
    const { app, db } = hub()
    await put(app, `/v1/vault/${ID}`, sealed({ cipher: 'YWx0' }))
    await put(app, `/v1/vault/${ID}`, sealed({ cipher: 'bmV1' }))

    const rows = db.prepare('SELECT COUNT(*) AS n FROM vault').get()
    assert.equal(rows.n, 1)
    assert.equal((await (await app.request(`/v1/vault/${ID}`)).json()).sealed.cipher, 'bmV1')
  })

  test('is behind the secret like everything else', async () => {
    const { app } = hub('geheim')
    assert.equal((await app.request(`/v1/vault/${ID}`)).status, 401)
    assert.equal((await put(app, `/v1/vault/${ID}`, sealed())).status, 401)
    assert.equal(
      (await put(app, `/v1/vault/${ID}`, sealed(), { 'x-hub-secret': 'geheim' })).status,
      200,
    )
  })
})

describe('what the hub refuses to be', () => {
  test('has no route that takes a Discogs token', async () => {
    const { app } = hub()
    for (const path of ['/v1/token', '/v1/auth', '/v1/scan', '/v1/inventory']) {
      assert.equal((await app.request(path)).status, 404, path)
    }
  })

  test('stores nothing that looks like marketplace data', async () => {
    // Prices and conditions are Restricted Data (docs/09 §1.3). The horizon
    // schema has no field for them, so a contribution carrying them loses them.
    const { app } = hub()
    await put(app, '/v1/horizon/artist/55', { ...chunk(), price: 33.99, condition: 'Mint (M)' })

    const got = await (await app.request('/v1/horizon/artist/55')).json()
    assert.equal('price' in got, false)
    assert.equal('condition' in got, false)
  })

  test('cannot read a vault it is storing', async () => {
    /*
     * The condition ADR-008 attaches to the vault existing at all. The hub has
     * no key, no route that takes one, and nothing that turns a block back
     * into a collection. What it holds is bytes without meaning.
     */
    const { app, db } = hub()
    const ID = 'b'.repeat(32)
    await put(app, `/v1/vault/${ID}`, {
      version: 1,
      iv: 'AAAAAAAAAAAAAAAA',
      salt: 'AAAAAAAAAAAAAAAAAAAAAA==',
      cipher: 'Zm9vYmFy',
    })

    const stored = db.prepare('SELECT body FROM vault WHERE id = ?').get(ID)
    const body = JSON.parse(stored.body)
    // Four fields, all of them envelope. Nothing that names a record.
    assert.deepEqual(Object.keys(body).sort(), ['cipher', 'iv', 'salt', 'version'])

    for (const path of ['/v1/vault', '/v1/vault/key', '/v1/decrypt']) {
      assert.notEqual((await app.request(path)).status, 200, path)
    }
  })
})

/**
 * The cover cache.
 *
 * The marketplace hands back listings without images, so every cover a client
 * shows costs it one request to Discogs — the same request, for the same
 * answer, on every device. That is what a shared cache is for.
 *
 * The tests that matter here are the ones about what is *refused*: these
 * strings become `<img src>` on every device sharing this hub.
 */
describe('pressing families', () => {
  const family = (over = {}) => ({
    masterId: 5542,
    total: 160,
    fetchedAt: 1000,
    siblings: [
      {
        releaseId: 372340,
        year: 1994,
        country: 'UK',
        label: 'Go! Beat',
        catno: '828 553-1',
        format: 'Vinyl, Album',
      },
    ],
    ...over,
  })

  test('a miss is a plain 404', async () => {
    const { app } = hub()
    assert.equal((await app.request('/v1/family/5542')).status, 404)
  })

  test('stores a family and hands it back unchanged', async () => {
    const { app } = hub()
    assert.equal((await put(app, '/v1/family/5542', family())).status, 200)
    assert.deepEqual(await (await app.request('/v1/family/5542')).json(), family())
  })

  test('refuses a body about another master, and one that is not a family', async () => {
    const { app } = hub()
    assert.equal((await put(app, '/v1/family/99', family())).status, 400)
    assert.equal((await put(app, '/v1/family/5542', { hello: 'world' })).status, 400)
    assert.equal((await app.request('/v1/family/zero')).status, 400)
  })

  test('keeps the newer reading', async () => {
    const { app } = hub()
    await put(app, '/v1/family/5542', family({ fetchedAt: 2000, total: 161 }))
    const older = await put(app, '/v1/family/5542', family({ fetchedAt: 1000, total: 160 }))
    assert.deepEqual(await older.json(), { stored: false, reason: 'older than cached' })
    assert.equal((await (await app.request('/v1/family/5542')).json()).total, 161)
  })
})

describe('covers', () => {
  const cover = (releaseId: number, thumbUrl: string, coverUrl = thumbUrl) => ({
    releaseId,
    thumbUrl,
    coverUrl,
  })
  const REAL = 'https://i.discogs.com/abc/rs:fit/x.jpeg'

  test('gives back what was contributed, in one request', async () => {
    const { app } = hub()
    await put(app, '/v1/covers', { covers: [cover(1, REAL), cover(2, REAL)] })

    const body = await (await app.request('/v1/covers?ids=1,2,3')).json()
    assert.deepEqual(Object.keys(body.covers).sort(), ['1', '2'])
    assert.equal(body.covers['1'].thumbUrl, REAL)
  })

  test('stores "there is no picture" as an empty pair', async () => {
    // Worth sharing: it saves the next person the same wasted request.
    const { app } = hub()
    await put(app, '/v1/covers', { covers: [cover(7, '', '')] })

    const body = await (await app.request('/v1/covers?ids=7')).json()
    assert.deepEqual(body.covers['7'], { thumbUrl: '', coverUrl: '' })
  })

  test('refuses any host that is not Discogs', async () => {
    const { app } = hub()
    const res = await put(app, '/v1/covers', {
      covers: [
        cover(10, 'https://evil.test/pixel.gif'),
        // Passes a naive `includes('i.discogs.com')` and is not Discogs.
        cover(11, 'https://i.discogs.com.evil.test/x.jpeg'),
        cover(12, 'https://evil.test/?a=https://i.discogs.com'),
        cover(13, 'http://i.discogs.com/x.jpeg'),
        cover(14, 'javascript:alert(1)'),
      ],
    })

    assert.deepEqual(await res.json(), { stored: 0, rejected: 5 })
    const body = await (await app.request('/v1/covers?ids=10,11,12,13,14')).json()
    assert.deepEqual(body.covers, {})
  })

  test('keeps the good ones out of a mixed contribution', async () => {
    const { app } = hub()
    await put(app, '/v1/covers', {
      covers: [cover(20, REAL), cover(21, 'https://evil.test/x.gif')],
    })

    const body = await (await app.request('/v1/covers?ids=20,21')).json()
    assert.deepEqual(Object.keys(body.covers), ['20'])
  })

  test('ignores ids that are not ids', async () => {
    const { app } = hub()
    const body = await (await app.request('/v1/covers?ids=a,-1,0,,%20')).json()
    assert.deepEqual(body.covers, {})
  })

  test('needs the secret like everything else', async () => {
    const { app } = hub('geheim')
    assert.equal((await app.request('/v1/covers?ids=1')).status, 401)
  })
})

/**
 * A shared find list.
 *
 * Three promises, two of which cannot be seen from outside and the third only
 * once it is broken:
 *
 * 1. **Reading works without the secret.** Otherwise the secret would have to
 *    go into the link, and the whole hub would have been given away in order
 *    to show one list.
 * 2. **Writing does not work without it.** Otherwise the hub is a pastebin.
 * 3. **After six hours it is gone** — six hours from the *scan*, not from the
 *    sharing. Starting the count again at the sending shows prices eleven
 *    hours old in the end (rule 4).
 */
describe('a shared find list', () => {
  const sealed = () => ({
    version: 1,
    iv: 'AAAAAAAAAAAAAAAA',
    salt: 'AAAAAAAAAAAAAAAAAAAAAA==',
    cipher: 'Zm9vYmFy',
  })

  const ID = 'b'.repeat(32)
  const STUNDE = 60 * 60 * 1000

  /** The hub stands at `now: () => 42`; everything before that is the past. */
  const share = (over = {}) => ({
    id: ID,
    expiresAt: 42 + 3 * STUNDE,
    sealed: sealed(),
    ...over,
  })

  const post = (app, body, headers = {}) =>
    app.request('/v1/share', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: { 'content-type': 'application/json', ...headers },
    })

  test('takes it in and hands it back', async () => {
    const { app } = hub()
    assert.equal((await post(app, share())).status, 200)

    const answer = await app.request(`/v1/share/${ID}`)
    assert.equal(answer.status, 200)
    const body = await answer.json()
    assert.deepEqual(body.sealed, sealed())
  })

  /**
   * The point of the whole exercise.
   *
   * The link goes to somebody who does not know this hub and does not have the
   * secret. If reading required it, the feature would be pointless — and the
   * only way to use it anyway would be to send the secret along.
   */
  test('can be read without the secret', async () => {
    const { app } = hub('geheim')
    assert.equal((await post(app, share(), { 'x-hub-secret': 'geheim' })).status, 200)

    // With no headers at all — this is how the friend arrives.
    assert.equal((await app.request(`/v1/share/${ID}`)).status, 200)
  })

  /** And the other half: only somebody who belongs may write into it. */
  test('cannot be filled without the secret', async () => {
    const { app } = hub('geheim')
    assert.equal((await post(app, share())).status, 401)
    assert.equal((await app.request(`/v1/share/${ID}`)).status, 404)
  })

  /**
   * And it is a **reading** door.
   *
   * Nothing else runs over this path today, so the check for `GET` is
   * redundant — until somebody adds a `PUT /v1/share/:id`. The difference is
   * visible from outside: turned away at the door is 401; let in and finding
   * nothing would be 404.
   */
  test('is a reading door and not a flap', async () => {
    const { app } = hub('geheim')
    for (const method of ['POST', 'PUT', 'DELETE']) {
      const answer = await app.request(`/v1/share/${ID}`, { method })
      assert.equal(answer.status, 401, method)
    }
  })

  /** The open reading door applies to this path and not to the rest. */
  test('does not open any other door with it', async () => {
    const { app } = hub('geheim')
    for (const path of ['/v1/covers', '/v1/vault/' + 'a'.repeat(32), '/v1/watch/key']) {
      assert.equal((await app.request(path)).status, 401, path)
    }
  })

  test('forgets it as soon as the dig has expired', async () => {
    const db = openHubDb(':memory:')
    let jetzt = 1_000_000
    const app = createHubApp({ db, secret: null, now: () => jetzt })

    await app.request('/v1/share', {
      method: 'POST',
      body: JSON.stringify({ id: ID, expiresAt: jetzt + STUNDE, sealed: sealed() }),
      headers: { 'content-type': 'application/json' },
    })
    assert.equal((await app.request(`/v1/share/${ID}`)).status, 200)

    jetzt += STUNDE + 1
    assert.equal((await app.request(`/v1/share/${ID}`)).status, 404)

    // And genuinely gone, not merely passed over in silence.
    const rest = db.prepare('SELECT COUNT(*) AS n FROM shares').get()
    assert.equal(rest.n, 0)
  })

  /**
   * Rule 4 against our own client too.
   *
   * The client works the expiry out from the dig. A client that is wrong — or
   * one somebody has rebuilt — must not be able to leave behind a find list
   * that lives three days.
   */
  test('shortens an expiry that lies too far in the future', async () => {
    const { app } = hub()
    const answer = await post(app, share({ expiresAt: 42 + 72 * STUNDE }))
    assert.equal(answer.status, 200)

    const { expiresAt } = await answer.json()
    assert.equal(expiresAt, 42 + 6 * STUNDE)
  })

  test('does not accept what has already expired', async () => {
    const { app } = hub()
    assert.equal((await post(app, share({ expiresAt: 41 }))).status, 400)
  })

  test('rejects anything that is not a sealed envelope', async () => {
    const { app } = hub()
    assert.equal((await post(app, { id: ID, expiresAt: 42 + STUNDE })).status, 400)
    assert.equal((await post(app, 'kein json')).status, 400)
    assert.equal((await post(app, share({ id: 'zu-kurz' }))).status, 400)
  })

  test('treats an id that does not exist as gone', async () => {
    const { app } = hub()
    assert.equal((await app.request(`/v1/share/${'c'.repeat(32)}`)).status, 404)
    assert.equal((await app.request('/v1/share/keine-kennung')).status, 400)
  })
})
