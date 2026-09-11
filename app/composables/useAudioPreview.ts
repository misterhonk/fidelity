/**
 * The audio preview — and the promise that makes it defensible (ADR-012).
 *
 * Discogs' one source of sound is YouTube. An embedded player loads Google,
 * and the privacy page promises that data does not leave this device. What
 * actually flows out is not the collection but the IP address and which record
 * is being looked at — less than feared, more than nothing. So: an exception
 * with conditions, not a silent stretch.
 *
 * **The sharpest of them lives in this module: before the first deliberate
 * tap, no byte goes to Google.** No script, no frame, no request — not even
 * when the switch has long been thrown. Anyone swiping through the stack
 * without wanting sound has never seen Google.
 *
 * The same gesture incidentally solves the one technical problem: browsers
 * require a user gesture for sound. **Autoplay on card one exists in no
 * browser**, and no line of code changes that. After the first tap one player
 * instance stays standing and gets a `loadVideoById()` per card — the one
 * gesture carries through the stack.
 */

/** Privacy-enhanced mode: no cookies before playing. Google still sees the
 *  request itself, and the privacy page says so. */
const ORIGIN = 'https://www.youtube-nocookie.com'
const API = 'https://www.youtube.com/iframe_api'

/**
 * The video id out of a Discogs address.
 *
 * Discogs stores what people have entered — sometimes `watch?v=`, sometimes
 * `youtu.be/`. Anything that does not fit gives `null` and the button stays
 * away; guessing an address would be worse than no preview.
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
 * Only here is the decision made to speak to Google at all.
 *
 * The player is built **with** the first id and `autoplay`, not empty and then
 * filled. Measured 2026-09-11: a later `loadVideoById()` on a freshly created
 * player lands in state 5 ("cued") and does not play — the user gesture counts
 * for the frame, which did not yet exist at the moment of the tap. From the
 * second card on it carries, because the player is standing.
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
         * Visible, and for two reasons.
         *
         * YouTube's terms require the embedded player to be seen — a hidden
         * player is not an edge case of the rules but a breach of them. And
         * practically: a 0 × 0 player does not start at all (measured
         * 2026-09-11, state 5).
         *
         * The page sets the size in CSS; all this says is that it takes up its
         * space.
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
  /** Whether anybody has ever tapped — before that, nothing exists. */
  const armed = ref(false)
  const playing = ref<string | null>(null)
  const failed = ref(false)

  /**
   * The first call is the gesture. Every later one only passes an id to the
   * player that is already standing.
   */
  async function play(uri: string, mount: HTMLElement) {
    const id = videoId(uri)
    if (!id) return

    try {
      // The first call builds the player with this id; every later one passes
      // it to the one already standing.
      const fresh = ready === null
      armed.value = true
      const instance = await boot(mount, id)
      if (!fresh) instance.loadVideoById(id)
      playing.value = id
      failed.value = false
    } catch {
      // A blocked Google — extension, firewall, network — is not this app's
      // failure. The stack works completely without sound, so only the button
      // goes away.
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
