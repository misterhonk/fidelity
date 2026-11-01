import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The page's side of the Safari barcode reader (ADR-018, #304).
 *
 * It fetches the .wasm, starts the decoder's own worker and hands it frames.
 * The decoding itself — `readBarcodes` — happens in that worker and nowhere
 * else, so the main thread only copies pixels and waits.
 */
type Posted = {
  message: { wasm?: ArrayBuffer; frame?: { data: { buffer: ArrayBuffer } } }
  transfer: Transferable[]
}

const state = vi.hoisted(() => ({
  workers: [] as FakeWorker[],
  ready: true,
  loadFails: false,
}))

class FakeWorker extends EventTarget {
  posted: Posted[] = []
  terminated = false
  constructor(readonly url: URL) {
    super()
    state.workers.push(this)
    if (state.loadFails) queueMicrotask(() => this.dispatchEvent(new Event('error')))
  }
  postMessage(message: Posted['message'], transfer: Transferable[] = []) {
    this.posted.push({ message, transfer })
    const reply = message.wasm ? { ready: state.ready } : { codes: ['4006381333931'] }
    queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data: reply })))
  }
  terminate() {
    this.terminated = true
  }
}

const frame = { data: { buffer: new ArrayBuffer(16) } }
const context = { drawImage: vi.fn(), getImageData: vi.fn(() => frame) }
const fetchWasm = vi.fn(async () => new Response(new ArrayBuffer(8)))
const video = { videoWidth: 4, videoHeight: 1 } as unknown as HTMLVideoElement

beforeEach(() => {
  vi.resetModules()
  state.workers = []
  state.ready = true
  state.loadFails = false
  fetchWasm.mockClear()
  vi.stubGlobal('Worker', FakeWorker)
  vi.stubGlobal('fetch', fetchWasm)
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => context }) })
})

afterEach(() => vi.unstubAllGlobals())

const launcher = () => import('~/composables/scan/zxing')

describe('zxingDetector', () => {
  it('hands the .wasm and every frame to the worker, and reads its answer', async () => {
    const reader = await (await launcher()).zxingDetector()
    const [worker] = state.workers
    expect(worker!.url.pathname).toMatch(/worker\/scan\/zxing\.ts$/)

    const [wasm] = worker!.posted
    expect(wasm!.message.wasm).toBeInstanceOf(ArrayBuffer)
    expect(wasm!.transfer).toEqual([wasm!.message.wasm])

    expect(await reader.detect(video)).toEqual([{ rawValue: '4006381333931' }])
    const sent = worker!.posted[1]!
    expect(sent.message.frame).toBe(frame)
    expect(sent.transfer).toEqual([frame.data.buffer])
  })

  it('starts one worker for the page, however often the camera opens', async () => {
    const { zxingDetector } = await launcher()
    await zxingDetector()
    await zxingDetector()
    expect(state.workers).toHaveLength(1)
    expect(fetchWasm).toHaveBeenCalledTimes(1)
  })

  it('rejects when the .wasm does not compile, and tries again next time', async () => {
    state.ready = false
    const { zxingDetector } = await launcher()
    await expect(zxingDetector()).rejects.toThrow()
    expect(state.workers[0]!.terminated).toBe(true)

    state.ready = true
    await expect(zxingDetector()).resolves.toBeDefined()
    expect(state.workers).toHaveLength(2)
  })

  it('rejects when the worker script cannot load, instead of waiting forever', async () => {
    state.loadFails = true
    const { zxingDetector } = await launcher()
    await expect(zxingDetector()).rejects.toThrow()
  })

  it('rejects when the .wasm cannot be fetched, and starts no worker', async () => {
    fetchWasm.mockResolvedValueOnce(new Response(null, { status: 404 }))
    const { zxingDetector } = await launcher()
    await expect(zxingDetector()).rejects.toThrow()
    expect(state.workers).toHaveLength(0)
  })
})
