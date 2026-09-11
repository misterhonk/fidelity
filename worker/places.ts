import { openFidelityDb } from '~~/db/open'
import type { CollectionItem, Place, PlaceNode } from '#shared/types'

/**
 * Wo die Platte steht (M12).
 *
 * **Das einzige Feature dieser App, das null Requests kostet.** Ein Standort
 * ist eine Aussage über die eigene Wohnung, kein Discogs-Datum — er entsteht
 * hier, bleibt hier und wird nirgendwohin geschickt.
 *
 * Am 2026-09-11 nachgemessen und deshalb so gebaut:
 *
 * - `GET /users/{u}/collection/fields` gibt genau drei Felder zurück (Media,
 *   Sleeve, Notes) und keine selbst angelegten. Der Standort kann also auch
 *   nicht optional zu Discogs mitwandern — es gibt kein Feld dafür.
 * - Der Sync schreibt jede Sammlungszeile mit `put()` neu. Ein Standort **am**
 *   Eintrag wäre nach dem nächsten vollen Durchlauf lautlos weg. Deshalb ein
 *   eigener Store, den der Sync nicht anfasst.
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
 * Alle Orte mit ihren Zahlen, von oben nach unten sortiert.
 *
 * `records` sind die Platten, die direkt hier liegen; `recordsBelow` zählt die
 * in Unterorten mit — „im Keller" meint den ganzen Keller, und ein Keller, der
 * 0 anzeigt, während drei Kisten darin voll sind, ist eine Lüge.
 */
export async function placesOverview(): Promise<PlaceNode[]> {
  const db = await openFidelityDb()
  const [places, placements] = await Promise.all([db.getAll('places'), db.getAll('placements')])

  const direct = new Map<string, number>()
  for (const placement of placements) {
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
      // Platzhalter: der Zweig wird erst danach gezählt, aber die Reihenfolge
      // der Liste soll die des Baums sein.
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
   * Tiefe prüfen, bevor angelegt wird.
   *
   * Ohne das wächst der Baum, bis jemand ihn nicht mehr überblickt — und die
   * Oberfläche rückt jede Ebene ein, bis auf einem Telefon nichts mehr
   * übrig ist.
   */
  if (parentId !== null) {
    let depth = 1
    let cursor = await db.get('places', parentId)
    if (!cursor) return null
    while (cursor?.parentId) {
      depth += 1
      cursor = await db.get('places', cursor.parentId)
    }
    if (depth >= MAX_DEPTH) return null
  }

  const place: Place = { id: newId(), name: trimmed, parentId, createdAt: Date.now() }
  await db.put('places', place)
  return place
}

export async function renamePlace(id: string, name: string): Promise<boolean> {
  const trimmed = name.trim()
  if (!trimmed) return false

  const db = await openFidelityDb()
  const place = await db.get('places', id)
  if (!place) return false

  await db.put('places', { ...place, name: trimmed })
  return true
}

/**
 * Einen Ort auflösen — und die Platten darin **nicht** wegwerfen.
 *
 * Sie werden ortlos, nicht gelöscht. Ein Ort ist eine Notiz über ein Regal;
 * das Regal abzubauen heißt nicht, die Platten wegzugeben. Unterorte rücken
 * eine Ebene nach oben, aus demselben Grund.
 */
export async function removePlace(id: string): Promise<void> {
  const db = await openFidelityDb()
  const place = await db.get('places', id)
  if (!place) return

  const tx = db.transaction(['places', 'placements'], 'readwrite')
  const places = tx.objectStore('places')
  const placements = tx.objectStore('placements')

  for (const child of await places.getAll()) {
    if (child.parentId === id) await places.put({ ...child, parentId: place.parentId })
  }

  const drin = await placements.index('by-place').getAll(id)
  for (const row of drin) await placements.delete(row.instanceId)

  await places.delete(id)
  await tx.done
}

/** Ein Exemplar an einen Ort legen — oder von überall herunternehmen. */
export async function placeRecord(instanceId: number, placeId: string | null): Promise<void> {
  const db = await openFidelityDb()
  if (placeId === null) {
    await db.delete('placements', instanceId)
    return
  }
  await db.put('placements', { instanceId, placeId, at: Date.now() })
}

export async function placeOf(instanceId: number): Promise<string | null> {
  const db = await openFidelityDb()
  return (await db.get('placements', instanceId))?.placeId ?? null
}

/**
 * Was an einem Ort liegt — mit den Unterorten, wenn gefragt.
 *
 * „Was ist im Keller" meint den ganzen Keller. Ohne `deep` wäre die Antwort
 * für einen Ort, der nur Kisten enthält, immer leer.
 */
export async function placeContents(placeId: string, deep = true): Promise<CollectionItem[]> {
  const db = await openFidelityDb()
  const ids = new Set<string>([placeId])

  if (deep) {
    const places = await db.getAll('places')
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
      // Eine Platte, die aus der Sammlung verschwunden ist, lässt ihren
      // Standort zurück. Das Regal weiß dann mehr als die Sammlung — hier
      // wird sie einfach ausgelassen statt als Loch gezeigt.
      if (record) items.push(record)
    }
  }

  return items.sort((a, b) => a.title.localeCompare(b.title))
}

/**
 * Alles von einem Ort an einen anderen — der Normalfall nach einem Umzug.
 *
 * Nicht das Einzelstück: wer umzieht, trägt Kisten, keine Platten.
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
