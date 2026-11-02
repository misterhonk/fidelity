import { openFidelityDb } from '~~/db/open'
import type { CopyState } from '#shared/types'

/**
 * Your copy, beside the record (M41, ADR-019).
 *
 * The paid price and the arrival day hang off the placement row: it is keyed by
 * `instanceId`, the sync never touches it, and it already travels in the vault
 * and the backup. Zero requests.
 */

/** "18", "18.5", "18,50" → cents. Null for empty, undefined for something that is not a price. */
export function parseCents(typed: string): number | null | undefined {
  const text = typed.trim()
  if (!text) return null
  const match = /^(\d{1,7})(?:[.,](\d{1,2}))?$/.exec(text)
  if (!match) return undefined
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

export async function copyOf(instanceId: number): Promise<CopyState> {
  const db = await openFidelityDb()
  const [record, placement, jobs] = await Promise.all([
    db.get('collection', instanceId),
    db.get('placements', instanceId),
    db.getAll('outbox'),
  ])
  const copies = record
    ? (await db.getAllFromIndex('collection', 'by-release', record.releaseId))
        .filter((copy) => copy.instanceId > 0)
        .sort((a, b) => a.addedAt.localeCompare(b.addedAt) || a.instanceId - b.instanceId)
        .map((copy) => copy.instanceId)
    : []
  // Ids are `${kind}:${instanceId}` or `${kind}:${instanceId}:${field}`; an add is keyed by release.
  const mine = jobs.filter(
    (job) => job.kind !== 'collection.add' && job.id.split(':')[1] === String(instanceId),
  )
  return {
    copies,
    paid: placement?.paid ?? null,
    arrivedOn: placement?.arrivedOn ?? null,
    waiting: instanceId > 0 ? mine.length : 0,
    failing: mine.some((job) => job.attempts > 0 || job.lastError !== undefined),
  }
}

/**
 * Writes what was typed. False when it is not a price or not a day — the field
 * then keeps what it had, and nothing is stored.
 */
export async function setCopy(
  instanceId: number,
  patch: { paid?: { amount: string; currency: string }; arrivedOn?: string },
): Promise<boolean> {
  let paid: CopyState['paid'] | undefined
  if (patch.paid) {
    const cents = parseCents(patch.paid.amount)
    const currency = patch.paid.currency.trim().toUpperCase()
    if (cents === undefined || (cents !== null && !/^[A-Z]{3}$/.test(currency))) return false
    paid = cents === null ? null : { cents, currency }
  }
  let arrivedOn: string | null | undefined
  if (patch.arrivedOn !== undefined) {
    if (patch.arrivedOn && !DAY.test(patch.arrivedOn)) return false
    arrivedOn = patch.arrivedOn || null
  }

  const db = await openFidelityDb()
  const tx = db.transaction('placements', 'readwrite')
  const row = (await tx.store.get(instanceId)) ?? { instanceId, placeId: null, at: 0 }
  await tx.store.put({
    ...row,
    ...(paid !== undefined && { paid }),
    ...(arrivedOn !== undefined && { arrivedOn }),
    // One stamp for the row: the vault merges placements whole, by `at`.
    at: Date.now(),
  })
  await tx.done
  return true
}
