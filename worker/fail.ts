import type { WorkerError } from '#shared/protocol'

/**
 * The only way the worker throws something a person will read.
 *
 * `explain()` on the main thread ends with `title: message || words.unknown`.
 * A thrown sentence therefore *is* the headline — red, at the top — and the
 * worker cannot write one, because the language packs hang off
 * `activeLanguage()` in the main thread and the worker computes without
 * knowing anything about language (CLAUDE.md).
 *
 * So it throws a **code** and a terse detail. The code picks the words; the
 * detail stays reachable behind `ErrorNote`'s detail button, which is where
 * somebody debugging a genuinely new failure needs the original.
 *
 * `tests/unit/template-text.spec.ts` forbids `throw new Error('…')` under
 * `worker/` outright, so this is not a convention anybody has to remember.
 */
export function fail(code: NonNullable<WorkerError['code']>, detail: string): Error {
  return Object.assign(new Error(detail), { code })
}
