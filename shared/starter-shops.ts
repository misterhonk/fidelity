/**
 * Five shops for a device with none (M34.4).
 *
 * An empty shops screen used to offer a search box and a folded question
 * about the friends list — and nothing to look at. These are big, well rated
 * and ship across Europe; adding one costs one `/users/{u}` lookup, and it
 * stands on the list as "entered by hand" until a dig has been near it.
 *
 * Verified against `/users/{u}` on 2026-09-16 (listings · ratings · rating):
 * Juno_Records 44,820 · 59,546 · 100 %; decks.de 39,714 · 35,179 · 99.9 %;
 * fatplastics 2,866 · 7,680 · 99.9 %; clone.nl 2,326 · 1,133 · 100 %;
 * spirax.records 1,267 · 100 · 100 %. None suspended. Hand-picked, not an
 * endorsement: they are the first five that are large, old and reachable.
 */
export interface StarterShop {
  username: string
  displayName: string
  /** Discogs' English country name, as `ships_from` writes it. */
  shipsFrom: string
}

export const STARTER_SHOPS: StarterShop[] = [
  { username: 'Juno_Records', displayName: 'Juno Records', shipsFrom: 'United Kingdom' },
  { username: 'decks.de', displayName: 'decks.de', shipsFrom: 'Germany' },
  { username: 'fatplastics', displayName: 'fatplastics', shipsFrom: 'Germany' },
  { username: 'clone.nl', displayName: 'Clone', shipsFrom: 'Netherlands' },
  { username: 'spirax.records', displayName: 'spirax.records', shipsFrom: 'Germany' },
]
