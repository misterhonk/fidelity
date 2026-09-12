/**
 * When a waiting service worker may take over on its own (docs/17 §8.4, M24).
 *
 * "A new version is ready — Reload" is a banner somebody has to understand.
 * The quiet answer: the moment the app is between two screens and nothing
 * is running that a reload would throw away, the new version simply loads.
 * A dig is the one thing worth protecting — four minutes of somebody's rate
 * limit — so while one runs the update waits; and if it has waited longer
 * than the patience below, the banner is back, because then the person
 * should decide.
 */
export const UPDATE_PATIENCE_MS = 15 * 60 * 1000

export interface UpdateSituation {
  needRefresh: boolean
  /** Whether the worker is scanning a shop right now. */
  digRunning: boolean
  /** When the new version was first seen waiting, or null. */
  waitingSince: number | null
  now: number
}

export type UpdateStep = 'nothing' | 'apply' | 'wait' | 'ask'

export function updateStep({
  needRefresh,
  digRunning,
  waitingSince,
  now,
}: UpdateSituation): UpdateStep {
  if (!needRefresh) return 'nothing'
  if (!digRunning) return 'apply'
  if (waitingSince !== null && now - waitingSince > UPDATE_PATIENCE_MS) return 'ask'
  return 'wait'
}
