import type { FidelityDatabase } from '~~/db/open'
import type { Dealer } from '#shared/types'

import { norm } from '../match/normalize'

/**
 * Four records of your own on the labels this shop carries (M31.4).
 *
 * A shop described in numbers is a shop nobody pictures. The fingerprint knows
 * which labels it stocks and how many of each; the collection knows which of
 * those you already own. The overlap, drawn as sleeves, says in half a second
 * what a bar chart says in ten: *this is your kind of shop.*
 *
 * **Four different labels rather than four records off the same one.** One
 * shop stocking a hundred and twenty Kompakt records would otherwise be four
 * identical-looking Kompakt sleeves, which describes the label and not the
 * shop.
 *
 * Costs nothing: one pass over the collection, no request, and the covers are
 * whatever `db/covers.ts` already holds — the page asks for them with fetching
 * switched off, so a record without one simply shows no picture.
 */

/** How many sleeves fit the row without becoming a gallery. */
const SAMPLE = 4

/** How far down the shop's label list to look before giving up. */
const DEPTH = 12

export interface ShelfSample {
  releaseId: number
  title: string
  artist: string
  label: string
}

export async function shelfSample(
  db: FidelityDatabase,
  dealer: Dealer,
): Promise<ShelfSample[]> {
  const dist = dealer.fingerprint?.labelDist
  if (!dist) return []

  const labels = Object.entries(dist)
    .sort((a, b) => b[1] - a[1])
    .slice(0, DEPTH)
    .map(([name]) => name)
  if (labels.length === 0) return []

  /*
   * Through the label index (M34.4): one small read per label instead of the
   * whole collection on every open of a profile. `labelNorms` is written
   * with the same `norm` the inventory's label goes through here.
   */
  const found: ShelfSample[] = []
  const seen = new Set<number>()

  for (const label of labels) {
    if (found.length >= SAMPLE) break
    const hit = (await db.getAllFromIndex('collection', 'by-label', norm(label))).find(
      (item) => !seen.has(item.releaseId),
    )
    if (!hit) continue

    seen.add(hit.releaseId)
    found.push({
      releaseId: hit.releaseId,
      title: hit.title,
      artist: hit.artistNames[0] ?? '',
      label,
    })
  }

  return found
}
