import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

/**
 * Where the browser has no `BarcodeDetector`, the camera reads through a
 * zxing-wasm decoder loaded on the tap and not before (ADR-018, #301).
 *
 * The decoder module is mocked: what matters here is *when* it is imported,
 * and what the screen is told when it cannot be.
 */
const zxing = vi.hoisted(() => ({
  imported: 0,
  created: 0,
  fail: false,
  read: [] as { rawValue: string }[],
}))

vi.mock('~/composables/scan/zxing', () => {
  zxing.imported++
  return {
    zxingDetector: async () => {
      zxing.created++
      if (zxing.fail) throw new TypeError('Failed to fetch')
      return { detect: async () => zxing.read }
    },
  }
})

const { useBarcodeScan } = await import('~/composables/useBarcodeScan')

const track = { stop: vi.fn() }
const getUserMedia = vi.fn(async () => ({ getTracks: () => [track] }))
const video = { srcObject: null, play: async () => {} } as unknown as HTMLVideoElement

beforeEach(() => {
  zxing.created = 0
  zxing.fail = false
  zxing.read = [{ rawValue: '4006381333931' }]
  getUserMedia.mockClear()
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
})

afterEach(() => vi.unstubAllGlobals())

function scanner() {
  const scope = effectScope()
  const scan = scope.run(() => useBarcodeScan())!
  return { scan, scope }
}

describe('useBarcodeScan without BarcodeDetector', () => {
  it('loads nothing until start, then reads through the decoder', async () => {
    const { scan, scope } = scanner()
    // The mock factory runs on the first `import()` of the module — this test
    // runs first, so a static import anywhere would already have counted.
    expect(zxing.imported).toBe(0)

    const found = await new Promise<string>((resolve) => void scan.start(video, resolve))
    expect(zxing.imported).toBe(1)
    expect(zxing.created).toBe(1)
    expect(found).toBe('4006381333931')
    expect(scan.failure.value).toBeNull()
    expect(track.stop).toHaveBeenCalled()
    scope.stop()
  })

  it('falls back to the field when the decoder cannot load, and opens no camera', async () => {
    zxing.fail = true
    const { scan, scope } = scanner()
    await scan.start(video, () => {})
    expect(scan.failure.value).toBe('unavailable')
    expect(scan.running.value).toBe(false)
    expect(getUserMedia).not.toHaveBeenCalled()
    scope.stop()
  })

  it('opens no camera when stopped while the decoder was still loading', async () => {
    const { scan, scope } = scanner()
    const started = scan.start(video, () => {})
    scan.stop()
    await started
    expect(getUserMedia).not.toHaveBeenCalled()
    expect(scan.running.value).toBe(false)
    scope.stop()
  })
})

describe('useBarcodeScan with BarcodeDetector', () => {
  it('never imports the decoder', async () => {
    class BarcodeDetector {
      async detect() {
        return [{ rawValue: '5099902894225' }]
      }
    }
    vi.stubGlobal('BarcodeDetector', BarcodeDetector)
    const { scan, scope } = scanner()
    const found = await new Promise<string>((resolve) => void scan.start(video, resolve))
    expect(found).toBe('5099902894225')
    expect(zxing.created).toBe(0)
    scope.stop()
  })
})
