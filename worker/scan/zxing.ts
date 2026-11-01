import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader'

/**
 * The barcode reader's own worker (ADR-018, #304).
 *
 * Not the Discogs worker: this one makes no requests, is started only by
 * `app/composables/scan/zxing.ts` after a tap on "Scan" in a browser without
 * `BarcodeDetector`, and holds ~1 MB of WebAssembly nobody else needs.
 *
 * In: the .wasm bytes once, then one frame at a time. Out: `{ ready }` for the
 * first, `{ codes }` for every frame. The page fetches the bytes so that the
 * request is the page's (the service worker caches it, a test can route it in
 * every engine); compiling and decoding happen here.
 *
 * `onmessage =` rather than `addEventListener`: WebKit may evaluate a worker
 * entry twice, and an assignment cannot answer twice.
 */
type Inbound = { wasm: ArrayBuffer } | { frame: ImageData }

const scope = self as unknown as DedicatedWorkerGlobalScope

scope.onmessage = async ({ data }: MessageEvent<Inbound>) => {
  if ('wasm' in data) {
    try {
      await prepareZXingModule({ overrides: { wasmBinary: data.wasm }, fireImmediately: true })
      scope.postMessage({ ready: true })
    } catch {
      scope.postMessage({ ready: false })
    }
    return
  }

  let codes: string[] = []
  try {
    const found = await readBarcodes(data.frame, {
      formats: ['EAN13', 'EAN8', 'UPCA', 'UPCE'],
      maxNumberOfSymbols: 1,
    })
    codes = found.filter((result) => result.isValid).map((result) => result.text)
  } catch {
    // A frame with nothing readable in it is the ordinary case.
  }
  scope.postMessage({ codes })
}
