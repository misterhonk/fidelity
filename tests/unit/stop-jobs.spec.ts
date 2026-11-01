import { readFileSync } from 'node:fs'

import { beforeAll, describe, expect, it, vi } from 'vitest'

import { milestone } from '~/utils/milestone'

import { withoutComments } from '../helpers/german'

/**
 * Every long job can be stopped, from any screen that shows it (#216).
 *
 * The page that shows a running dig is often not the page that started it, so
 * it holds no request id to cancel. The worker therefore also cancels by kind.
 */

type Listener = (event: { data: unknown }) => void

const posted: unknown[] = []
let listener: Listener | undefined

vi.mock('~~/worker/handlers', () => ({
  handlers: {
    'dig.run': (_params: unknown, { signal }: { signal: AbortSignal }) =>
      new Promise((_resolve, reject) =>
        signal.addEventListener('abort', () => reject(new Error('aborted'))),
      ),
    'horizon.build': (_params: unknown, { signal }: { signal: AbortSignal }) =>
      new Promise((_resolve, reject) =>
        signal.addEventListener('abort', () => reject(new Error('aborted'))),
      ),
  },
}))
vi.mock('~~/db/expire', () => ({ sweepIfDue: async () => undefined }))

describe('the worker cancels by kind', () => {
  beforeAll(async () => {
    vi.stubGlobal('self', {
      postMessage: (message: unknown) => posted.push(message),
      addEventListener: (_type: string, fn: Listener) => (listener = fn),
    })
    await import('~~/worker/index')
  })

  it('aborts every request of the named kind and nothing else', async () => {
    listener?.({ data: { id: 'a', kind: 'dig.run', params: { dealer: 'x' } } })
    listener?.({ data: { id: 'b', kind: 'horizon.build', params: undefined } })
    await new Promise((done) => setTimeout(done, 10))

    listener?.({ data: { id: 'stop', kind: '$cancel', of: ['dig.run', 'dig.resume'] } })
    await new Promise((done) => setTimeout(done, 10))

    expect(posted).toEqual([
      { id: 'a', type: 'error', error: expect.objectContaining({ code: 'cancelled' }) },
    ])
  })
})

describe('progress is announced at milestones only', () => {
  it('rounds down to the last tenth', () => {
    expect([0, 9, 10, 19.9, 55, 99, 100, 140, -3].map(milestone)).toEqual([
      0, 0, 10, 10, 50, 90, 100, 100, 0,
    ])
  })

  /*
   * The bars used to sit inside `aria-live` regions with a counter that moved
   * every 1.2 s — a screen reader read out every page of a dig.
   */
  const panels = [
    'app/pages/dig.vue',
    'app/components/LibrarySync.vue',
    'app/components/HorizonBuild.vue',
    'app/components/CreditHarvest.vue',
    'app/components/ShopRound.vue',
  ]

  for (const file of panels) {
    const source = withoutComments(readFileSync(file, 'utf8'))

    it(`${file} has no live counter, a progress bar, a milestone note and a stop button`, () => {
      expect(source).not.toMatch(/aria-live/)
      expect(source).toMatch(/role="progressbar"/)
      expect(source).toMatch(/<JobMilestone/)
      expect(source).toMatch(/common\.stop\b/)
    })
  }
})
