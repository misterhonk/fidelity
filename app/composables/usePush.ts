import type { PushRegistration } from '#shared/types'

/**
 * Being told about a shop while the app is closed.
 *
 * The watchlist already works without any of this: every watched shop is
 * checked when the app is opened, which is the most a browser can do on its
 * own. This is the part that needs somebody else awake — a hub, asking once an
 * hour for everybody — and it is therefore an addition that has to be able to
 * be absent (rule 8). `available` is false wherever it cannot work, and then
 * nothing about it is shown at all.
 *
 * Subscribing lives here rather than in the web worker because `PushManager`
 * hangs off the service worker registration, which a web worker cannot reach.
 * Everything after the subscription exists is hub talk and happens in there.
 */

export type PushState = 'unsupported' | 'no-hub' | 'off' | 'on' | 'denied' | 'needs-install'

const state = shallowRef<PushState>('unsupported')
const busy = shallowRef(false)

/**
 * base64url from the hub into the bytes `subscribe` wants.
 *
 * `applicationServerKey` takes a BufferSource, and every VAPID key in the
 * world travels as base64url. Browsers accept the string in some versions and
 * refuse it in others; the bytes work everywhere.
 */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), '='))
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let index = 0; index < raw.length; index++) bytes[index] = raw.charCodeAt(index)
  return bytes
}

/** The subscription as it travels: `toJSON()`, checked rather than assumed. */
function asRegistration(subscription: PushSubscription): PushRegistration | null {
  const json = subscription.toJSON() as {
    endpoint?: string
    keys?: { p256dh?: string; auth?: string }
  }
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return null
  return { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } }
}

/**
 * iOS gives an installed app push, and a Safari tab nothing.
 *
 * Detected by what is missing rather than by sniffing the browser: if the API
 * is there, it works; if it is absent on a device that has a home screen, the
 * honest answer is "install it first" and not a switch that does nothing.
 */
function needsInstall(): boolean {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  return !standalone && /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export function usePush() {
  const { call } = useFidelityWorker()

  /** What this device can do, and what it is currently doing. */
  async function refresh() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      state.value = needsInstall() ? 'needs-install' : 'unsupported'
      return
    }
    if (Notification.permission === 'denied') {
      state.value = 'denied'
      return
    }

    // Asked before anything is offered: without a hub there is nothing to
    // subscribe to, and a switch for it would be a promise nobody keeps.
    const key = await call('watch.pushKey', undefined)
    if (!key) {
      state.value = 'no-hub'
      return
    }

    const registration = await navigator.serviceWorker.ready
    state.value = (await registration.pushManager.getSubscription()) ? 'on' : 'off'
  }

  /**
   * Ask, subscribe, register — in that order, and only from a click.
   *
   * The permission prompt is spent once: a browser that was refused does not
   * ask again, and a prompt somebody did not expect is refused reflexively.
   * So this is never called on load, only from the moment it makes sense —
   * somebody deciding to watch a shop.
   */
  async function enable(): Promise<boolean> {
    if (busy.value) return false
    busy.value = true

    try {
      const key = await call('watch.pushKey', undefined)
      if (!key) {
        state.value = 'no-hub'
        return false
      }

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        state.value = permission === 'denied' ? 'denied' : 'off'
        return false
      }

      const registration = await navigator.serviceWorker.ready
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          // Required, and true in the honest sense: every push this app
          // receives becomes a notification (app/sw/sw.ts).
          userVisibleOnly: true,
          applicationServerKey: keyBytes(key),
        }))

      const wire = asRegistration(subscription)
      if (!wire) {
        state.value = 'off'
        return false
      }

      const registered = await call('watch.pushOn', { registration: wire })
      state.value = registered ? 'on' : 'off'
      return registered
    } catch {
      // A push service that will not answer, a key the browser rejects, a
      // permission dialog dismissed by the operating system. None of it is
      // worth an error screen for a feature that is an addition.
      state.value = 'off'
      return false
    } finally {
      busy.value = false
    }
  }

  /** Off means off on this device — the browser subscription goes too. */
  async function disable() {
    busy.value = true
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      await subscription?.unsubscribe()
      await call('watch.pushOff', undefined)
      state.value = 'off'
    } catch {
      state.value = 'off'
    } finally {
      busy.value = false
    }
  }

  /**
   * The language the notifications should speak.
   *
   * The choice lives in `localStorage`, which a service worker cannot read, so
   * it is handed over instead — on every start and on every change, because a
   * worker that was never told would have to guess.
   */
  async function tellLanguage(code: string) {
    if (!('serviceWorker' in navigator)) return
    try {
      const registration = await navigator.serviceWorker.ready
      registration.active?.postMessage({ type: 'LANGUAGE', language: code })
    } catch {
      // Nothing here is worth a word on screen: the worker falls back to
      // English, which is the base language anyway (ADR-010).
    }
  }

  return {
    state: readonly(state),
    busy: readonly(busy),
    refresh,
    enable,
    disable,
    tellLanguage,
  }
}
