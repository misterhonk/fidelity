import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader'
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'

import type { Detector } from '../useBarcodeScan'

/**
 * The barcode reader for browsers without `BarcodeDetector` (ADR-018, #301).
 *
 * Only ever reached through `import()` in `useBarcodeScan.start()`. A static
 * import of this file would put ~415 kB in front of every visitor, and
 * `.size-limit.js` fails the build if this chunk shows up in the first paint.
 *
 * The `.wasm` is served from `/_nuxt/` beside this chunk. zxing-wasm would
 * otherwise fetch it from jsDelivr, which `connect-src` refuses and rule 1
 * would not want anyway.
 */
export async function zxingDetector(): Promise<Detector> {
  // Rejects when the .wasm cannot be fetched or compiled; the caller falls back.
  await prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) =>
        path.endsWith('.wasm') ? wasmUrl : prefix + path,
    },
    fireImmediately: true,
  })

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { willReadFrequently: true })

  return {
    async detect(video) {
      const { videoWidth: width, videoHeight: height } = video
      if (!context || !width || !height) return []
      canvas.width = width
      canvas.height = height
      context.drawImage(video, 0, 0)
      const found = await readBarcodes(context.getImageData(0, 0, width, height), {
        formats: ['EAN13', 'EAN8', 'UPCA', 'UPCE'],
        maxNumberOfSymbols: 1,
      })
      return found
        .filter((result) => result.isValid)
        .map((result) => ({ rawValue: result.text }))
    },
  }
}
