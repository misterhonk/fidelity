import { openFidelityDb } from './open'
import type { FieldValues } from './schema'

/**
 * The three fields Discogs keeps beside a record: media, sleeve, notes.
 *
 * Stored on their own rather than inside the collection row, because the sync
 * rewrites that row from Discogs' answer and would take these with it. And
 * they cannot be read back from Discogs at all (docs/02), so this device's
 * copy is the only one there is.
 *
 * Keyed by instance, because a condition describes *a copy*: somebody who owns
 * a sealed one and a played one has two different answers to the same
 * question.
 */

export async function fieldValuesFor(instanceId: number): Promise<Record<number, string>> {
  const db = await openFidelityDb()
  const row = await db.get('fieldValues', instanceId)
  return row?.values ?? {}
}

export async function writeFieldValue(
  instanceId: number,
  fieldId: number,
  value: string,
): Promise<FieldValues> {
  const db = await openFidelityDb()
  const row = (await db.get('fieldValues', instanceId)) ?? { instanceId, values: {} }
  const next: FieldValues = { instanceId, values: { ...row.values, [fieldId]: value } }
  await db.put('fieldValues', next)
  return next
}
