import { afterEach, describe, expect, it } from 'vitest'

import { getMeta, setMeta } from '~~/db/meta'
import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import { DB_VERSION } from '~~/db/schema'
import type { Dealer, Dig } from '#shared/types'
import { exportEverything } from '~~/worker/export'
import { importEverything } from '~~/worker/import'

/**
 * A backup read back in (M24): the shelf, the shops and the ratings return,
 * the digs do not (rule 4 kept them out of the file), rows merge rather than
 * replace, and a file from before the row shape settled says "sync again".
 */
afterEach(async () => {
  await deleteFidelityDb()
})

const dealer: Dealer = {
  username: 'vinyl-tom',
  displayName: 'Vinyl Tom',
  avatarUrl: '',
  numForSale: 300,
  location: 'Berlin',
  lastScannedAt: 1000,
  shippingTiers: [],
} as unknown as Dealer

const dig: Dig = {
  id: '01A',
  dealer: 'vinyl-tom',
  status: 'done',
  startedAt: 1000,
  finishedAt: 2000,
  expiresAt: 1000 + 6 * 60 * 60 * 1000,
  listingsTotal: 300,
  listingsScanned: 300,
  matchCount: 1,
  requests: 3,
} as unknown as Dig

async function seedDevice() {
  const db = await openFidelityDb()
  await db.put('dealers', dealer)
  await db.put('digs', dig)
  await db.put('feedback', { listingId: 7, verdict: 'interesting', at: 5 } as never)
  await setMeta('preferences', { maxPrice: 40 } as never)
}

describe('reading a backup back in', () => {
  it('brings the shops and the ratings back, leaves the digs out, and says so', async () => {
    await seedDevice()
    const file = await exportEverything(9000)
    expect(file.dbVersion).toBe(DB_VERSION)
    await deleteFidelityDb()

    const report = await importEverything(JSON.parse(JSON.stringify(file)))
    expect(report.imported).toEqual({ dealers: 1, feedback: 1 })
    expect(report.skipped).toEqual([{ store: 'digs', rows: 1, reason: 'no-prices' }])
    expect(report.meta).toEqual(['preferences'])

    const db = await openFidelityDb()
    expect((await db.get('dealers', 'vinyl-tom'))?.displayName).toBe('Vinyl Tom')
    expect(await db.getAll('digs')).toEqual([])
    expect(await getMeta('preferences')).toEqual({ maxPrice: 40 })
  })

  /*
   * Found on 2026-10-21: the token never went into the file, the hub's secret
   * and the access key did, in plain text.
   */
  it('keeps the hub keys out of the file, and out of the device when an old file holds them', async () => {
    await setMeta('preferences', {
      maxPrice: 40,
      hubSecret: 'friends-only',
      accessKey: 'signed.key',
    } as never)
    const file = await exportEverything(9000)
    expect(JSON.stringify(file)).not.toContain('friends-only')
    expect(JSON.stringify(file)).not.toContain('signed.key')
    await deleteFidelityDb()

    const old = {
      ...JSON.parse(JSON.stringify(file)),
      preferences: {
        maxPrice: 40,
        currency: 7,
        hubSecret: 'friends-only',
        accessKey: 'signed.key',
        hubUrl: 'https://someone-elses.example',
        catalogueUrl: 'https://someone-elses.example/catalogue',
      },
    }
    await importEverything(old)
    const restored = (await getMeta('preferences')) as unknown as Record<string, unknown>
    // Parsed field by field (#207): the right type comes back, the wrong one does not,
    // and where this device's hub and catalogue live never comes from a file.
    expect(restored).toEqual({ maxPrice: 40 })
  })

  it('merges into what the device already has, and keeps its own preferences', async () => {
    await seedDevice()
    const file = await exportEverything(9000)
    await deleteFidelityDb()
    const db = await openFidelityDb()
    await db.put('dealers', { ...dealer, username: 'other-shop', displayName: 'Other' })
    await setMeta('preferences', { maxPrice: 99 } as never)

    const report = await importEverything(JSON.parse(JSON.stringify(file)))
    expect(report.meta).toEqual([])
    expect((await db.getAll('dealers')).map((d) => d.username).sort()).toEqual([
      'other-shop',
      'vinyl-tom',
    ])
    expect(await getMeta('preferences')).toEqual({ maxPrice: 99 })
  })

  it('skips shelf rows written by a database from before the shape settled', async () => {
    await seedDevice()
    const file = await exportEverything(9000)
    await deleteFidelityDb()
    const old = {
      ...JSON.parse(JSON.stringify(file)),
      dbVersion: 5,
      collection: [{ instanceId: 1 }],
    }

    const report = await importEverything(old)
    expect(report.skipped).toContainEqual({ store: 'collection', rows: 1, reason: 'too-old' })
    expect(report.imported.dealers).toBe(1)
  })

  it('refuses what is not a backup, and a backup from the future', async () => {
    await expect(importEverything({ hello: 'world' })).rejects.toMatchObject({
      code: 'not-a-backup',
    })
    await expect(importEverything('nope')).rejects.toMatchObject({ code: 'not-a-backup' })
    await expect(
      importEverything({ kind: 'fidelity-backup', version: 2 }),
    ).rejects.toMatchObject({
      code: 'backup-too-new',
    })
  })
})

