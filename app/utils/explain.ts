import type { WorkerError } from '#shared/protocol'

import { useMessages } from '~/composables/useMessages'

/**
 * Turning a failure into something worth reading (docs/06 M8).
 *
 * There are exactly four ways this app fails in practice, and every one of
 * them has an answer the user can act on. Showing the raw message instead —
 * "HTTP 429", "QuotaExceededError" — is technically true and practically
 * useless, and it is the difference between an app that seems broken and one
 * that seems honest.
 *
 * Where there is nothing useful to add, the original message is kept. Wrapping
 * an unknown error in a friendly sentence hides the one clue somebody has.
 */

export interface Explained {
  /** One line, in the app's voice. */
  title: string
  /** What to do about it, or null when there is nothing to do. */
  action: string | null
  /** The raw message, kept so a real bug is still diagnosable. */
  detail: string | null
}

const STORAGE_NAMES = /quota|storage|QuotaExceeded|NS_ERROR_DOM_QUOTA/i

export interface ExplainContext {
  /**
   * Whether there was a working session before this failure.
   *
   * Only the 401 needs it, and it needs it badly: the same status means "your
   * token was revoked" to somebody who has been using the app for weeks and
   * "that is not a token" to somebody pasting one for the first time. The
   * original wording guessed the first, so a newcomer's typo was answered with
   * a theory about a withdrawal that never happened.
   *
   * Defaults to true because everywhere except the setup screen, there was.
   */
  signedIn?: boolean
}

export function explain(cause: unknown, context: ExplainContext = {}): Explained {
  const message = cause instanceof Error ? cause.message : String(cause ?? '')
  const code = (cause as { code?: WorkerError['code'] } | null)?.code
  const signedIn = context.signedIn ?? true

  /*
   * Read per call, not held in a constant. `explain()` runs inside a computed
   * in `ErrorNote`, so this is a dependency and the message follows a language
   * switch — an error already on screen changes with everything else.
   */
  const words = useMessages().value.error

  // 1. The token is gone or was revoked. The only failure that logs you out.
  if (code === 'unauthorized') {
    return { ...(signedIn ? words.tokenRevoked : words.tokenUnknown), detail: message }
  }

  // 2. Rate limited. Waiting is the whole fix, and the number matters.
  if (code === 'rate-limited') {
    return { ...words.rateLimited, detail: message }
  }

  // 3. No network. Everything already on the device still works.
  if (code === 'offline' || /failed to fetch|networkerror|load failed/i.test(message)) {
    return { ...words.offline, detail: message }
  }

  // 4. The disk is full. The one failure where deleting is the answer.
  if (STORAGE_NAMES.test(message)) {
    return { ...words.storageFull, detail: message }
  }

  // Anything else keeps its own words. A friendly wrapper here would hide the
  // only clue there is.
  return { title: message || words.unknown, action: null, detail: null }
}
