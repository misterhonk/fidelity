import { z } from 'zod'

import { getMeta, setMeta } from '~~/db/meta'
import { fieldValuesFor, writeFieldValue } from '~~/db/fields'
import { openFidelityDb } from '~~/db/open'
import { queueJob } from '~~/db/outbox'
import { isOwnEntry, type CollectionField } from '#shared/types'
import type { DiscogsClient } from '../discogs/client'

/**
 * What Discogs lets you note beside a record you own.
 *
 * Three fields on every account — Media Condition, Sleeve Condition, Notes —
 * and the first two are dropdowns whose options come *from the API*. Writing
 * them out by hand here would be a list that drifts from the one the server
 * accepts; the options are fetched once and kept.
 */

const fieldsSchema = z.object({
  fields: z.array(
    z.object({
      id: z.number().int(),
      name: z.string(),
      type: z.string(),
      options: z.array(z.string()).optional(),
    }),
  ),
})

/**
 * The definitions, from storage or — once — from Discogs.
 *
 * They do not change: the same three ids on every account, measured
 * 2026-08-11. So this is fetched the first time somebody opens a record and
 * never again, rather than on every sync.
 */
export async function collectionFields(
  client: DiscogsClient,
  username: string,
): Promise<CollectionField[]> {
  const cached = await getMeta('collectionFields')
  if (cached) return cached

  const answer = await client.get(
    `/users/${encodeURIComponent(username)}/collection/fields`,
    fieldsSchema,
  )
  const fields = answer.fields.map((field) => ({
    id: field.id,
    name: field.name,
    type: field.type === 'dropdown' ? ('dropdown' as const) : ('text' as const),
    options: field.options ?? [],
  }))

  await setMeta('collectionFields', fields)
  return fields
}

/**
 * Sets one field on one record.
 *
 * Same shape as a rating: written here, queued for Discogs, put back if it
 * never lands. Returns false when the record carries no entry to address.
 */
export async function setFieldValue(
  instanceId: number,
  fieldId: number,
  value: string,
): Promise<boolean> {
  const db = await openFidelityDb()
  const record = await db.get('collection', instanceId)
  if (!record || !isOwnEntry(record)) return false

  const before = (await fieldValuesFor(instanceId))[fieldId] ?? ''
  if (before === value) return true

  await writeFieldValue(instanceId, fieldId, value)
  await queueJob({
    id: `collection.field:${instanceId}:${fieldId}`,
    kind: 'collection.field',
    payload: {
      releaseId: record.releaseId,
      folderId: record.folderId,
      instanceId,
      fieldId,
      value,
    },
    revert: { value: before },
    queuedAt: Date.now(),
  })

  return true
}
