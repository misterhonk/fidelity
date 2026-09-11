/**
 * Reading a barcode with the camera (M13, stage 1).
 *
 * **Only where the browser can do it itself.** `BarcodeDetector` is there in
 * Chromium (measured 2026-09-11, `ean_13` included) and not in WebKit — so not
 * on the iPhone, this project's weakest target (CLAUDE.md).
 *
 * The alternative would be a decoder in JavaScript. That weighs over a hundred
 * kilobytes, and rule 7 demands that every dependency justify its place. So:
 * **nothing loaded in.** Where the browser does not play along, you type the
 * digits — the field for that is beside it anyway, it costs no bytes and works
 * everywhere.
 *
 * That is not half a solution but the honest one: a screen offering an iPhone
 * a camera that can read nothing there would be worse than one saying you type
 * here.
 */

interface Detector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>
}

/** What is on a record. QR and the freight formats have no business here. */
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'] as const

export function barcodeSupported(): boolean {
  return typeof globalThis !== 'undefined' && 'BarcodeDetector' in globalThis
}

export function useBarcodeScan() {
  const running = ref(false)
  const failure = ref<'no-camera' | 'denied' | null>(null)

  let stream: MediaStream | null = null
  let timer: number | null = null

  /**
   * Runs until something is read or somebody stops.
   *
   * A look every 400 ms: faster gains nothing, because a hand does not hold
   * the picture still any faster anyway, and it costs battery in a shop where
   * somebody may be standing for another hour.
   */
  async function start(video: HTMLVideoElement, onFound: (code: string) => void) {
    if (!barcodeSupported()) {
      failure.value = 'no-camera'
      return
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        // The rear camera, or a phone films its owner's face.
        video: { facingMode: 'environment' },
      })
    } catch {
      failure.value = 'denied'
      return
    }

    video.srcObject = stream
    await video.play().catch(() => {})

    const Detector = (
      globalThis as unknown as { BarcodeDetector: new (o: unknown) => Detector }
    ).BarcodeDetector
    const detector = new Detector({ formats: FORMATS })
    running.value = true
    failure.value = null

    const look = async () => {
      if (!running.value) return
      try {
        const found = await detector.detect(video)
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
    running.value = false
    if (timer !== null) self.clearTimeout(timer)
    timer = null
    stream?.getTracks().forEach((track) => track.stop())
    stream = null
  }

  // A camera left running because somebody changed screen is a glowing light
  // and a flat battery.
  onBeforeUnmount(stop)

  return { running: readonly(running), failure: readonly(failure), start, stop }
}
