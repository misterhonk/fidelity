import { describe, expect, it } from 'vitest'

import collectionJson from '../fixtures/golden/collection.json'
import horizonJson from '../fixtures/golden/horizon.json'
import inventoryJson from '../fixtures/golden/inventory.json'
import wantlistJson from '../fixtures/golden/wantlist.json'

import type { CollectionItem, HorizonChunk, WantlistItem } from '#shared/types'
import { buildIndex, evaluate, type Listing } from '~~/worker/match'
import { computeTasteProfile } from '~~/worker/match/taste'

/**
 * CLAUDE.md: 20,000 synthetic listings score in under 250 ms.
 *
 * The golden universe, widened to a collection of a couple of thousand
 * records, and a shop of 20,000 that is mostly strangers — some misspelt
 * relatives of the shelf, so the fuzzy stages run, and the golden shelf
 * repeated so every signal fires somewhere.
 */

const golden = collectionJson as unknown as CollectionItem[]
const inventory = inventoryJson as unknown as Listing[]
const horizon = (horizonJson as unknown as Record<string, unknown>[]).map(
  (chunk) =>
    ({
      ...chunk,
      releaseIds: Int32Array.from(chunk.releaseIds as number[]),
      roles: Uint8Array.from(chunk.roles as number[]),
      years: Int16Array.from(chunk.years as number[]),
      ...(chunk.catnoNums ? { catnoNums: Int32Array.from(chunk.catnoNums as number[]) } : {}),
    }) as unknown as HorizonChunk,
)

// Deterministic, so a slow run is the code and not the dice.
let state = 42
const random = () => (state = (state * 1103515245 + 12345) % 2 ** 31) / 2 ** 31
const pick = (letters: string) => letters[Math.floor(random() * letters.length)]!
// Consonant-vowel pairs from the whole alphabet: names as varied in their trigrams as real ones.
const word = () =>
  Array.from(
    { length: 2 + Math.floor(random() * 3) },
    () => pick('bcdfghjklmnprstvwz') + pick('aeiou'),
  ).join('')
const name = () => `${word()} ${word()}`

const artists = Array.from({ length: 800 }, name)
const labels = Array.from({ length: 300 }, word)

const collection: CollectionItem[] = [
  ...golden,
  ...Array.from({ length: 2000 }, (_, i) => {
    const artist = artists[i % artists.length]!
    const label = labels[i % labels.length]!
    return {
      ...golden[0]!,
      releaseId: 1_000_000 + i,
      title: word(),
      artistIds: [2_000_000 + (i % artists.length)],
      artistNorms: [artist],
      artistNames: [artist],
      labelIds: [3_000_000 + (i % labels.length)],
      labelNorms: [label],
      labelNames: [label],
    }
  }),
]

const listings: Listing[] = Array.from({ length: 20_000 }, (_, i) => {
  if (i % 10 === 0) return { ...inventory[i % inventory.length]!, listingId: 5_000_000 + i }
  const known = random() < 0.2
  const artist = known ? artists[Math.floor(random() * artists.length)]! : name()
  return {
    ...inventory[0]!,
    listingId: 5_000_000 + i,
    releaseId: 6_000_000 + i,
    title: word(),
    // A dropped letter now and then, for the trigram stage.
    artist: known && random() < 0.5 ? artist.slice(1) : artist,
    label: labels[Math.floor(random() * labels.length)]!,
  }
})

const index = buildIndex(
  collection,
  wantlistJson as unknown as WantlistItem[],
  computeTasteProfile(collection, 0),
  horizon,
)
const filters = {
  formatsAllow: [],
  maxPrice: null,
  shipsFromBlock: [],
  prefMediaCondition: 'Very Good (VG)' as const,
  targetPrice: null,
  currency: 'EUR',
}

const scoreAll = () => listings.filter((listing) => evaluate(listing, index, filters)).length

describe('scoring speed', () => {
  it('scores 20,000 listings in under 250 ms', () => {
    const found = scoreAll() // warm-up: lets the JIT compile the hot path
    const started = performance.now()
    scoreAll()
    const elapsed = performance.now() - started

    expect(found).toBeGreaterThan(0)
    expect(elapsed).toBeLessThan(250)
  })
})
