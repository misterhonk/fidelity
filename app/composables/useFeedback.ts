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

/**
 * The last verdict that did not survive the trip to the worker.
 *
 * Optimism is right here — the worker is mid-scan half the time this gets
 * pressed — but optimism without a rollback is just a lie told quickly. This
 * store went a whole milestone accepting verdicts that were never written,
 * because a button that lights up is indistinguishable from a button that
 * worked. Now it goes back, and something on screen says so.
 */
const failure = shallowRef<unknown>(null)

/**
 * Die vier Urteile, mit Namen aus dem Icon-Satz statt mit Emoji.
 *
 * They were 👍😐👎🛒, which renders as four colour pictures from whatever font
 * the operating system happens to ship — a different drawing on every device,
 * beside an icon set that was drawn once and deliberately. Emoji also carry no
 * weight and no stroke, so they cannot line up with anything around them.
 */
export const VERDICTS = [
  { key: 'interesting', icon: 'thumbs-up', label: 'Interessant' },
  { key: 'meh', icon: 'meh', label: 'Naja' },
  { key: 'wrong', icon: 'thumbs-down', label: 'Danebengegriffen' },
  { key: 'bought', icon: 'shopping-cart', label: 'Gekauft' },
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
    const before = verdicts.value
    failure.value = null

    // Applied before the round trip. The worker is doing a rate-limited scan
    // half the time this gets pressed, and a button that waits for it feels
    // broken even though nothing is.
    verdicts.value = Object.fromEntries(
      current === verdict
        ? Object.entries(verdicts.value).filter(([id]) => Number(id) !== match.listingId)
        : [...Object.entries(verdicts.value), [String(match.listingId), verdict]],
    )

    try {
      verdicts.value =
        current === verdict
          ? await call('feedback.clear', { listingId: match.listingId })
          : await call('feedback.set', { match: feedbackSubject(match), verdict })
    } catch (cause) {
      // Back to what was actually saved. A button that stays lit after the
      // write failed is worse than one that never lit up.
      verdicts.value = before
      failure.value = cause
    }
  }

  return { verdicts: readonly(verdicts), failure: readonly(failure), load, judge }
}
