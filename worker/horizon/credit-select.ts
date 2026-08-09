import type { CreditHarvest, CreditPerson } from '#shared/types'

import type { Candidate } from './select'

/**
 * Which harvested people are worth expanding.
 *
 * Split out from the harvest itself so that building a horizon does not pull
 * in the harvest's fetch path and its Zod schema. The horizon is what the
 * worker needs before the first scan; reading credits is something somebody
 * starts later, from a screen, on purpose.
 */

/**
 * How many harvested records a person has to appear on.
 *
 * docs/11 §3 says "Lift ≥ 3", and a lift needs a baseline — how often this
 * person turns up in music at large — which no browser can measure and which
 * the label lift only has because catalogue sizes come free with the
 * expansion. A person's discography size would too, but only *after* deciding
 * to expand them, which is the decision this makes.
 *
 * So it is a plain count, and the doc's number is kept: three of your
 * favourites is a hand, not a coincidence.
 */
export const MIN_APPEARANCES = 3

/**
 * Anybody already reachable as an artist candidate is left out — expanding
 * them twice would be the same chunk under the same key.
 */
export function creditCandidates(
  harvest: CreditHarvest | null,
  alreadySelected: Set<number>,
): Candidate[] {
  if (!harvest) return []

  return harvest.people
    .filter((person) => person.appearances >= MIN_APPEARANCES)
    .filter((person) => !alreadySelected.has(person.entityId))
    .sort((a, b) => b.appearances - a.appearances || a.name.localeCompare(b.name))
    .map((person: CreditPerson) => ({
      kind: 'artist' as const,
      id: person.entityId,
      name: person.name,
      owned: person.appearances,
    }))
}
