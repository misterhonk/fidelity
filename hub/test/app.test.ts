import assert from 'node:assert/strict'
import { test, describe } from 'node:test'

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

describe('health', () => {
  test('reports counts and whether it is secured', async () => {
    const { app } = hub('geheim')
    const body = await (await app.request('/v1/health')).json()
    assert.deepEqual(body, { ok: true, horizon: 0, shipping: 0, secured: true })
  })

  test('stays open even on a secured hub, so a monitor needs no secret', async () => {
    const { app } = hub('geheim')
    assert.equal((await app.request('/v1/health')).status, 200)
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
    assert.deepEqual(body, { tiers })
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
