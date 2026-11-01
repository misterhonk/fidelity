import { afterEach, describe, expect, it, vi } from 'vitest'

import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import { pendingJobs, queueJob } from '~~/db/outbox'
import { COVER_CACHE, retryAfterPurge, withQuotaRetry } from '~~/db/quota'

const quota = () => new DOMException('full', 'QuotaExceededError')

function fakeCaches(hasCovers = true) {
  const remove = vi.fn(async (name: string) => hasCovers && name === COVER_CACHE)
  vi.stubGlobal('caches', { delete: remove })
  return remove
}

afterEach(async () => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  await deleteFidelityDb()
})

/** The next native put fails with a full disk, as the browser would; later ones go through. */
const failNextPut = () =>
  vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => {
    throw quota()
  })

describe('a write on a full disk', () => {
  it('purges the cover cache and retries once', async () => {
    const remove = fakeCaches()
    const write = vi.fn().mockRejectedValueOnce(quota()).mockResolvedValueOnce('ok')

    await expect(retryAfterPurge(write)).resolves.toBe('ok')
    expect(remove).toHaveBeenCalledWith(COVER_CACHE)
    expect(write).toHaveBeenCalledTimes(2)
  })

  it('retries only once', async () => {
    fakeCaches()
    const write = vi.fn().mockRejectedValue(quota())

    await expect(retryAfterPurge(write)).rejects.toThrow('full')
    expect(write).toHaveBeenCalledTimes(2)
  })

  it('does not retry other errors, and leaves the covers alone for them', async () => {
    const remove = fakeCaches()
    const write = vi.fn().mockRejectedValue(new Error('ConstraintError'))

    await expect(retryAfterPurge(write)).rejects.toThrow('ConstraintError')
    expect(write).toHaveBeenCalledTimes(1)
    expect(remove).not.toHaveBeenCalled()
  })

  it('gives up at once when there were no covers to purge', async () => {
    fakeCaches(false)
    const write = vi.fn().mockRejectedValue(quota())

    await expect(retryAfterPurge(write)).rejects.toThrow('full')
    expect(write).toHaveBeenCalledTimes(1)
  })

  it('wraps the put and add shortcuts of a database handle, nothing else', async () => {
    fakeCaches()
    const db = {
      put: vi.fn().mockRejectedValueOnce(quota()).mockResolvedValueOnce('key'),
      get: vi.fn().mockRejectedValue(quota()),
    }
    const wrapped = withQuotaRetry(db)

    await expect(wrapped.put('meta', { key: 'x' })).resolves.toBe('key')
    expect(db.put).toHaveBeenCalledTimes(2)
    expect(db.put).toHaveBeenLastCalledWith('meta', { key: 'x' })
    await expect(wrapped.get('meta', 'x')).rejects.toThrow('full')
    expect(db.get).toHaveBeenCalledTimes(1)
  })
})

// The tests above prove the helper; these prove it is actually in the path of a real write.
describe('the database on a full disk', () => {
  it('keeps a queued change once the covers are gone', async () => {
    const remove = fakeCaches()
    failNextPut()

    await queueJob({
      id: 'collection.rating:900',
      kind: 'collection.rating',
      payload: { releaseId: 42, folderId: 1, instanceId: 900, rating: 5 },
      revert: { rating: 3 },
      queuedAt: 1,
    })

    expect(remove).toHaveBeenCalledWith(COVER_CACHE)
    expect((await pendingJobs()).map((j) => j.id)).toEqual(['collection.rating:900'])
  })

  it('retries a put on the opened handle', async () => {
    const remove = fakeCaches()
    const db = await openFidelityDb()
    failNextPut()

    await db.put('meta', { key: 'lastRequestAt', value: 1 })

    expect(remove).toHaveBeenCalledWith(COVER_CACHE)
    expect(await db.get('meta', 'lastRequestAt')).toEqual({ key: 'lastRequestAt', value: 1 })
  })
})
