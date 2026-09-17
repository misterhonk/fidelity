import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { buildCatalogue } from '../src/etl/build.ts'
import { createCatalogueApp, formatOf } from '../src/service/app.ts'

/**
 * The two routes of M21.4 against the mini-dump, built in memory: a family
 * as the app's `PressingFamilyFacts`, a person as the lexicon's `Kin`, and
 * the build date on every answer as the ETag.
 */
const built = await buildCatalogue({
  dumpDir: new URL('../fixtures/mini-dump/', import.meta.url).pathname,
  date: '20260901',
  out: ':memory:',
})
const app = createCatalogueApp({ db: () => built.db })
const get = (path: string, headers: Record<string, string> = {}) =>
  app.request(path, { headers })

describe('health', () => {
  test('says which build answers and how many releases it holds', async () => {
    const response = await get('/v1/catalogue/health')
    assert.equal(response.status, 200)
    const health = (await response.json()) as {
      ok: boolean
      build: string
      releases: number
      stale: boolean
    }
    assert.equal(health.ok, true)
    assert.equal(health.build, '2026-09-01')
    assert.equal(health.releases, 400)
    assert.equal(response.headers.get('etag'), '"2026-09-01"')
  })

  test('calls a build stale after forty days, and not before', async () => {
    const day = 86_400_000
    const at = (days: number) =>
      createCatalogueApp({
        db: () => built.db,
        now: () => Date.parse('2026-09-01') + days * day,
      })
    const fresh = (await (await at(39).request('/v1/catalogue/health')).json()) as {
      stale: boolean
    }
    const old = (await (await at(41).request('/v1/catalogue/health')).json()) as {
      stale: boolean
    }
    assert.equal(fresh.stale, false)
    assert.equal(old.stale, true)
  })
})

describe('a family', () => {
  test('is every pressing of the master, oldest first, in the app’s shape', async () => {
    const response = await get('/v1/catalogue/master/1315/family')
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'public, max-age=2592000')
    const facts = (await response.json()) as {
      masterId: number
      total: number
      fetchedAt: number
      siblings: {
        releaseId: number
        year: number | null
        country: string
        label: string
        catno: string
        format: string
        discs: number
      }[]
    }
    assert.equal(facts.masterId, 1315)
    assert.equal(facts.total, 2)
    assert.equal(facts.fetchedAt, Date.parse('2026-09-01'))
    assert.deepEqual(
      facts.siblings.map((s) => [s.releaseId, s.year, s.country]),
      [
        [157, 1994, 'UK'],
        [158, 1994, 'UK'],
      ],
    )
    // The label from the label table, the format the way the API writes it.
    assert.ok(facts.siblings.every((s) => s.label.length > 0))
    assert.equal(facts.siblings[0]!.format, 'Vinyl, 12", 33 ⅓ RPM, 45 RPM, EP')
    assert.equal(facts.siblings[1]!.format, 'CD, EP')
    assert.ok(facts.siblings.every((s) => Number.isInteger(s.discs) && s.discs >= 1))
  })

  test('is a 404 for a master the build does not know, and a 400 for nonsense', async () => {
    assert.equal((await get('/v1/catalogue/master/999999999/family')).status, 404)
    assert.equal((await get('/v1/catalogue/master/abc/family')).status, 400)
  })

  test('is a 304 when the browser already has this month’s answer', async () => {
    const response = await get('/v1/catalogue/master/1315/family', {
      'if-none-match': '"2026-09-01"',
    })
    assert.equal(response.status, 304)
    const stale = await get('/v1/catalogue/master/1315/family', {
      'if-none-match': '"2026-08-01"',
    })
    assert.equal(stale.status, 200)
  })
})

describe('a person', () => {
  test('is the name and every other name, aliases and variations alike', async () => {
    const response = await get('/v1/catalogue/artist/1')
    assert.equal(response.status, 200)
    const artist = (await response.json()) as {
      id: number
      name: string
      names: { name: string; relation: string }[]
    }
    assert.equal(artist.name, 'The Persuader')
    assert.ok(artist.names.some((n) => n.name === 'Jesper Dahlbäck' && n.relation === 'alias'))
    assert.ok(artist.names.some((n) => n.name === 'Persuader' && n.relation === 'alias'))
    assert.ok(artist.names.every((n) => ['alias', 'member', 'group'].includes(n.relation)))
    assert.ok(!artist.names.some((n) => n.name === 'The Persuader'))
  })

  test('is a 404 for a person the build does not know', async () => {
    assert.equal((await get('/v1/catalogue/artist/999999999')).status, 404)
  })
})

describe('the format string', () => {
  test('reads like the API’s', () => {
    assert.equal(formatOf('Vinyl', '["12\\"","33 ⅓ RPM"]'), 'Vinyl, 12", 33 ⅓ RPM')
    assert.equal(formatOf('CD', '[]'), 'CD')
    assert.equal(formatOf(null, null), '')
  })
})

