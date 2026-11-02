import type { CollectionField } from './types'

/**
 * Which of Discogs' collection fields are the media and the sleeve grade.
 *
 * The first two dropdowns, by name where the account kept the default names —
 * and 1 and 2, Discogs' own ids for them, before the definitions were ever
 * fetched. Shared because the worker filters on them and the row edits them.
 */
export function gradeFieldIds(fields: readonly CollectionField[] | null | undefined): {
  media: number
  sleeve: number
} {
  const dropdowns = (fields ?? []).filter((field) => field.type === 'dropdown')
  const named = (word: RegExp) => dropdowns.find((field) => word.test(field.name))?.id
  return {
    media: named(/media/i) ?? dropdowns[0]?.id ?? 1,
    sleeve: named(/sleeve/i) ?? dropdowns[1]?.id ?? 2,
  }
}

/** Very Good and everything below it, by the abbreviation Discogs puts in brackets. */
const WORN = new Set(['VG', 'G+', 'G', 'F', 'P'])

/**
 * "Condition ≤ VG": either grade at Very Good or below.
 *
 * Read from the bracket — "Very Good (VG)" — because that is the part that is
 * the same in every language Discogs offers. "Generic", "No Cover" and "Not
 * Graded" say nothing about wear and do not count.
 */
export function isWorn(...grades: string[]): boolean {
  return grades.some((grade) => WORN.has(/\(([^)]+)\)\s*$/.exec(grade)?.[1] ?? ''))
}
