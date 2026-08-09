import { openFidelityDb } from '~~/db/open'
import { ROLE_TABLE, type CreditGroup, type Match } from '#shared/types'

import { buildLookup, hitsFor } from '../horizon/lookup'

/**
 * The credit-graph explorer (docs/06 M5).
 *
 * "Du besitzt 9 Produktionen von Conny Plank. Dieser Händler hat 4 weitere,
 * die du nicht hast" — docs/00 §5 calls the credit graph the actual killer
 * feature, and until now it only ever surfaced one record at a time, as a
 * sentence on a card. This is the view that answers the question the sentence
 * raises: *what else is here by the same hand?*
 *
 * Costs nothing. Every edge it groups by was already paid for when the horizon
 * was built; this is a regroup of a dig's own matches.
 */

/** Below this a person is a coincidence rather than a thread worth pulling. */
export const MIN_MATCHES = 2

export async function creditGroups(digId: string): Promise<CreditGroup[]> {
  const db = await openFidelityDb()

  const [matches, chunks, collection, wantlist] = await Promise.all([
    db
      .transaction('matches')
      .store.index('by-dig-score')
      .getAll(IDBKeyRange.bound([digId, -Infinity], [digId, Infinity])),
    db.getAll('horizon'),
    db.getAll('collection'),
    db.getAll('wantlist'),
  ])

  if (matches.length === 0) return []

  const lookup = buildLookup(chunks, collection, wantlist)
  const groups = new Map<number, CreditGroup>()

  for (const match of matches) {
    for (const hit of hitsFor(lookup, match.releaseId)) {
      if (hit.kind !== 'artist') continue

      const existing = groups.get(hit.entityId)
      if (existing) {
        existing.matches.push(summarise(match, hit.role))
        continue
      }

      const discography = lookup.discography.get(hit.entityId)
      groups.set(hit.entityId, {
        entityId: hit.entityId,
        name: hit.name,
        owned: discography?.owned ?? 0,
        total: discography?.total ?? 0,
        matches: [summarise(match, hit.role)],
      })
    }
  }

  return (
    [...groups.values()]
      .filter((group) => group.matches.length >= MIN_MATCHES)
      // Sorted by how much of this person you already have, then by how much is
      // here. Somebody you own nine records of is a stronger thread than
      // somebody you own one of, whatever the shop happens to be holding.
      .sort(
        (a, b) =>
          b.owned - a.owned ||
          b.matches.length - a.matches.length ||
          a.name.localeCompare(b.name),
      )
      .map((group) => ({
        ...group,
        matches: group.matches.sort((a, b) => b.score - a.score),
      }))
  )
}

function summarise(match: Match, role: number) {
  return {
    listingId: match.listingId,
    releaseId: match.releaseId,
    title: [match.artist, match.title].filter(Boolean).join(' – ') || 'Unbekannt',
    score: match.score,
    price: match.price,
    currency: match.currency,
    // 0 is a main credit; everything else is production, remix, engineering.
    role: ROLE_TABLE[role] ?? 'Main',
  }
}
