import { afterEach, describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'

import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import { pendingJobs } from '~~/db/outbox'
import type { CollectionItem } from '#shared/types'
import { knownFolders, moveToFolder, refreshFolders } from '~~/worker/collection/folders'
import type { DiscogsClient } from '~~/worker/discogs/client'
import { drainOutbox } from '~~/worker/outbox'

/**
 * The shelves inside the shelf.
 *
 * Fidelity only ever asked Discogs for folder 0 — the virtual "All" — so a
 * collection kept in "Sell", "Storage" and "Play copies" arrived here as one
 * heap, and a record moved into storage looked exactly like one still out.
 */

afterEach(async () => {
  await deleteFidelityDb()
})

const ANSWER = {
  folders: [
    { id: 0, name: 'All', count: 34 },
    { id: 1, name: 'Uncategorized', count: 30 },
    { id: 8_812, name: 'Sell', count: 4 },
  ],
}

const reader = () =>
  ({
    get: vi.fn(async (_path: string, schema: z.ZodType) => schema.parse(ANSWER)),
  }) as unknown as DiscogsClient

function record(over: Partial<CollectionItem> = {}): CollectionItem {
  return {
    releaseId: 77,
    masterId: 0,
    title: 'Trans Europa Express',
    artistIds: [],
    artistNorms: [],
    artistNames: ['Kraftwerk'],
    labelIds: [],
    labelNorms: [],
    labelNames: [],
    catnos: [],
    genres: [],
    styles: [],
    formats: ['Vinyl'],
    year: 1977,
    thumbUrl: '',
    coverUrl: '',
    rating: 0,
    addedAt: '2024-01-01T00:00:00-00:00',
    instanceId: 4_100,
    folderId: 1,
    ...over,
  }
}

describe('collection folders', () => {
  /*
   * Folder 0 is not a folder. It is every record at once, and it is not a
   * valid target for a write — offering it as somewhere to move a record to
   * would be a lie with a dropdown around it.
   */
  it('keeps the real folders and drops the virtual one', async () => {
    await refreshFolders(reader(), 'mrtnmlchr')

    expect((await knownFolders()).map((f) => f.name)).toEqual(['Uncategorized', 'Sell'])
  })

  it('moves a copy and addresses it by the folder it is still in', async () => {
    const db = await openFidelityDb()
    await db.put('collection', record())

    expect(await moveToFolder(4_100, 8_812)).toBe(true)
    expect((await db.get('collection', 4_100))?.folderId).toBe(8_812)

    const fake = { write: vi.fn(async () => null) } as unknown as DiscogsClient
    await drainOutbox(fake, 'mrtnmlchr')

    const [method, path, options] = (fake.write as ReturnType<typeof vi.fn>).mock.calls[0] ?? []
    expect(method).toBe('POST')
    // Addressed under folder 1, the one it is still in over at Discogs.
    expect(path).toBe('/users/mrtnmlchr/collection/folders/1/releases/77/instances/4100')
    expect(options).toEqual({ body: { folder_id: 8_812 }, idempotent: true })
  })

  it('spends nothing on a move to where it already is', async () => {
    const db = await openFidelityDb()
    await db.put('collection', record())

    expect(await moveToFolder(4_100, 1)).toBe(true)
    expect(await pendingJobs()).toEqual([])
  })

  it('refuses a copy with no entry behind it', async () => {
    const db = await openFidelityDb()
    await db.put('collection', record({ instanceId: -77, folderId: 0 }))

    expect(await moveToFolder(-77, 8_812)).toBe(false)
  })
})
