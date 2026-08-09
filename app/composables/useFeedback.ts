import type { FeedbackSubject } from '#shared/protocol'
import type { Verdict } from '#shared/types'

/**
 * The verdicts, shared by every card on the page.
 *
 * One map for the whole app rather than per-card state: the same listing can
 * appear in the shortlist and in the full list below it, and two buttons for
 * one record that disagree about whether it was judged would be a bug the user
 * sees immediately.
 */
const verdicts = shallowRef<Record<number, Verdict>>({})
let loaded = false

export const VERDICTS = [
  { key: 'interesting', icon: '👍', label: 'Interessant' },
  { key: 'meh', icon: '😐', label: 'Naja' },
  { key: 'wrong', icon: '👎', label: 'Danebengegriffen' },
  { key: 'bought', icon: '🛒', label: 'Gekauft' },
] as const satisfies readonly { key: Verdict; icon: string; label: string }[]

export function useFeedback() {
  const { call } = useFidelityWorker()

  async function load() {
    if (loaded) return
    loaded = true
    verdicts.value = await call('feedback.verdicts', undefined)
  }

  /**
   * Judging the same way twice takes the verdict back, which is the only
   * behaviour that makes a four-way toggle forgiving: a misclick is undone by
   * repeating it, and no separate "clear" button has to exist.
   */
  async function judge(match: FeedbackSubject, verdict: Verdict) {
    const current = verdicts.value[match.listingId]

    // Applied before the round trip. The worker is doing a rate-limited scan
    // half the time this gets pressed, and a button that waits for it feels
    // broken even though nothing is.
    verdicts.value = Object.fromEntries(
      current === verdict
        ? Object.entries(verdicts.value).filter(([id]) => Number(id) !== match.listingId)
        : [...Object.entries(verdicts.value), [String(match.listingId), verdict]],
    )

    verdicts.value =
      current === verdict
        ? await call('feedback.clear', { listingId: match.listingId })
        : await call('feedback.set', { match: feedbackSubject(match), verdict })
  }

  return { verdicts: readonly(verdicts), load, judge }
}
