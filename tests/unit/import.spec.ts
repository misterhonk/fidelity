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
