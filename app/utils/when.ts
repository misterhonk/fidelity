import { activeLocale, useMessages } from '~/composables/useMessages'

/**
 * How long ago something was, as a fragment of a sentence.
 *
 * There were three of these, written at three different times: one that counted
 * in hours because a dig is recent, one that counted in days because a
 * shortlist is old, and one about to be written for the settings overview. They
 * disagreed at the edges — a thing four hours old was "vor 4 Stunden" on one
 * screen and "heute" on another, which reads as two different facts.
 *
 * One scale, minutes through years. It never says "today": on a screen full of
 * timestamps, a unit that silently changes meaning is worse than a coarse one.
 *
 * **The words come from `Intl`, not from the message packs.** The browser
 * already knows how to say "2 days ago" in every language it ships, including
 * the plural rules — and it knows them for languages this project has not
 * added yet. A hand-written table would be a second, worse copy of that, and
 * every new language would have to refill it.
 *
 * `numeric: 'always'`, deliberately. `'auto'` reaches for the idiomatic form
 * and overreaches: it renders one month as "last month", which is a calendar
 * month rather than a duration, and two days in German as "vorgestern" — the
 * day before yesterday, which is simply wrong for something 2.9 days old.
 * Measured, both of them, before this was written.
 *
 * The two forms where the idiom *is* right — "just now" and "yesterday" — are
 * the only ones left in the packs.
 */

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function since(at: number, now = Date.now()): string {
  const m = useMessages().value
  const elapsed = now - at
  const ago = new Intl.RelativeTimeFormat(activeLocale(), { numeric: 'always' })

  // Clock skew, or a timestamp written a moment ago on a slower device. "in 3
  // minutes" for something that has already happened would be nonsense.
  if (elapsed < MINUTE) return m.when.justNow
  if (elapsed < HOUR) return ago.format(-Math.floor(elapsed / MINUTE), 'minute')
  if (elapsed < DAY) return ago.format(-Math.floor(elapsed / HOUR), 'hour')

  const days = Math.floor(elapsed / DAY)
  if (days === 1) return m.when.yesterday
  if (days < 31) return ago.format(-days, 'day')

  const months = Math.floor(days / 30)
  if (months < 24) return ago.format(-months, 'month')

  return ago.format(-Math.floor(months / 12), 'year')
}

/** A date on its own: "11 Aug 2026" / "11. Aug. 2026". */
export function day(at: number | Date): string {
  return new Intl.DateTimeFormat(activeLocale(), { dateStyle: 'medium' }).format(at)
}

/** A date with the time of day, for things that happen more than once a day. */
export function dayTime(at: number | Date): string {
  return new Intl.DateTimeFormat(activeLocale(), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(at)
}

/** The short form, for a list where the date is a detail and not the point. */
export function shortDay(at: number | Date): string {
  return new Intl.DateTimeFormat(activeLocale(), { dateStyle: 'short' }).format(at)
}
