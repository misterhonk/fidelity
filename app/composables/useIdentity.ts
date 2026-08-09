import type { Identity } from '#shared/types'

/**
 * Who is signed in, shared by the navigation and every page.
 *
 * App-wide because the header has to know before any page renders: a nav bar
 * that appears a beat after the content, or shows links to screens that cannot
 * work yet, is worse than no nav bar.
 */
const identity = shallowRef<Identity | null>(null)
const ready = ref(false)
let loading: Promise<void> | null = null

export function useIdentity() {
  const { call } = useFidelityWorker()

  /** Idempotent: several components ask on the same load, one request happens. */
  async function load() {
    loading ??= (async () => {
      try {
        identity.value = await call('auth.identity', undefined)
      } finally {
        ready.value = true
      }
    })()
    return loading
  }

  function set(next: Identity | null) {
    identity.value = next
    ready.value = true
  }

  async function signOut() {
    await call('auth.signOut', undefined)
    set(null)
  }

  return { identity: readonly(identity), ready: readonly(ready), load, set, signOut }
}
