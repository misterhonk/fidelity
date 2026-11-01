import { afterEach, describe, expect, it, vi } from 'vitest'

import { COVER_CACHE, retryAfterPurge, withQuotaRetry } from '~~/db/quota'

const quota = () => new DOMException('full', 'QuotaExceededError')

function fakeCaches(hasCovers = true) {
  const remove = vi.fn(async (name: string) => hasCovers && name === COVER_CACHE)
  vi.stubGlobal('caches', { delete: remove })
  return remove
}

afterEach(() => {
  vi.unstubAllGlobals()
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
