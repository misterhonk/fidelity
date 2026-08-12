import type { DrainResult } from '~~/worker/outbox'

/**
 * What happened to a change after it was made.
 *
 * Every write in this app lands locally first and travels to Discogs
 * afterwards (ADR-011), which is what makes a star light up the instant it is
 * tapped. The cost of that honesty is that "it looks changed" and "Discogs
 * knows" are two different moments, and until now the screen only showed the
 * first — somebody rated a record, looked at discogs.com, and found nothing.
 *
 * So a change nudges the queue itself instead of waiting for the keeper's
 * twenty-minute clock, and says which of the three things happened:
 *
 * - **sent** — it is over there now.
 * - **queued** — no signal, or the limit is busy. It will go, and the outbox
 *   puts the old value back if it never does.
 * - **failed** — the app refused it, and nothing was changed anywhere.
 */
export type WriteState = 'idle' | 'sending' | 'sent' | 'queued' | 'failed'

export function useWriteBack() {
  const { call } = useFidelityWorker()
  const state = ref<WriteState>('idle')

  let settle: ReturnType<typeof setTimeout> | undefined

  /**
   * Runs the local change, then pushes the queue and reports.
   *
   * `change` returns false when the worker refused — a copy with no entry
   * behind it, say — and then nothing was written anywhere and nothing needs
   * sending.
   */
  async function push(change: () => Promise<boolean>): Promise<boolean> {
    clearTimeout(settle)
    state.value = 'sending'

    if (!(await change())) {
      state.value = 'failed'
      return false
    }

    let result: DrainResult = { sent: 0, givenUp: 0, waiting: 0 }
    try {
      result = await call('outbox.flush', undefined)
    } catch {
      // Unreachable is not lost: the job is in the queue and the keeper will
      // try again. Saying "queued" is the truth, "failed" would not be.
    }

    state.value = result.sent > 0 ? 'sent' : 'queued'

    // Long enough to be read, short enough not to become furniture. A failure
    // stays: it is the one state somebody has to act on.
    if (state.value === 'sent') settle = setTimeout(() => (state.value = 'idle'), 4000)
    return true
  }

  onScopeDispose(() => clearTimeout(settle))

  return { state: readonly(state), push }
}
