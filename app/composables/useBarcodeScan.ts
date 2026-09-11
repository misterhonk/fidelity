/**
 * Einen Barcode mit der Kamera lesen (M13, Stufe 1).
 *
 * **Nur wo der Browser es selbst kann.** `BarcodeDetector` ist in Chromium da
 * (am 2026-09-11 gemessen, `ean_13` dabei) und in WebKit nicht — also auf dem
 * iPhone nicht, dem schwächsten Ziel dieses Projekts (CLAUDE.md).
 *
 * Die Alternative wäre ein Decoder in JavaScript. Der wiegt über hundert
 * Kilobyte, und Regel 7 verlangt, dass jede Abhängigkeit ihren Platz
 * rechtfertigt. Deshalb hier: **nichts dazugeladen.** Wo der Browser nicht
 * mitspielt, tippt man die Ziffern — das Feld dafür steht ohnehin daneben, es
 * kostet kein Byte und funktioniert überall.
 *
 * Das ist keine halbe Lösung, sondern die ehrliche: ein Bildschirm, der auf
 * einem iPhone eine Kamera anbietet, die dort nichts lesen kann, wäre
 * schlimmer als einer, der sagt, dass hier getippt wird.
 */

interface Detector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>
}

/** Was auf einer Platte steht. QR und die Frachtformate haben hier nichts zu suchen. */
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
   * Läuft, bis etwas gelesen wurde oder jemand aufhört.
   *
   * Alle 400 ms ein Blick: schneller bringt nichts, weil eine Hand das Bild
   * ohnehin nicht schneller ruhig hält, und es kostet Akku in einem Laden, in
   * dem man vielleicht noch eine Stunde steht.
   */
  async function start(video: HTMLVideoElement, onFound: (code: string) => void) {
    if (!barcodeSupported()) {
      failure.value = 'no-camera'
      return
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        // Die rückwärtige Kamera, sonst filmt ein Telefon das eigene Gesicht.
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
        // Ein Einzelbild, aus dem nichts zu lesen ist, ist der Normalfall und
        // kein Fehler. Der nächste Blick kommt in 400 ms.
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

  // Eine Kamera, die weiterläuft, weil jemand den Bildschirm gewechselt hat,
  // ist ein leuchtendes Lämpchen und ein leerer Akku.
  onBeforeUnmount(stop)

  return { running: readonly(running), failure: readonly(failure), start, stop }
}
