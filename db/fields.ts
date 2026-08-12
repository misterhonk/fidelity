import { openFidelityDb } from './open'
import type { FieldValues } from './schema'

/**
 * The three fields Discogs keeps beside a record: media, sleeve, notes.
 *
 * Stored on their own rather than inside the collection row, because the sync
 * rewrites that row from Discogs' answer and would take these with it. And
 * they cannot be read back from Discogs at all (docs/02), so this device's
 * copy is the only one there is.
 */

export async function fieldValuesFor(releaseId: number): Promise<Record<number, string>> {
  const db = await openFidelityDb()
  const row = await db.get('fieldValues', releaseId)
  return row?.values ?? {}
}

export async function writeFieldValue(
  releaseId: number,
  fieldId: number,
  value: string,
): Promise<FieldValues> {
  const db = await openFidelityDb()
  const row = (await db.get('fieldValues', releaseId)) ?? { releaseId, values: {} }
  const next: FieldValues = { releaseId, values: { ...row.values, [fieldId]: value } }
  await db.put('fieldValues', next)
  return next
}
