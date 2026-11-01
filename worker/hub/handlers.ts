import { fail } from '../fail'
import type { HandlerMap } from '../handlers'
import { registerSecret } from '../log'
import { onThisMachine } from '../loopback'

/**
 * Finding and checking a hub, out of the worker's entry chunk (#299): both run
 * from the settings screen only, never on the way to a dig.
 */
export const handlers = {
  'hub.discover': async () => {
    /*
     * Here first, then on this machine.
     *
     * `/hub` on the app's own domain is where `.github/workflows/hub.yml` puts
     * one, and same origin is the only arrangement that cannot fail for a
     * reason outside the hub itself: no CORS, no mixed content, no second
     * certificate — and it is the only one that still works on a phone that
     * is nowhere near the machine at home.
     *
     * The bare origin comes second, for a hub sitting at the root of a domain
     * whose app lives under a path.
     *
     * A static host answers an unknown path with the app's own HTML and a 200.
     * That is not a special case here: `response.json()` throws on it, and a
     * throw means "not this one" like any other.
     *
     * Then localhost, only when the app runs there itself (worker/loopback.ts),
     * and in both spellings — a hub bound to 127.0.0.1 does not
     * answer to `localhost` on a machine where that resolves to ::1 first, and
     * the failure looks identical to "there is no hub".
     */
    const here = self.location?.origin
    const tried = [
      ...(here ? [`${here}/hub`, here] : []),
      ...(onThisMachine() ? ['http://localhost:8787', 'http://127.0.0.1:8787'] : []),
    ]

    /*
     * Predicted, not detected.
     *
     * A blocked request and a refused connection are the same TypeError to
     * JavaScript. But the block is knowable in advance: an https page asking
     * for http is mixed content, which WebKit refuses outright (measured
     * 2026-08-10). Saying so is the difference between "run the hub over
     * https" and a fruitless hunt for a service that is running fine.
     */
    const blockedByMixedContent = self.location?.protocol === 'https:'

    for (const base of tried) {
      try {
        const response = await fetch(`${base}/v1/health`, {
          // Short: a machine that is not listening refuses instantly, and the
          // only thing a longer wait buys is a longer wait.
          signal: AbortSignal.timeout(1500),
        })
        if (!response.ok) continue
        const body = (await response.json()) as { ok?: boolean; secured?: boolean }
        if (body.ok === true) {
          return {
            url: base,
            // Assumed secured when the hub does not say: an unsecured guess
            // would have the app save an address it cannot use, and then fail
            // silently forever (rule 8).
            secured: body.secured !== false,
            blockedByMixedContent: false,
            tried,
          }
        }
      } catch {
        // Refused, blocked or too slow — all three mean "not this one".
      }
    }

    return { url: null, secured: false, blockedByMixedContent, tried }
  },

  'hub.check': async ({ url, secret, accessKey }) => {
    registerSecret(secret)
    registerSecret(accessKey)
    const base = url.trim().replace(/\/+$/, '')
    if (!base) throw fail('no-hub', 'hub: no url given')

    // Deliberately a plain fetch rather than the hub client: this is the one
    // place a failure has to be *reported* instead of swallowed.
    let response: Response
    try {
      response = await fetch(`${base}/v1/health`, {
        headers: secret ? { 'x-hub-secret': secret } : {},
        signal: AbortSignal.timeout(5000),
      })
    } catch {
      /*
       * "Failed to fetch" is not an answer.
       *
       * That string is what the browser says and it reached the screen
       * untouched. It covers four different situations and names none of them,
       * so the sentence below names the ones somebody can actually act on —
       * including the mixed-content case, which is not a fault in the hub at
       * all and which every iPhone hits (measured 2026-08-10).
       */
      const mixed = self.location?.protocol === 'https:' && base.startsWith('http://')
      // A code, not a sentence: `HubSettings` writes the words, in whatever
      // language the person reading them has chosen.
      throw mixed
        ? fail('hub-mixed-content', 'hub: mixed content')
        : fail('hub-unreachable', 'hub: no answer')
    }
    if (!response.ok) {
      throw Object.assign(fail('hub-http-error', `hub: HTTP ${response.status}`), {
        status: response.status,
      })
    }

    const body = (await response.json()) as {
      ok?: boolean
      horizon?: number
      shipping?: number
      secured?: boolean
      doors?: ('secret' | 'key')[]
    }
    if (body.ok !== true) throw fail('not-a-hub', 'not a fidelity hub')
    const doors = Array.isArray(body.doors) ? body.doors : []

    /*
     * The secret, tried at a door that is actually locked.
     *
     * Health is open on purpose so a monitor needs no word — which means it
     * answers "reachable" to a wrong word just the same. On 2026-09-12 a phone
     * showed "reachable · secured with a secret" while every horizon request
     * it made came back 401. So the check knocks once more where the secret
     * matters: the push key route answers 200 to the right word and 401 to a
     * wrong one. (It was the cover route until the hub dropped covers, #206.)
     */
    let secretState: 'ok' | 'wrong' | 'missing' | 'unchecked' = 'unchecked'
    if (body.secured) {
      if (!secret) {
        secretState = 'missing'
      } else {
        try {
          const door = await fetch(`${base}/v1/watch/key`, {
            headers: { 'x-hub-secret': secret },
            signal: AbortSignal.timeout(5000),
          })
          secretState = door.status === 401 ? 'wrong' : door.ok ? 'ok' : 'unchecked'
        } catch {
          secretState = 'unchecked'
        }
      }
    }

    // And the key, at the same door, when the hub has that door (M22).
    let keyState: 'ok' | 'wrong' | 'missing' | 'unchecked' = 'unchecked'
    if (doors.includes('key')) {
      if (!accessKey) {
        keyState = 'missing'
      } else {
        try {
          const door = await fetch(`${base}/v1/watch/key`, {
            headers: { 'x-fidelity-key': accessKey },
            signal: AbortSignal.timeout(5000),
          })
          keyState = door.status === 401 ? 'wrong' : door.ok ? 'ok' : 'unchecked'
        } catch {
          keyState = 'unchecked'
        }
      }
    }

    return {
      ok: true,
      secret: secretState,
      key: keyState,
      doors,
      horizon: body.horizon ?? 0,
      shipping: body.shipping ?? 0,
      secured: body.secured ?? false,
    }
  },
} satisfies Pick<HandlerMap, 'hub.discover' | 'hub.check'>
