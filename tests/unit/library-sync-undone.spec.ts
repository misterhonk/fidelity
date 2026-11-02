import { describe, expect, it, vi } from 'vitest'

/**
 * The manual sync drains the queue after reading (#238), and that drain can give up too.
 *
 * Its revert used to vanish with the drain's result, so the button that says
 * "fetch everything again" could quietly undo a change and say nothing.
 */

vi.mock('~~/worker/auth', async (original) => ({
  ...(await original<object>()),
  currentIdentity: async () => ({ username: 'mrtnmlchr' }),
  requestPersistence: async () => true,
  discogs: () => ({}),
}))
const drainOutbox = vi.fn(async () => ({
  sent: 0,
  givenUp: 1,
  undone: ['Loveless'],
  waiting: 0,
}))
const syncLibrary = vi.fn(async () => ({
  collection: { stored: 0, requests: 1, total: 0 },
  wantlist: { stored: 0, requests: 1, total: 0 },
}))
vi.mock('~~/worker/outbox', () => ({ drainOutbox }))
vi.mock('~~/worker/sync/library', () => ({ syncLibrary }))

const { handlers } = await import('~~/worker/handlers')

describe('a library sync whose drain gives up', () => {
  it('hands back the record that went back', async () => {
    const result = await handlers['library.sync'](undefined, { report: () => {} } as never)
    expect(result.undone).toEqual(['Loveless'])
  })

  it('still sends what is waiting when the read fails', async () => {
    syncLibrary.mockRejectedValueOnce(new Error('offline'))
    drainOutbox.mockClear()
    await expect(
      handlers['library.sync'](undefined, { report: () => {} } as never),
    ).rejects.toThrow('offline')
    expect(drainOutbox).toHaveBeenCalledOnce()
  })
})
