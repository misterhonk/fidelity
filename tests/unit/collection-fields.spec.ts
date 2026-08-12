import { afterEach, describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'

import { fieldValuesFor } from '~~/db/fields'
import { getMeta } from '~~/db/meta'
import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import { pendingJobs } from '~~/db/outbox'
import type { CollectionItem } from '#shared/types'
import { collectionFields, setFieldValue } from '~~/worker/collection/fields'
import type { DiscogsClient } from '~~/worker/discogs/client'

/**
 * Media condition, sleeve condition, notes.
 *
 * Two things here are unlike everything else the app stores. The option lists
 * belong to Discogs — writing our own would offer values the server refuses —
 * and the values belong to nobody else: they come back in no listing, so this
 * device's copy is the only one. Both are worth a test.
 */

afterEach(async () => {
  await deleteFidelityDb()
})

const ANSWER = {
  fields: [
    { id: 1, name: 'Media Condition', type: 'dropdown', options: ['Mint (M)', 'Fair (F)'] },
    { id: 3, name: 'Notes', type: 'textarea' },
  ],
}

function fakeClient() {
  const get = vi.fn(async (_path: string, schema: z.ZodType) => schema.parse(ANSWER))
  return { client: { get } as unknown as DiscogsClient, get }
}

function record(over: Partial<CollectionItem> = {}): CollectionItem {
  return {
    releaseId: 5,
    masterId: 0,
    title: 'Remain In Light',
    artistIds: [],
    artistNorms: [],
    artistNames: ['Talking Heads'],
    labelIds: [],
    labelNorms: [],
    labelNames: ['Sire'],
    catnos: [],
    genres: [],
    styles: [],
    formats: ['Vinyl'],
    year: 1980,
    thumbUrl: '',
    coverUrl: '',
    rating: 0,
    addedAt: '2024-01-01T00:00:00-00:00',
    instanceId: 700,
    folderId: 1,
    ...over,
  }
}

describe('the fields Discogs keeps beside a record', () => {
  it('takes the option lists from the server rather than inventing them', async () => {
    const { client } = fakeClient()

    const fields = await collectionFields(client, 'mrtnmlchr')

    expect(fields[0]).toEqual({
      id: 1,
      name: 'Media Condition',
      type: 'dropdown',
      options: ['Mint (M)', 'Fair (F)'],
    })
    // A textarea is a line to type in, not a list to choose from.
    expect(fields[1]?.type).toBe('text')
    expect(fields[1]?.options).toEqual([])
  })

  /*
   * The definitions are the same three on every account and do not change, so
   * asking again would spend a paced request on an answer already known.
   */
  it('asks once and keeps the answer', async () => {
    const { client, get } = fakeClient()

    await collectionFields(client, 'mrtnmlchr')
    await collectionFields(client, 'mrtnmlchr')

    expect(get).toHaveBeenCalledTimes(1)
    expect(await getMeta('collectionFields')).toHaveLength(2)
  })

  /**
   * A field somebody adds later still arrives.
   *
   * Three fields come with every account, and those never change — which is
   * why this was fetched once and kept for ever. But Discogs also lets a
   * collector *add* fields, and one created after that first fetch would never
   * have appeared: no error, no empty row, just a field that exists on the
   * website and not here. The full daily walk asks again.
   */
  it('asks again when told to, so a field added later shows up', async () => {
    const { client, get } = fakeClient()
    await collectionFields(client, 'mrtnmlchr')
    expect(get).toHaveBeenCalledTimes(1)

    ANSWER.fields.push({ id: 9, name: 'Bought at', type: 'textarea' })
    try {
      const refreshed = await collectionFields(client, 'mrtnmlchr', { refresh: true })

      expect(get).toHaveBeenCalledTimes(2)
      expect(refreshed.map((field) => field.name)).toContain('Bought at')
      // And the new list replaces the old one rather than sitting beside it.
      expect((await getMeta('collectionFields'))?.map((field) => field.name)).toContain(
        'Bought at',
      )
    } finally {
      ANSWER.fields.pop()
    }
  })

  it('stores a value and queues it, with the old one to fall back to', async () => {
    const db = await openFidelityDb()
    await db.put('collection', record())

    expect(await setFieldValue(700, 1, 'Mint (M)')).toBe(true)

    expect(await fieldValuesFor(700)).toEqual({ 1: 'Mint (M)' })
    const [job] = await pendingJobs()
    expect(job?.payload.value).toBe('Mint (M)')
    expect(job?.revert).toEqual({ value: '' })
  })

  /*
   * Values live outside the collection row on purpose: the sync rewrites that
   * row from Discogs' answer, and Discogs does not carry these. Inside it,
   * they would be destroyed by the next walk — permanently, since there is
   * nowhere to read them back from.
   */
  it('survives a collection row being rewritten by a sync', async () => {
    const db = await openFidelityDb()
    await db.put('collection', record())
    await setFieldValue(700, 1, 'Fair (F)')

    await db.put('collection', record({ rating: 4 }))

    expect(await fieldValuesFor(700)).toEqual({ 1: 'Fair (F)' })
  })

  it('refuses a record with no entry to address', async () => {
    const db = await openFidelityDb()
    await db.put('collection', record({ instanceId: -5, folderId: 0 }))

    expect(await setFieldValue(-5, 1, 'Mint (M)')).toBe(false)
    expect(await pendingJobs()).toEqual([])
  })
})
