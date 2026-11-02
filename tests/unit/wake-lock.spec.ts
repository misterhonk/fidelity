import { readFileSync } from 'node:fs'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import { useWakeLock } from '~/composables/useWakeLock'

/**
 * The screen stays on in the shop and while a dig runs (#198).
 *
 * A stub `navigator.wakeLock` and a stub `document` stand in for the browser:
 * the composable is a watch and two listeners, which is all there is to test.
 */
class Sentinel extends EventTarget {
  released = false
  async release() {
    this.released = true
    this.dispatchEvent(new Event('release'))
  }
}

let held: Sentinel[]
let request: ReturnType<typeof vi.fn>
let doc: EventTarget & { visibilityState: string }

const flush = async () => {
  await nextTick()
  await new Promise((r) => setTimeout(r, 0))
}

function setVisibility(state: 'visible' | 'hidden') {
  doc.visibilityState = state
  // The browser drops the lock itself when the page hides.
  if (state === 'hidden') for (const s of held) if (!s.released) void s.release()
  doc.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  held = []
  request = vi.fn(async () => {
    const s = new Sentinel()
    held.push(s)
    return s
  })
  doc = Object.assign(new EventTarget(), { visibilityState: 'visible' })
  vi.stubGlobal('document', doc)
  vi.stubGlobal('navigator', { wakeLock: { request } })
})

afterEach(() => vi.unstubAllGlobals())

const active = () => held.filter((s) => !s.released).length

describe('useWakeLock', () => {
  it('holds the lock while wanted and releases it when done', async () => {
    const running = ref(true)
    const scope = effectScope()
    scope.run(() => useWakeLock(() => running.value))
    await flush()
    expect(request).toHaveBeenCalledWith('screen')
    expect(active()).toBe(1)

    running.value = false
    await flush()
    expect(active()).toBe(0)
    scope.stop()
  })

  it('releases when the screen goes away', async () => {
    const scope = effectScope()
    scope.run(() => useWakeLock(() => true))
    await flush()
    expect(active()).toBe(1)

    scope.stop()
    await flush()
    expect(active()).toBe(0)
  })

  it('takes it again when the page comes back, if still wanted', async () => {
    const running = ref(true)
    const scope = effectScope()
    scope.run(() => useWakeLock(() => running.value))
    await flush()

    setVisibility('hidden')
    await flush()
    expect(active()).toBe(0)

    setVisibility('visible')
    await flush()
    expect(request).toHaveBeenCalledTimes(2)
    expect(active()).toBe(1)

    // Not if the dig finished while hidden.
    setVisibility('hidden')
    running.value = false
    await flush()
    setVisibility('visible')
    await flush()
    expect(request).toHaveBeenCalledTimes(2)
    expect(active()).toBe(0)
    scope.stop()
  })

  it('does nothing and throws nothing where unsupported', async () => {
    vi.stubGlobal('navigator', {})
    const scope = effectScope()
    expect(() => scope.run(() => useWakeLock(() => true))).not.toThrow()
    await flush()
    scope.stop()
  })

  it('swallows a refused request', async () => {
    request.mockRejectedValueOnce(new DOMException('no', 'NotAllowedError'))
    const scope = effectScope()
    scope.run(() => useWakeLock(() => true))
    await flush()
    expect(active()).toBe(0)
    scope.stop()
  })
})

describe('where it is used', () => {
  it('keeps the screen on in the shop', () => {
    expect(readFileSync('app/pages/in-store.vue', 'utf8')).toMatch(
      /useWakeLock\(\(\) => true\)/,
    )
  })

  it('keeps the screen on while a dig runs', () => {
    expect(readFileSync('app/pages/shop.vue', 'utf8')).toMatch(/useWakeLock\(/)
  })
})
