import { afterEach, describe, expect, it } from 'vitest'

import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import { shelfView } from '~~/worker/collection/records'

/**
 * "What do I actually own by …" and "everything on this label".
 *
 * Two questions a record answers about itself, and the reason they are not the
 * search box: search asks whether a word appears anywhere, which is right for
 * "that Dinky record" and wrong for "everything on Cocoon" — a record *called*
 * Cocoon would join the list and quietly make the answer untrue.
 */

afterEach(async () => {
  await deleteFidelityDb()
})

let nextInstance = 1

async function shelve(over: Record<string, unknown> = {}): Promise<void> {
  const db = await openFidelityDb()
  const instanceId = nextInstance++
  await db.put('collection', {
    releaseId: instanceId,
    instanceId,
    folderId: 1,
    masterId: 0,
    title: 'A Record',
    artistIds: [],
    artistNames: ['Dinky'],
    artistNorms: ['dinky'],
    labelIds: [],
    labelNames: ['Cocoon Recordings'],
    labelNorms: ['cocoon recordings'],
    catnos: [],
    genres: [],
    styles: [],
    formats: ['Vinyl'],
    year: 2005,
    rating: 0,
    thumbUrl: '',
    coverUrl: '',
    addedAt: '2020-01-01T00:00:00Z',
    ...over,
  } as never)
}

describe('the shelf, narrowed to one label or one artist', () => {
  it('keeps only what is really on that label', async () => {
    await shelve()
    await shelve({ labelNames: ['Kompakt'], labelNorms: ['kompakt'] })

    const view = await shelfView({ label: 'Cocoon Recordings' })

    expect(view.records).toHaveLength(1)
    expect(view.records[0]?.label).toBe('Cocoon Recordings')
    // The denominator stays the whole collection: two records, one shown.
    expect(view.collection).toBe(2)
  })

  /*
   * The promise the search box cannot make.
   *
   * A record *called* "Cocoon" is not a record *on* Cocoon. Typed into search
   * it is a hit; asked as a label it must not be, or the answer to "everything
   * on this label" is quietly wrong in a way nobody checks.
   */
  it('does not confuse a name in the title with the label', async () => {
    await shelve()
    await shelve({ title: 'Cocoon', labelNames: ['Kompakt'], labelNorms: ['kompakt'] })

    expect(await shelfView({ label: 'Cocoon Recordings' }).then((v) => v.records)).toHaveLength(
      1,
    )
    // And the search box still behaves like a search box.
    expect(await shelfView({ query: 'cocoon' }).then((v) => v.records)).toHaveLength(2)
  })

  /*
   * A record on two labels belongs under both.
   *
   * The shelf shows the first label only, because a list needs one line per
   * record. Matching what is shown rather than what is stored would drop every
   * co-release from the label it was filed under second.
   */
  it('finds a record by its second label, which no screen shows', async () => {
    await shelve({
      labelNames: ['Kompakt', 'Cocoon Recordings'],
      labelNorms: ['kompakt', 'cocoon recordings'],
    })

    expect(await shelfView({ label: 'Cocoon Recordings' }).then((v) => v.records)).toHaveLength(
      1,
    )
  })

  it('keeps only what is really by that artist', async () => {
    await shelve()
    await shelve({ artistNames: ['Trentemøller'], artistNorms: ['trentemoller'] })

    const view = await shelfView({ artist: 'Dinky' })
    expect(view.records).toHaveLength(1)
    expect(view.records[0]?.artist).toBe('Dinky')
  })

  it('narrows by both at once, and by the search box on top', async () => {
    await shelve({ title: 'Acid In My Fridge' })
    await shelve({ title: 'Anemik' })
    await shelve({ artistNames: ['Âme'], artistNorms: ['ame'] })

    const both = await shelfView({ artist: 'Dinky', label: 'Cocoon Recordings' })
    expect(both.records).toHaveLength(2)

    const narrower = await shelfView({ artist: 'Dinky', query: 'fridge' })
    expect(narrower.records).toHaveLength(1)
    expect(narrower.records[0]?.title).toBe('Acid In My Fridge')
  })

  it('leaves the shelf alone when nothing is asked of it', async () => {
    await shelve()
    await shelve({ labelNames: ['Kompakt'], labelNorms: ['kompakt'] })

    expect(await shelfView({}).then((v) => v.records)).toHaveLength(2)
  })
})
