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
 *
 * **One player, wherever it is asked for.** The state below is module scope,
 * not per component: the stack, a find's sheet and a shelf record's sheet all
 * offer the same button, and two players would mean two records playing at
 * once with only one of them stoppable. Whichever screen asks last gets the
 * player; the one before it is torn down (`release`), which is also what
 * happens when a sheet closes — a frame whose host element has been unmounted
 * is a frame nobody can stop.
 */

/*
 * Imported by name although Nuxt auto-imports both.
 *
 * The state below is module scope, so it is built the moment this file is
 * imported — including by the test that reads this module directly, in a plain
 * Vitest process where there is no auto-import to build it with. The same
 * reason `useMessages.ts` names its `shallowRef`.
 */
import { readonly, ref } from 'vue'

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

/** The element the frame was built into, so a screen can take back its own. */
let host: HTMLElement | null = null

/*
 * Module scope, so every screen sees the same one playing.
 *
 * These used to be per call site, which was harmless while the stack was the
 * only caller and wrong the moment a sheet offered the same button: the sheet
 * would have shown "playing" while the stack still showed "play", over a
 * single frame that only one of them could stop.
 */
const armed = ref(false)
const playing = ref<string | null>(null)
const clip = ref<string | null>(null)
const failed = ref(false)

/** Back to before the first tap: no frame, no player, nothing playing. */
function teardown() {
  try {
    player?.destroy()
  } catch {
    // The frame can already have gone with the element it lived in. Nothing to
    // stop, and a throw here would take the screen down with it.
  }
  player = null
  ready = null
  host = null
  playing.value = null
  clip.value = null
  armed.value = false
}

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
  /**
   * The first call is the gesture. Every later one only passes an id to the
   * player that is already standing.
   */
  async function play(uri: string, mount: HTMLElement, title?: string | null) {
    const id = videoId(uri)
    if (!id) return

    // Another screen asked for the player. It cannot move — an iframe reloads
    // when its parent changes — so the old one goes and this one is built.
    if (host && host !== mount) teardown()

    try {
      // The first call builds the player with this id; every later one passes
      // it to the one already standing.
      const fresh = ready === null
      armed.value = true
      host = mount
      const instance = await boot(mount, id)
      if (!fresh) instance.loadVideoById(id)
      playing.value = id
      clip.value = title?.trim() || null
      failed.value = false
    } catch {
      // A blocked Google — extension, firewall, network — is not this app's
      // failure. Every screen works completely without sound, so only the
      // button goes away.
      failed.value = true
      armed.value = false
      host = null
    }
  }

  function stop() {
    player?.stopVideo()
    playing.value = null
    clip.value = null
  }

  /**
   * Give the player back when the screen that hosts it goes away.
   *
   * A sheet closes and takes its element with it. The frame goes too, but the
   * player object does not know that: the next tap would call `loadVideoById`
   * on a frame that is no longer in the document, and nothing would play —
   * with no way to stop what was playing before, either.
   *
   * Only the host may release: a sheet closing over the stack must not silence
   * the stack behind it.
   */
  function release(mount: HTMLElement | null) {
    if (!mount || host !== mount) return
    teardown()
  }

  return {
    armed: readonly(armed),
    playing: readonly(playing),
    /** The title of the clip that is playing — YouTube's, not the record's. */
    clip: readonly(clip),
    failed: readonly(failed),
    play,
    stop,
    release,
  }
}
