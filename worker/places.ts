import { openFidelityDb } from '~~/db/open'
import { MAX_GRID, slotLabel } from '#shared/places'
import type {
  CollectionItem,
  Finish,
  Place,
  Placement,
  PlaceNode,
  PlaceRule,
  UnitShape,
} from '#shared/types'

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

/** Three levels: room → furniture → compartment. Nobody builds more. */
export const MAX_DEPTH = 3

/** Short, random, and valid only inside this device. */
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
  /*
   * Compartments column by column — A1, A2, A3, B1 — and everything else by
   * name. In a list the letter groups, so the column is what reads as a
   * unit (Martin, 2026-09-12); the wall places each cube by its slot and
   * does not depend on this order.
   */
  for (const list of children.values()) {
    list.sort((a, b) => {
      if (a.slot && b.slot) return a.slot.column - b.slot.column || a.slot.row - b.slot.row
      return a.name.localeCompare(b.name)
    })
  }

  // The first three covers of what is directly here, for the wall's cubes.
  const firstIn = new Map<string, number[]>()
  for (const placement of placements.filter(liegtIrgendwo)) {
    const list = firstIn.get(placement.placeId) ?? []
    if (list.length < 3) list.push(placement.instanceId)
    firstIn.set(placement.placeId, list)
  }
  const coverLists = new Map<string, string[]>()
  for (const place of places) {
    const covers: string[] = []
    for (const instanceId of firstIn.get(place.id) ?? []) {
      const record = await db.get('collection', instanceId)
      if (record?.thumbUrl) covers.push(record.thumbUrl)
    }
    coverLists.set(place.id, covers)
  }

  const nodes: PlaceNode[] = []

  const walk = (parentId: string | null, depth: number): number => {
    let below = 0
    for (const place of children.get(parentId) ?? []) {
      const records = direct.get(place.id) ?? 0
      // A placeholder: the branch is only counted afterwards, but the order of
      // the list should be the tree's.
      const node: PlaceNode = {
        ...place,
        records,
        recordsBelow: records,
        depth,
        covers: coverLists.get(place.id) ?? [],
      }
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
    // A compartment holds records, not places; a unit's places are its
    // compartments and come with it (createUnit). Only a room takes children.
    if (cursor.kind === 'compartment' || cursor.kind === 'unit') return null
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
    kind: 'room',
    createdAt: at,
    updatedAt: at,
    removedAt: null,
  }
  await db.put('places', place)
  return place
}

/**
 * A piece of furniture and its compartments, in one transaction (M27.1).
 *
 * A Kallax 4×4 is sixteen places that exist together or not at all. The
 * compartments are ordinary places — everything that works on a place
 * (assign, move, the vault) works on them from the first day — named by
 * their coordinate, which stays even when somebody calls one "Jazz".
 */
export async function createUnit(params: {
  name: string
  parentId: string | null
  shape: UnitShape
  columns: number
  rows: number
  capacity: number | null
  finish: Finish
  rule: PlaceRule
}): Promise<Place | null> {
  const name = params.name.trim()
  const columns = Math.trunc(params.columns)
  const rows = Math.trunc(params.rows)
  if (!name || columns < 1 || rows < 1 || columns > MAX_GRID || rows > MAX_GRID) return null
  const db = await openFidelityDb()
  if (params.parentId !== null) {
    const parent = await db.get('places', params.parentId)
    // Units stand in rooms or at the top — never in a unit or a compartment.
    if (!parent || !alive(parent) || (parent.kind && parent.kind !== 'room')) return null
  }
  const at = Date.now()
  const unit: Place = {
    id: newId(),
    name,
    parentId: params.parentId,
    kind: 'unit',
    shape: params.shape,
    grid: { columns, rows },
    capacity: params.capacity,
    finish: params.finish,
    rule: params.rule,
    createdAt: at,
    updatedAt: at,
    removedAt: null,
  }
  const tx = db.transaction('places', 'readwrite')
  await tx.store.put(unit)
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      await tx.store.put({
        id: newId(),
        name: slotLabel(column, row),
        parentId: unit.id,
        kind: 'compartment',
        slot: { column, row },
        capacity: params.capacity,
        createdAt: at,
        updatedAt: at,
        removedAt: null,
      })
    }
  }
  await tx.done
  return unit
}

/** A new look for a piece of furniture; stamped, so the vault can tell which device chose last. */
export async function setFinish(id: string, finish: Finish): Promise<boolean> {
  const db = await openFidelityDb()
  const place = await db.get('places', id)
  if (!place || !alive(place) || place.kind !== 'unit') return false
  await db.put('places', { ...place, finish, updatedAt: Date.now() })
  return true
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
    if (child.parentId !== id || !alive(child)) continue
    if (child.kind === 'compartment') {
      // A compartment is nothing without its unit: it goes too, and what it
      // held moves where the unit stood — the room, or nowhere.
      const held = await placements.index('by-place').getAll(child.id)
      for (const row of held) await placements.put({ ...row, placeId: place.parentId, at })
      await places.put({ ...child, removedAt: at, updatedAt: at })
    } else {
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

/** Several at once, one transaction, one stamp — filling a compartment from the wall (M27.1c). */
export async function placeRecords(
  instanceIds: number[],
  placeId: string | null,
): Promise<number> {
  const db = await openFidelityDb()
  const at = Date.now()
  const tx = db.transaction('placements', 'readwrite')
  for (const instanceId of instanceIds) await tx.store.put({ instanceId, placeId, at })
  await tx.done
  return instanceIds.length
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
 * A piece of furniture carried into another room, or out of one (M27.4).
 *
 * Only furniture moves: a room is a heading, a compartment is nothing
 * without its unit. It stands in a room or at the top — never in a unit or
 * a compartment, and never in a room that is gone.
 */
export async function movePlace(id: string, parentId: string | null): Promise<boolean> {
  const db = await openFidelityDb()
  const place = await db.get('places', id)
  if (!place || !alive(place) || place.kind !== 'unit' || place.parentId === parentId)
    return false
  if (parentId !== null) {
    const parent = await db.get('places', parentId)
    if (!parent || !alive(parent) || (parent.kind && parent.kind !== 'room')) return false
  }
  await db.put('places', { ...place, parentId, updatedAt: Date.now() })
  return true
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
