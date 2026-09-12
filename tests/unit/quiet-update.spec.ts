import { describe, expect, it } from 'vitest'

import { UPDATE_PATIENCE_MS, updateStep } from '~/utils/quiet-update'

/**
 * The quiet update (M24): a new version loads by itself between two screens
 * unless a dig is running; a dig that runs longer than the patience gives
 * the decision back to the person.
 */
describe('a waiting service worker', () => {
  it('is nothing to do while no version waits', () => {
    expect(updateStep({ needRefresh: false, digRunning: true, waitingSince: 0, now: 1 })).toBe(
      'nothing',
    )
  })

  it('applies as soon as nothing is running', () => {
    expect(updateStep({ needRefresh: true, digRunning: false, waitingSince: 0, now: 1 })).toBe(
      'apply',
    )
  })

  it('waits for a dig, and asks once the dig has taken too long', () => {
    expect(
      updateStep({ needRefresh: true, digRunning: true, waitingSince: 1000, now: 2000 }),
    ).toBe('wait')
    expect(
      updateStep({
        needRefresh: true,
        digRunning: true,
        waitingSince: 1000,
        now: 1000 + UPDATE_PATIENCE_MS + 1,
      }),
    ).toBe('ask')
  })
})
