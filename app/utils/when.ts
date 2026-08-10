/**
 * Wie lange etwas her ist, in einem Satzteil.
 *
 * There were three of these, written at three different times: one that
 * counted in hours because a dig is recent, one that counted in days because a
 * shortlist is old, and one about to be written for the settings overview. They
 * disagreed at the edges — a thing four hours old was "vor 4 Stunden" on one
 * screen and "heute" on another, which reads as two different facts.
 *
 * One scale, hours through years. It never says "heute": on a screen full of
 * timestamps, a unit that silently changes meaning is worse than a coarse one.
 */

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** German plurals, only where the two forms actually differ. */
function count(value: number, one: string, many: string): string {
  return `vor ${value} ${value === 1 ? one : many}`
}

export function since(at: number, now = Date.now()): string {
  const elapsed = now - at

  // Clock skew, or a timestamp written a moment ago on a slower device. "in
  // 3 Minuten" would be nonsense for something that has already happened.
  if (elapsed < MINUTE) return 'gerade eben'
  if (elapsed < HOUR) return count(Math.floor(elapsed / MINUTE), 'Minute', 'Minuten')
  if (elapsed < DAY) return count(Math.floor(elapsed / HOUR), 'Stunde', 'Stunden')

  const days = Math.floor(elapsed / DAY)
  if (days === 1) return 'gestern'
  if (days < 31) return `vor ${days} Tagen`

  const months = Math.floor(days / 30)
  if (months < 24) return count(months, 'Monat', 'Monaten')

  return count(Math.floor(months / 12), 'Jahr', 'Jahren')
}