describe('a label’s run and a person’s credits (M21.5)', () => {
  test('a run is the label’s releases with their numbers, the series first', async () => {
    const response = await get('/v1/catalogue/label/5/run')
    assert.equal(response.status, 200)
    const run = (await response.json()) as {
      id: number
      name: string
      build: string
      total: number
      prefix: string | null
      releases: [number, number | null, number | null, string | null][]
    }
    assert.equal(run.name, 'Svek')
    assert.equal(run.build, '2026-09-01')
    assert.equal(run.prefix, 'SK')
    assert.equal(run.releases.length, run.total)
    // Series rows first, by number; the first one is SK 032, Stockholm.
    const [first] = run.releases
    assert.equal(first![3], 'SK')
    assert.ok(run.releases.filter((r) => r[3] === 'SK').length === 18)
    assert.ok(run.releases.every((r) => r[0] > 0))
  })

  test('credits are every release a person is on, with the engine’s role index', async () => {
    const response = await get('/v1/catalogue/artist/239/credits')
    assert.equal(response.status, 200)
    const credits = (await response.json()) as {
      id: number
      name: string
      total: number
      releases: [number, number, number | null][]
    }
    assert.equal(credits.name, 'Jesper Dahlbäck')
    assert.equal(credits.releases.length, credits.total)
    // Release 1 credits him "Written-By [All Tracks By]" — no table role, so main.
    assert.deepEqual(
      credits.releases.find((r) => r[0] === 1),
      [1, 0, 1999],
    )
    assert.ok(
      credits.releases.some((r) => r[1] === 1),
      'a producer credit somewhere',
    )
    assert.ok(credits.releases.every((r) => r[1] >= 0))
    // One row per release, ascending.
    const ids = credits.releases.map((r) => r[0])
    assert.deepEqual(
      ids,
      [...new Set(ids)].sort((a, b) => a - b),
    )
  })

  test('are 404s for a label or a person the build does not know', async () => {
    assert.equal((await get('/v1/catalogue/label/999999999/run')).status, 404)
    assert.equal((await get('/v1/catalogue/artist/999999999/credits')).status, 404)
  })
})

describe('the shop and the map (M21.6)', () => {
  test('identify answers exact stamps, typed with or without the spaces', async () => {
    const typed = await get(
      '/v1/catalogue/identify?runout=mpo%20sk%20032%20a1%20g%20phrupmastergeneral%20t2t%20london',
    )
    assert.equal(typed.status, 200)
    assert.deepEqual(await typed.json(), { releaseIds: [1], exact: true })
    const fragment = await get('/v1/catalogue/identify?runout=MPO%20SK%20032')
    assert.deepEqual(await fragment.json(), { releaseIds: [], exact: true })
    assert.equal((await get('/v1/catalogue/identify')).status, 400)
  })

  test('a release carries what a search row would, from CC0 fields', async () => {
    const response = await get('/v1/catalogue/release/1')
    assert.equal(response.status, 200)
    const release = (await response.json()) as {
      id: number
      title: string
      year: number | null
      country: string
      masterId: number
      artists: string[]
      labels: { name: string; catno: string }[]
      formats: string[]
      discs: number
    }
    assert.equal(release.title, 'Stockholm')
    assert.equal(release.year, 1999)
    assert.equal(release.country, 'Sweden')
    assert.equal(release.masterId, 1660109)
    assert.deepEqual(release.artists, ['The Persuader'])
    assert.deepEqual(release.labels, [{ name: 'Svek', catno: 'SK032' }])
    assert.equal(release.formats[0], 'Vinyl, 12", 33 ⅓ RPM')
    // Two discs, and the count stays out of the format words (M34.3).
    assert.equal(release.discs, 2)
    assert.equal((await get('/v1/catalogue/release/999999999')).status, 404)
  })

  test('stats are the catalogue’s own distribution, with the build and the total', async () => {
    const response = await get('/v1/catalogue/stats/decades')
    assert.equal(response.status, 200)
    const stats = (await response.json()) as {
      build: string
      total: number
      rows: [string, number][]
    }
    assert.equal(stats.build, '2026-09-01')
    assert.equal(stats.total, 400)
    const nineties = stats.rows.find(([key]) => key === '1990')
    assert.ok(
      nineties && nineties[1] > 100,
      'the first four hundred releases are mostly nineties',
    )
    const styles = (await (await get('/v1/catalogue/stats/styles')).json()) as {
      rows: [string, number][]
    }
    assert.ok(styles.rows.some(([key]) => key === 'Techno'))
    assert.equal((await get('/v1/catalogue/stats/prices')).status, 400)
  })

  test('stats are counted off the request thread when there is a file', async () => {
    const { mkdtempSync, rmSync, writeFileSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const { buildCatalogue } = await import('../src/etl/build.ts')
    const { createCatalogueApp } = await import('../src/service/app.ts')
    const { DatabaseSync } = await import('node:sqlite')
    const dir = mkdtempSync(join(tmpdir(), 'fidelity-stats-'))
    const file = join(dir, 'old.sqlite')
    const older = await buildCatalogue({
      dumpDir: new URL('../fixtures/mini-dump/', import.meta.url).pathname,
      date: '20260901',
      out: file,
    })
    older.db.exec('DROP TABLE stats')
    older.db.close()
    const reopened = new DatabaseSync(file, { readOnly: true })
    const threaded = createCatalogueApp({ db: () => reopened, path: () => file })
    const response = await threaded.request('/v1/catalogue/stats/decades')
    const stats = (await response.json()) as { total: number; rows: [string, number][] }
    assert.equal(stats.total, 400)
    assert.ok(stats.rows.some(([key]) => key === '1990'))
    reopened.close()
    writeFileSync(join(dir, '.done'), '')
    rmSync(dir, { recursive: true, force: true })
  })

  test('stats are counted on the spot for a build from before the table', async () => {
    const { buildCatalogue } = await import('../src/etl/build.ts')
    const older = await buildCatalogue({
      dumpDir: new URL('../fixtures/mini-dump/', import.meta.url).pathname,
      date: '20260901',
      out: ':memory:',
    })
    older.db.exec('DROP TABLE stats')
    const { createCatalogueApp } = await import('../src/service/app.ts')
    const legacy = createCatalogueApp({ db: () => older.db })
    const response = await legacy.request('/v1/catalogue/stats/decades')
    const stats = (await response.json()) as { total: number; rows: [string, number][] }
    assert.equal(stats.total, 400)
    assert.ok(stats.rows.some(([key]) => key === '1990'))
    older.db.close()
  })
})
