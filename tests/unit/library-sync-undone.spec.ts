import { describe, expect, it, vi } from 'vitest'

/**
 * The manual sync drains the queue first, and that drain can give up too.
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
vi.mock('~~/worker/outbox', () => ({
  drainOutbox: async () => ({ sent: 0, givenUp: 1, undone: ['Loveless'], waiting: 0 }),
}))
vi.mock('~~/worker/sync/library', () => ({
  syncLibrary: async () => ({
    collection: { stored: 0, requests: 1, total: 0 },
    wantlist: { stored: 0, requests: 1, total: 0 },
  }),
}))

const { handlers } = await import('~~/worker/handlers')

describe('a library sync whose drain gives up', () => {
  it('hands back the record that went back', async () => {
    const result = await handlers['library.sync'](undefined, { report: () => {} } as never)
    expect(result.undone).toEqual(['Loveless'])
  })
})
