/**
 * The last tenth a job has passed — what a screen reader is told (#216).
 *
 * A counter that moves with every page is read out every 1.2 s; this moves
 * ten times in a whole run.
 */
export function milestone(percent: number): number {
  return Math.min(100, Math.max(0, Math.floor(percent / 10) * 10))
}
