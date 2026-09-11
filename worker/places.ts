import { openFidelityDb } from '~~/db/open'
import type { CollectionItem, Place, Placement, PlaceNode } from '#shared/types'

/**
 * Where the record stands (M12).
 *
 * **The one feature in this app that costs zero requests.** A location is a
 * statement about somebody's own flat, not a piece of Discogs data — it is
 * created here, stays here, and is sent nowhere.
 *
 * Measured on 2026-09-11, and built this way because of it:
 *
 * - `GET /users/{u}/collection/fields` returns exactly three fields (Media,
 *   Sleeve, Notes) and none anybody created. So the location cannot even
 *   optionally travel to Discogs — there is no field for it.
 * - The sync rewrites every collection row with `put()`. A location **on** the
 *   row would be silently gone after the next full pass. Hence a store of its
 *   own that the sync does not touch.
 */

/** Drei Ebenen: Ort → Möbel → Fach. Mehr baut sich niemand. */
export const MAX_DEPTH = 3

/** Kurz, zufällig, und nur innerhalb dieses Geräts gültig. */
function newId(): string {
  return [...crypto.getRandomValues(new Uint8Array(8))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Every place with its numbers, sorted from the top down.
 *
 * `records` are the records sitting directly here; `recordsBelow` counts those
 * in places underneath too — "in the cellar" means the whole cellar, and a
 * cellar showing 0 while three crates in it are full is a lie.
 */
/**
 * A dissolved place is still there, but no longer counts.
 *
 * The tombstone exists for the vault (`Place.removedAt`); for everything else
 * the place is gone. Hence exactly one filter that every read goes through —
 * two filters are one somebody forgets.
 */
const alive = (place: Place) => !place.removedAt

/**
 * And a record that sits nowhere sits nowhere — row or no row.
 *
 * This is a **type** narrowing, not a change in behaviour: `placeId: null`
 * would otherwise land as the key `null` in a `Map<string, number>` that
 * nobody queries, because no place is called `null`. A mutation probe duly
 * survived the filter — there is nothing to observe here, and a test claiming
 * otherwise would be checking something that does not happen.
 */
const liegtIrgendwo = (placement: Placement): placement is Placement & { placeId: string } =>
  placement.placeId !== null

export async function placesOverview(): Promise<PlaceNode[]> {
  const db = await openFidelityDb()
  const [all, placements] = await Promise.all([db.getAll('places'), db.getAll('placements')])
  const places = all.filter(alive)

  const direct = new Map<string, number>()
  for (const placement of placements.filter(liegtIrgendwo)) {
    direct.set(placement.placeId, (direct.get(placement.placeId) ?? 0) + 1)
  }

  const children = new Map<string | null, Place[]>()
  for (const place of places) {
    const list = children.get(place.parentId) ?? []
    list.push(place)
    children.set(place.parentId, list)
  }
  for (const list of children.values()) list.sort((a, b) => a.name.localeCompare(b.name))

  const nodes: PlaceNode[] = []

  const walk = (parentId: string | null, depth: number): number => {
    let below = 0
    for (const place of children.get(parentId) ?? []) {
      const records = direct.get(place.id) ?? 0
      // A placeholder: the branch is only counted afterwards, but the order of
      // the list should be the tree's.
      const node: PlaceNode = { ...place, records, recordsBelow: records, depth }
      nodes.push(node)
      const inChildren = walk(place.id, depth + 1)
      node.recordsBelow = records + inChildren
      below += node.recordsBelow
    }
    return below
  }

  walk(null, 0)
  return nodes
}

export async function createPlace(
  name: string,
  parentId: string | null,
): Promise<Place | null> {
  const trimmed = name.trim()
  if (!trimmed) return null

  const db = await openFidelityDb()

  /*
   * Check the depth before creating.
   *
   * Without it the tree grows until nobody can take it in — and the interface
   * indents every level until there is nothing left on a phone.
   */
  if (parentId !== null) {
    let depth = 1
    let cursor = await db.get('places', parentId)
    if (!cursor || !alive(cursor)) return null
    while (cursor?.parentId) {
      depth += 1
      cursor = await db.get('places', cursor.parentId)
    }
    if (depth >= MAX_DEPTH) return null
  }

  const at = Date.now()
  const place: Place = {
    id: newId(),
    name: trimmed,
    parentId,
    createdAt: at,
    updatedAt: at,
    removedAt: null,
  }
  await db.put('places', place)
  return place
}

export async function renamePlace(id: string, name: string): Promise<boolean> {
  const trimmed = name.trim()
  if (!trimmed) return false

  const db = await openFidelityDb()
  const place = await db.get('places', id)
  if (!place || !alive(place)) return false

  await db.put('places', { ...place, name: trimmed, updatedAt: Date.now() })
  return true
}

/**
 * Dissolving a place — and **not** throwing the records in it away.
 *
 * They become placeless, not deleted. A place is a note about a shelf; taking
 * the shelf apart does not mean giving the records away. Places underneath
 * move up one level, for the same reason.
 */
export async function removePlace(id: string): Promise<void> {
  const db = await openFidelityDb()
  const place = await db.get('places', id)
  if (!place || !alive(place)) return

  const at = Date.now()
  const tx = db.transaction(['places', 'placements'], 'readwrite')
  const places = tx.objectStore('places')
  const placements = tx.objectStore('placements')

  for (const child of await places.getAll()) {
    if (child.parentId === id) {
      await places.put({ ...child, parentId: place.parentId, updatedAt: at })
    }
  }

  /*
   * The records are written placeless, not deleted.
   *
   * A deleted row is not a message to the merge but a gap — the other device
   * still knows the old one and puts the record back on a shelf that no longer
   * exists. A `null` with a fresh `at` wins.
   */
  const drin = await placements.index('by-place').getAll(id)
  for (const row of drin) await placements.put({ ...row, placeId: null, at })

  await places.put({ ...place, removedAt: at, updatedAt: at })
  await tx.done
}

/** Put a copy in a place — or take it down from everywhere. */
export async function placeRecord(instanceId: number, placeId: string | null): Promise<void> {
  const db = await openFidelityDb()
  // Taking it down is written too, not deleted — see above.
  await db.put('placements', { instanceId, placeId, at: Date.now() })
}

export async function placeOf(instanceId: number): Promise<string | null> {
  const db = await openFidelityDb()
  const placement = await db.get('placements', instanceId)
  if (!placement?.placeId) return null

  // A place another device has dissolved is not an answer to "where is it".
  // The record is placeless then, not missing.
  const place = await db.get('places', placement.placeId)
  return place && alive(place) ? placement.placeId : null
}

/**
 * What sits in a place — with the places underneath, where that is asked for.
 *
 * "What is in the cellar" means the whole cellar. Without `deep` the answer
 * for a place holding only crates would always be empty.
 */
export async function placeContents(placeId: string, deep = true): Promise<CollectionItem[]> {
  const db = await openFidelityDb()
  const ids = new Set<string>([placeId])

  if (deep) {
    // Living places only here too: after a merge, a row can still point at a
    // place this device dissolved long ago.
    const places = (await db.getAll('places')).filter(alive)
    let grew = true
    while (grew) {
      grew = false
      for (const place of places) {
        if (place.parentId && ids.has(place.parentId) && !ids.has(place.id)) {
          ids.add(place.id)
          grew = true
        }
      }
    }
  }

  const items: CollectionItem[] = []
  for (const id of ids) {
    for (const placement of await db.getAllFromIndex('placements', 'by-place', id)) {
      const record = await db.get('collection', placement.instanceId)
      // A record that has disappeared from the collection leaves its location
      // behind. The shelf then knows more than the collection — here it is
      // simply left out rather than shown as a hole.
      if (record) items.push(record)
    }
  }

  return items.sort((a, b) => a.title.localeCompare(b.title))
}

/**
 * Everything from one place to another — the ordinary case after a move.
 *
 * Not the single copy: somebody moving carries crates, not records.
 */
export async function moveAll(from: string, to: string): Promise<number> {
  if (from === to) return 0

  const db = await openFidelityDb()
  const tx = db.transaction('placements', 'readwrite')
  const rows = await tx.store.index('by-place').getAll(from)
  for (const row of rows) await tx.store.put({ ...row, placeId: to, at: Date.now() })
  await tx.done
  return rows.length
}