describe('a backup that is not quite right', () => {
  it('skips rows the database could not put, and preferences that are not an object', async () => {
    const report = await importEverything({
      kind: 'fidelity-backup',
      version: 1,
      feedback: [{ listingId: 1 }, { listingId: '' }, 'row', null, { listingId: { x: 1 } }],
      preferences: 'all of them',
    })
    expect(report.imported.feedback).toBe(1)
    expect(report.skipped).toEqual([{ store: 'feedback', rows: 4, reason: 'invalid' }])
    expect(report.meta).toEqual([])
  })

  it('skips a shop row without its tiers and says how many', async () => {
    const file = await exportEverything(9000)
    const report = await importEverything({
      ...JSON.parse(JSON.stringify(file)),
      dealers: [dealer, { username: 'broken' }],
    })
    expect(report.imported.dealers).toBe(1)
    expect(report.skipped).toContainEqual({ store: 'dealers', rows: 1, reason: 'invalid' })
    expect(await (await openFidelityDb()).get('dealers', 'broken')).toBeUndefined()
  })

  it('writes nothing at all when the database refuses one row', async () => {
    const file = await exportEverything(9000)
    await expect(
      importEverything({
        ...JSON.parse(JSON.stringify(file)),
        dealers: [dealer],
        // Passes the check, but cannot be cloned into IndexedDB.
        collection: [{ instanceId: 1, refuse: () => 1 }],
      }),
    ).rejects.toThrow()
    expect(await (await openFidelityDb()).getAll('dealers')).toEqual([])
  })
})

describe('what a backup carries besides', () => {
  it('brings back followed artists and watched records, without the prices', async () => {
    const db = await openFidelityDb()
    await db.put('followed', { artistId: 3, name: 'Can', followedAt: 5 })
    await db.put('watched', {
      releaseId: 9,
      kind: 'wantlist',
      artist: 'Can',
      title: 'Tago Mago',
      since: 5,
      threshold: 30,
      points: [{ at: 6, lowestPrice: 41.5, currency: 'EUR', numForSale: 2 }],
      checkedAt: 6,
      notifiedAt: null,
    })
    await db.put('basket', {
      listingId: 7,
      dealer: 'vinyl-tom',
      releaseId: 9,
      title: 'Can – Tago Mago',
      price: 33.99,
      currency: 'EUR',
      addedAt: 8000,
      note: null,
      postage: { price: 7.5, currency: 'EUR', original: null },
    } as never)
    const file = await exportEverything(9000)
    expect(JSON.stringify(file)).not.toContain('41.5')
    expect(JSON.stringify(file)).not.toContain('33.99')
    expect(JSON.stringify(file)).not.toContain('7.5')
    await deleteFidelityDb()

    const report = await importEverything(JSON.parse(JSON.stringify(file)))
    expect(report.imported).toMatchObject({ followed: 1, watched: 1, basket: 1 })
    const back = await openFidelityDb()
    expect(await back.get('followed', 3)).toMatchObject({ name: 'Can' })
    expect(await back.get('watched', 9)).toMatchObject({ threshold: 30, points: [] })
    // Back without a price, and priced at 0 so it reads as expired; addedAt stays for the sort.
    expect(await back.get('basket', 7)).toMatchObject({ price: 0, pricedAt: 0, addedAt: 8000 })
  })

  it('does not replace a basket line that still has its price', async () => {
    const db = await openFidelityDb()
    const line = { listingId: 7, dealer: 'x', price: 33.99, addedAt: 8000 } as never
    await db.put('basket', line)
    const file = await exportEverything(9000)
    await importEverything(JSON.parse(JSON.stringify(file)))
    expect((await db.get('basket', 7))?.price).toBe(33.99)
  })

  it('does not replace a watched record that still has its price history', async () => {
    const db = await openFidelityDb()
    const row = { releaseId: 5, since: 100, points: [{ at: 200, lowestPrice: 41.5 }] } as never
    await db.put('watched', row)
    const file = await exportEverything(9000)
    await importEverything(JSON.parse(JSON.stringify(file)))
    expect((await db.get('watched', 5))?.points).toHaveLength(1)
  })

  /** Typed on this device and nowhere else (#242): a new device gets them from the file. */
  it('carries the pressing rules, keeps the device’s own, and drops a malformed one', async () => {
    await setMeta('pressingRules', { 42: { firstOnly: true, except: [9101] } })
    const file = await exportEverything(9000)
    expect(file.pressingRules).toEqual({ 42: { firstOnly: true, except: [9101] } })
    await deleteFidelityDb()

    const rule = { firstOnly: true, except: [9101] }
    const tampered = { ...file, pressingRules: { 42: rule, x: rule, 7: { except: 'no' } } }
    const report = await importEverything(JSON.parse(JSON.stringify(tampered)))
    expect(report.meta).toContain('pressingRules')
    expect(await getMeta('pressingRules')).toEqual({ 42: { firstOnly: true, except: [9101] } })

    await setMeta('pressingRules', { 5: { firstOnly: false, except: [1] } })
    expect((await importEverything(JSON.parse(JSON.stringify(file)))).meta).not.toContain(
      'pressingRules',
    )
    expect(await getMeta('pressingRules')).toEqual({ 5: { firstOnly: false, except: [1] } })
  })
})
