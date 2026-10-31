import type { HorizonChunk } from '#shared/types'

type Flattened = Record<string, number> | ArrayLike<number> | undefined

/**
 * Puts back the typed arrays a vault round flattened.
 *
 * Until 2026-10-31 the vault sealed horizon chunks with `JSON.stringify`, which
 * turns an `Int32Array` into `{"0":5,"1":6}` — no `length`, so every lookup
 * looped zero times while the chunk still counted as fresh for thirty days.
 * Integer keys come back in ascending order, so the values are all still there.
 *
 * Returns the row unchanged where there is nothing to do, so the migration can
 * compare and skip.
 */
export function repairHorizonChunk(chunk: HorizonChunk): HorizonChunk {
  if (chunk.releaseIds instanceof Int32Array) return chunk

  const values = (field: Flattened) => Object.values(field ?? {}) as number[]
  const raw = chunk as unknown as Record<string, Flattened>
  return {
    ...chunk,
    releaseIds: Int32Array.from(values(raw.releaseIds)),
    roles: Uint8Array.from(values(raw.roles)),
    years: Int16Array.from(values(raw.years)),
    ...(raw.catnoNums === undefined
      ? {}
      : { catnoNums: Int32Array.from(values(raw.catnoNums)) }),
  }
}
