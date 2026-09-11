/**
 * Die Hörprobe — und die Zusage, die sie erst vertretbar macht (ADR-012).
 *
 * Discogs' einzige Tonquelle ist YouTube. Ein eingebetteter Spieler lädt
 * Google, und die Datenschutzseite verspricht, dass Daten dieses Gerät nicht
 * verlassen. Was tatsächlich abfließt, ist nicht die Sammlung, sondern die IP
 * und welche Platte gerade angesehen wird — weniger als befürchtet, mehr als
 * null. Also: Ausnahme mit Bedingungen, nicht stilles Dehnen.
 *
 * **Die schärfste davon steht in diesem Modul: vor dem ersten bewussten
 * Tippen geht kein Byte an Google.** Kein Skript, kein Rahmen, keine Anfrage
 * — auch dann nicht, wenn der Schalter längst umgelegt ist. Wer den Stapel
 * durchwischt, ohne Ton zu wollen, hat Google nie gesehen.
 *
 * Dieselbe Geste löst nebenbei das einzige technische Problem: Browser
 * verlangen für Ton eine Nutzergeste. **Ein Autoplay auf Karte eins gibt es in
 * keinem Browser**, und keine Zeile Code ändert das. Nach dem ersten Tippen
 * bleibt eine Player-Instanz stehen und bekommt je Karte ein
 * `loadVideoById()` — die eine Geste trägt durch den Stapel.
 */

/** Privacy-enhanced mode: keine Cookies vor dem Abspielen. Die Anfrage selbst
 *  sieht Google trotzdem, und das steht auch so auf der Datenschutzseite. */
const ORIGIN = 'https://www.youtube-nocookie.com'
const API = 'https://www.youtube.com/iframe_api'

/**
 * Die Video-Kennung aus einer Discogs-Adresse.
 *
 * Discogs speichert, was Leute eingetragen haben — mal `watch?v=`, mal
 * `youtu.be/`. Was nicht passt, gibt `null` und der Knopf bleibt weg; eine
 * Adresse zu erraten wäre schlimmer als keine Hörprobe.
 */
export function videoId(uri: string): string | null {
  try {
    const url = new URL(uri)
    if (url.hostname === 'youtu.be') return url.pathname.slice(1) || null
    if (!/(^|\.)youtube(-nocookie)?\.com$/.test(url.hostname)) return null
    return url.searchParams.get('v') || url.pathname.split('/').pop() || null
  } catch {
    return null
  }
}

interface Player {
  loadVideoById(id: string): void
  stopVideo(): void
  destroy(): void
}

let player: Player | null = null
let ready: Promise<Player> | null = null

/**
 * Erst hier fällt die Entscheidung, Google überhaupt anzusprechen.
 *
 * Der Spieler wird **mit** der ersten Kennung und `autoplay` gebaut, nicht
 * leer und dann befüllt. Am 2026-09-11 gemessen: ein nachträgliches
 * `loadVideoById()` auf einem frisch erzeugten Spieler landet in Zustand 5
 * („vorgemerkt") und spielt nicht — die Nutzergeste zählt für den Rahmen, der
 * beim Tippen noch gar nicht existierte. Ab der zweiten Karte trägt sie dann,
 * weil der Spieler steht.
 */
function boot(mount: HTMLElement, first: string): Promise<Player> {
  if (ready) return ready

  ready = new Promise<Player>((resolve, reject) => {
    const global = window as unknown as {
      YT?: { Player: new (el: HTMLElement, options: unknown) => Player }
      onYouTubeIframeAPIReady?: () => void
    }

    const build = () => {
      const YT = global.YT
      if (!YT) {
        reject(new Error('youtube api missing'))
        return
      }
      const made = new YT.Player(mount, {
        host: ORIGIN,
        videoId: first,
        /*
         * Sichtbar, und zwar aus zwei Gründen.
         *
         * YouTubes Bedingungen verlangen, dass der eingebettete Spieler zu
         * sehen ist — ein versteckter Player ist kein Randfall der Regeln,
         * sondern ihr Bruch. Und praktisch: ein 0 × 0 großer Spieler startet
         * gar nicht erst (2026-09-11 gemessen, Zustand 5).
         *
         * Die Größe setzt die Seite per CSS; hier steht nur, dass er sich
         * seinen Platz nimmt.
         */
        height: '100%',
        width: '100%',
        playerVars: { playsinline: 1, autoplay: 1, origin: location.origin },
        events: { onReady: () => resolve(made) },
      })
      player = made
    }

    if (global.YT?.Player) {
      build()
      return
    }

    global.onYouTubeIframeAPIReady = build
    const script = document.createElement('script')
    script.src = API
    script.async = true
    script.onerror = () => reject(new Error('youtube api blocked'))
    document.head.append(script)
  })

  return ready
}

export function useAudioPreview() {
  /** Ob überhaupt schon einmal getippt wurde — davor existiert nichts. */
  const armed = ref(false)
  const playing = ref<string | null>(null)
  const failed = ref(false)

  /**
   * Der erste Aufruf ist die Geste. Jeder weitere reicht nur eine Kennung
   * an den Spieler durch, der schon steht.
   */
  async function play(uri: string, mount: HTMLElement) {
    const id = videoId(uri)
    if (!id) return

    try {
      // Der erste Aufruf baut den Spieler mit dieser Kennung; jeder weitere
      // reicht sie an den durch, der schon steht.
      const frisch = ready === null
      armed.value = true
      const instance = await boot(mount, id)
      if (!frisch) instance.loadVideoById(id)
      playing.value = id
      failed.value = false
    } catch {
      // Ein blockiertes Google — Erweiterung, Firewall, Netz — ist kein
      // Fehler dieser App. Der Stapel funktioniert ohne Ton vollständig, also
      // verschwindet nur der Knopf.
      failed.value = true
      armed.value = false
    }
  }

  function stop() {
    player?.stopVideo()
    playing.value = null
  }

  return {
    armed: readonly(armed),
    playing: readonly(playing),
    failed: readonly(failed),
    play,
    stop,
  }
}
