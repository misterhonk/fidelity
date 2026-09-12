import type { CatalogueSource } from '#shared/ports'
import type { HorizonChunk } from '#shared/types'

import { packChunk } from '../horizon/pack'
import type { Candidate } from '../horizon/select'

/**
 * A horizon chunk from the catalogue, for one candidate (docs/16 §6, M21.5).
 *
 * The horizon build asks here before the hub and the API. What comes back
 * is the same shape the expansion would have built — packed by the same
 * `packChunk`, `catalogueSize` set — with two differences the engine does
 * not see: zero requests, and a label of any size. Blue Note's 4000s were
 * cut off at 1,500 releases on the API path; here they are whole.
 *
 * Null is "no catalogue" and "does not know" alike, and both mean the path
 * that always was. Nothing here is offered to the hub: the dump's answer is
 * the same for everybody, and the build date says how old it is.
 */
export async function chunkFromCatalogue(
  catalogue: CatalogueSource | null,
  candidate: Pick<Candidate, 'kind' | 'id' | 'name'>,
): Promise<HorizonChunk | null> {
  if (!catalogue) return null

  if (candidate.kind === 'label') return catalogue.run(candidate.id)
  if (candidate.kind === 'artist') return catalogue.credits(candidate.id)

  // A master's versions, as the expansion reads them: every pressing, the
  // year of each. The family is capped at 200 siblings, which is what the
  // API path pages to as well.
  const family = await catalogue.family(candidate.id)
  if (!family) return null
  const chunk = packChunk(
    'master',
    candidate.id,
    candidate.name,
    family.siblings.map((sibling) => ({
      releaseId: sibling.releaseId,
      role: 0,
      year: sibling.year ?? 0,
    })),
    {
      fetchedAt: family.fetchedAt,
      complete: family.siblings.length >= family.total,
      requests: 0,
    },
  )
  chunk.catalogueSize = family.total
  return chunk
}
