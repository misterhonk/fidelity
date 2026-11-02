import { afterEach, describe, expect, it, vi } from 'vitest'

import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import { MAX_ATTEMPTS, pendingJobs } from '~~/db/outbox'
import type { Pressing } from '#shared/types'
import { addPressing, addStatus, undoAdd } from '~~/worker/collection/add'
import type { DiscogsClient } from '~~/worker/discogs/client'
import { DiscogsError } from '~~/worker/discogs/errors'
import { drainOutbox } from '~~/worker/outbox'

/**
 * Add mode (#233): a pressing named by its code, put on the shelf as a copy,
 * followed in the tray, and taken back with undo.
 */

afterEach(async () => {
  await deleteFidelityDb()
})

const dummy: Pressing = {
  releaseId: 372340,
  title: 'Portishead - Dummy',
  year: 1994,
  country: 'UK',
  thumbUrl: '',
  format: 'Vinyl, LP, Album',
  label: 'Go! Beat',
  catno: '828 553-1',
  masterId: 5542,
}

const client = (impl: { write?: () => Promise<unknown>; get?: () => Promise<unknown> } = {}) =>
  ({
    write: vi.fn(impl.write ?? (async () => ({ instance_id: 7 }))),
    get: vi.fn(impl.get ?? (async () => ({ releases: [] }))),
  }) as unknown as DiscogsClient

describe('adding a pressing', () => {
  it('puts a named copy on the shelf with its grade, and queues it — no request', async () => {
    const added = await addPressing(dummy, { grade: 'Near Mint (NM or M-)' })
    const db = await openFidelityDb()

    const row = await db.get('collection', added.key)
    expect(added.key).toBeLessThan(0)
    expect(row?.title).toBe('Dummy')
    expect(row?.artistNames).toEqual(['Portishead'])
    expect(row?.masterId).toBe(5542)
    expect((await db.get('fieldValues', added.key))?.values).toEqual({
      1: 'Near Mint (NM or M-)',
    })
    expect((await pendingJobs()).map((job) => job.kind)).toEqual(['collection.add'])
  })

  it('adds a second copy of a pressing already owned, remembering the first', async () => {
    const first = await addPressing(dummy)
    await drainOutbox(client(), 'mrtnmlchr')
    const second = await addPressing(dummy)

    expect(second.before).toEqual([7])
    expect(second.key).not.toBe(first.key)
    expect(await pendingJobs()).toHaveLength(1)
  })
})

describe('the tray', () => {
  it('reads waiting, then sent with the entry it landed as', async () => {
    const added = await addPressing(dummy)
    expect((await addStatus([added]))[0]?.status).toBe('waiting')

    await drainOutbox(client(), 'mrtnmlchr')
    expect(await addStatus([added])).toEqual([
      { key: added.key, status: 'sent', instanceId: 7 },
    ])
  })

  it('reads failed after a failed run, and after the add was given up on', async () => {
    const added = await addPressing(dummy)
    const down = client({
      write: async () => {
        throw new DiscogsError(422, 'refused')
      },
    })
    await drainOutbox(down, 'mrtnmlchr')
    expect((await addStatus([added]))[0]?.status).toBe('failed')

    for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt++)
      await drainOutbox(down, 'mrtnmlchr')
    expect(await pendingJobs()).toEqual([])
    expect((await addStatus([added]))[0]).toEqual({
      key: added.key,
      status: 'failed',
      instanceId: null,
    })
  })
})

describe('undo', () => {
  it('drops a waiting add before Discogs hears of it', async () => {
    const added = await addPressing(dummy, { placeId: 'crate-1' })
    expect(await undoAdd(added)).toBe(true)

    const db = await openFidelityDb()
    expect(await db.get('collection', added.key)).toBeUndefined()
    expect((await db.get('placements', added.key))?.placeId).toBeNull()
    expect(await pendingJobs()).toEqual([])
  })

  it('removes the entry once the add has landed', async () => {
    const added = await addPressing(dummy)
    await drainOutbox(client(), 'mrtnmlchr')

    expect(await undoAdd(added)).toBe(true)
    const [job] = await pendingJobs()
    expect(job?.kind).toBe('collection.remove')
    expect(job?.payload.instanceId).toBe(7)
  })

  it('does not guess about an add cut off mid-send', async () => {
    const added = await addPressing(dummy)
    const db = await openFidelityDb()
    const job = (await pendingJobs())[0]!
    await db.put('outbox', { ...job, sentAt: Date.now(), instancesBefore: [] })

    expect(await undoAdd(added)).toBe(false)
    expect(await pendingJobs()).toHaveLength(1)
  })
})
