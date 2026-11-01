import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'

import type { Detector } from '../useBarcodeScan'

/**
 * The barcode reader for browsers without `BarcodeDetector` (ADR-018, #301).
 *
 * Only ever reached through `import()` in `useBarcodeScan.start()`, and it
 * only fetches and hands over: the decoding runs in `worker/scan/zxing.ts`,
 * because the main thread does not compute (CLAUDE.md, #304). What stays here
 * is copying a video frame into pixels, which needs the `<video>`.
 *
 * The `.wasm` is served from `/_nuxt/`. zxing-wasm would otherwise fetch it
 * from jsDelivr, which `connect-src` refuses and rule 1 would not want anyway.
 *
 * One worker per page: opened on the first scan, kept for the next. A failed
 * start is forgotten, so the next attempt tries again.
 */
let shared: Promise<Detector> | null = null

export function zxingDetector(): Promise<Detector> {
  shared ??= start().catch((error: unknown) => {
    shared = null
    throw error
  })
  return shared
}

/** A frame decodes in well under a second, even on an old iPhone. */
const FRAME_TIMEOUT = 5000

type Outbound = { ready: boolean } | { codes: string[] }

async function start(): Promise<Detector> {
  // The errors below are never shown: useBarcodeScan turns any of them into
  // `failure: 'unavailable'`. Hence codes, not sentences.
  const response = await fetch(wasmUrl)
  if (!response.ok) throw new Error('decoder-fetch')
  const wasm = await response.arrayBuffer()

  const worker = new Worker(new URL('../../../worker/scan/zxing.ts', import.meta.url), {
    type: 'module',
  })
  // Set once the worker is given up on; its reader then only says so, and
  // never again clears `shared`, which by then may hold a newer worker.
  let dead = false
  // The worker answers in order and is asked one thing at a time. With a
  // timeout, because WebKit can kill a worker under memory pressure without
  // an 'error' event, and a frame that never comes back holds the camera.
  const answer = (timeout?: number) =>
    new Promise<Outbound>((resolve, reject) => {
      const timer = timeout
        ? setTimeout(() => {
            done()
            dead = true
            worker.terminate()
            shared = null
            reject(new Error('decoder-timeout'))
          }, timeout)
        : undefined
      const done = () => {
        clearTimeout(timer)
        worker.removeEventListener('message', onMessage)
        worker.removeEventListener('error', onError)
      }
      const onMessage = (event: MessageEvent<Outbound>) => {
        done()
        resolve(event.data)
      }
      const onError = () => {
        done()
        dead = true
        worker.terminate()
        shared = null
        reject(new Error('decoder-worker'))
      }
      worker.addEventListener('message', onMessage)
      worker.addEventListener('error', onError)
    })

  const ready = answer()
  worker.postMessage({ wasm }, [wasm])
  const first = await ready
  if (!('ready' in first) || !first.ready) {
    worker.terminate()
    throw new Error('decoder-compile')
  }

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { willReadFrequently: true })

  return {
    async detect(video) {
      if (dead) throw new Error('decoder-dead')
      const { videoWidth: width, videoHeight: height } = video
      if (!context || !width || !height) return []
      canvas.width = width
      canvas.height = height
      context.drawImage(video, 0, 0)
      const frame = context.getImageData(0, 0, width, height)
      const reply = answer(FRAME_TIMEOUT)
      worker.postMessage({ frame }, [frame.data.buffer])
      const result = await reply
      return 'codes' in result ? result.codes.map((rawValue) => ({ rawValue })) : []
    },
  }
}
