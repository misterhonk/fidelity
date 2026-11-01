import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, onScopeDispose, readonly, ref } from 'vue'

import type { DrainResult } from '~~/worker/outbox'

/**
 * The flush right after a change can be the one that gives up.
 *
 * Then an older change goes back on the shelf, and the keeper never hears of
 * it — so the sheet that made the change has to say which record it was.
 */

const flush = vi.fn<() => Promise<DrainResult>>()

vi.stubGlobal('ref', ref)
vi.stubGlobal('readonly', readonly)
vi.stubGlobal('onScopeDispose', onScopeDispose)
vi.stubGlobal('useFidelityWorker', () => ({ call: flush }))

const { useWriteBack } = await import('~/composables/useWriteBack')

afterEach(() => flush.mockReset())

describe('a change whose flush gives up on another', () => {
  it('names the record that went back', async () => {
    flush.mockResolvedValue({ sent: 0, givenUp: 1, undone: ['Loveless'], waiting: 1 })
    const scope = effectScope()
    const writeBack = scope.run(() => useWriteBack())!

    await writeBack.push(async () => true)

    expect(writeBack.state.value).toBe('queued')
    expect(writeBack.undone.value).toEqual(['Loveless'])
    scope.stop()
  })

  it('forgets it with the next change', async () => {
    flush
      .mockResolvedValueOnce({ sent: 0, givenUp: 1, undone: ['Loveless'], waiting: 0 })
      .mockResolvedValue({ sent: 1, givenUp: 0, undone: [], waiting: 0 })
    const scope = effectScope()
    const writeBack = scope.run(() => useWriteBack())!

    await writeBack.push(async () => true)
    await writeBack.push(async () => true)

    expect(writeBack.undone.value).toEqual([])
    scope.stop()
  })
})
