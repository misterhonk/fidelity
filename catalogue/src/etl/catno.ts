/**
 * "BLP 4058" → { prefix: "BLP", num: 4058 }.
 *
 * The same function as `parseCatno` in `worker/horizon/pack.ts`, character for
 * character, and a test in the root suite (`tests/unit/catalogue-twins.spec.ts`)
 * holds the two together on the fixture's catalogue numbers. Copied rather than
 * imported because this package runs on bare Node with type stripping, where
 * the app's `#shared` alias does not exist — and because a label run computed
 * here and one computed in the browser must never disagree on a single number,
 * which a shared test guarantees better than a shared import would.
 */
export function parseCatno(catno: string | undefined): { prefix: string; num: number } | null {
  if (!catno) return null
  // Prefix, then the number, then an optional format suffix like "lp" or "cd".
  const match = /^([A-Za-z][A-Za-z\s.-]{0,9}?)\s*[-\s]?\s*(\d{1,6})\s*[A-Za-z]{0,4}$/.exec(
    catno.trim(),
  )
  if (!match) return null

  const prefix = match[1]!.replace(/[\s.-]+$/, '').toUpperCase()
  const num = Number(match[2])
  return prefix.length > 0 && Number.isFinite(num) ? { prefix, num } : null
}
