import { onScopeDispose, readonly, ref } from 'vue'

/**
 * Reading a barcode with the camera (M13, stage 1; ADR-018).
 *
 * `BarcodeDetector` is there in Chromium (measured 2026-09-11, `ean_13`
 * included) and not in WebKit — so not on the iPhone, this project's weakest
 * target (CLAUDE.md).
 *
 * Where it is missing, a zxing-wasm reader stands in with the same `detect()`
 * shape (ADR-018, #301). It weighs about 415 kB gzip, so it is a dynamic
 * `import()` inside `start()`: fetched on the tap, never prefetched, never in
 * the first paint, and never at all where the browser can read by itself.
 * Should it not load — offline on first use, or blocked — the screen goes
 * back to the field and the Scan Text hint (`failure: 'unavailable'`).
 */

export interface Detector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>
}

/** What is on a record. QR and the freight formats have no business here. */
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'] as const

export function barcodeSupported(): boolean {
  return typeof globalThis !== 'undefined' && 'BarcodeDetector' in globalThis
}

/** A camera to point: with one, either reader can do the rest. */
export function cameraSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
}

async function detector(): Promise<Detector | null> {
  if (barcodeSupported()) {
    const Native = (globalThis as unknown as { BarcodeDetector: new (o: unknown) => Detector })
      .BarcodeDetector
    return new Native({ formats: FORMATS })
  }
  try {
    return await (await import('./scan/zxing')).zxingDetector()
  } catch {
    return null
  }
}

export function useBarcodeScan() {
  const running = ref(false)
  const failure = ref<'no-camera' | 'denied' | 'unavailable' | null>(null)

  let stream: MediaStream | null = null
  let timer: number | null = null
  // Bumped by stop(): a start still waiting for the decoder or the camera must
  // not go on after somebody has already said stop.
  let session = 0

  /**
   * Runs until something is read or somebody stops.
   *
   * A look every 400 ms: faster gains nothing, because a hand does not hold
   * the picture still any faster anyway, and it costs battery in a shop where
   * somebody may be standing for another hour.
   */
  async function start(video: HTMLVideoElement, onFound: (code: string) => void) {
    if (!cameraSupported()) {
      failure.value = 'no-camera'
      return
    }

    const mine = ++session
    // The decoder first: without one, a camera would show a picture and read nothing.
    const reader = await detector()
    if (mine !== session) return
    if (!reader) {
      failure.value = 'unavailable'
      return
    }

    let opened: MediaStream
    try {
      opened = await navigator.mediaDevices.getUserMedia({
        // The rear camera, or a phone films its owner's face.
        video: { facingMode: 'environment' },
      })
    } catch {
      failure.value = 'denied'
      return
    }
    if (mine !== session) {
      opened.getTracks().forEach((track) => track.stop())
      return
    }
    stream = opened

    video.srcObject = stream
    await video.play().catch(() => {})

    running.value = true
    failure.value = null

    const look = async () => {
      if (!running.value) return
      try {
        const found = await reader.detect(video)
        const code = found[0]?.rawValue
        if (code) {
          stop()
          onFound(code)
          return
        }
      } catch {
        // A frame with nothing readable in it is the ordinary case, not an
        // error. The next look comes in 400 ms.
      }
      timer = self.setTimeout(look, 400)
    }
    void look()
  }

  function stop() {
    session++
    running.value = false
    if (timer !== null) self.clearTimeout(timer)
    timer = null
    stream?.getTracks().forEach((track) => track.stop())
    stream = null
  }

  // A camera left running because somebody changed screen is a glowing light
  // and a flat battery.
  onScopeDispose(stop)

  return { running: readonly(running), failure: readonly(failure), start, stop }
}
