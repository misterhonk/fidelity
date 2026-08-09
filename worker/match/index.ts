import type { CollectionItem, Signal, TasteProfile, WantlistItem } from '#shared/types'

import { matchesFormat } from './format'
import { isAnonymousArtist, norm, tokens } from './normalize'
import { barryScore, MIN_STORED_SCORE, type ScoreContext } from './score'
import { TrigramIndex } from './trigram'

/**
 * The matching engine. Pure functions, no I/O, no database — that is what
 * makes it golden-file testable, and it is deliberate (CLAUDE.md).
 *
 * A dig calls this once per listing, up to 20.000 times, so everything
 * expensive happens once in buildIndex() and never in the loop.
 */

/** Just enough of an inventory listing to match on. The rest is discarded. */
export interface Listing {
  listingId: number
  releaseId: number
  title: string
  /** A string with no IDs, sometimes several artists at once. */
  artist: string
  /** A string, and only the FIRST label of a multi-label release. */
  label: string | null
  catno: string | null
  format: string | null
  year: number | null
  condition: string | null
  sleeve: string | null
  price: number | null
  currency: string | null
  shipsFrom: string | null
  comments: string | null
  thumbUrl: string | null
}

export interface MatchFilters {
  /** Format words that must appear, e.g. ['Vinyl']. Empty means anything. */
  formatsAllow: string[]
  maxPrice: number | null
  shipsFromBlock: string[]
  /** Below this the score is dampened, not discarded. */
  prefMediaCondition: string
  targetPrice: number | null
}

export interface MatchIndex {
  wantlistReleaseIds: Set<number>
  collectionReleaseIds: Set<number>
  /** Normalised artist name → how much of the collection is that artist. */
  artistWeight: Map<string, { name: string; weight: number; n: number }>
  labelWeight: Map<string, { name: string; weight: number; n: number }>
  /** Stage three of the cascade, prepared once. */
  artistTrigrams: TrigramIndex<string>
  releaseCount: number
}

const CONDITION_RANK: Record<string, number> = {
  'Mint (M)': 0,
  'Near Mint (NM or M-)': 1,
  'Very Good Plus (VG+)': 2,
  'Very Good (VG)': 3,
  'Good Plus (G+)': 4,
  'Good (G)': 5,
  'Fair (F)': 6,
  'Poor (P)': 7,
}

/** Built once per dig, from data that only changes on sync. */
export function buildIndex(
  collection: CollectionItem[],
  wantlist: WantlistItem[],
  taste: TasteProfile | null,
): MatchIndex {
  const artistWeight = new Map<string, { name: string; weight: number; n: number }>()
  const labelWeight = new Map<string, { name: string; weight: number; n: number }>()

  for (const facet of Object.values(taste?.artists ?? {})) {
    const key = norm(facet.name)
    if (key.length > 0 && !isAnonymousArtist(key)) {
      artistWeight.set(key, { name: facet.name, weight: facet.weight, n: facet.n })
    }
  }
  for (const facet of Object.values(taste?.labels ?? {})) {
    const key = norm(facet.name)
    if (key.length > 0)
      labelWeight.set(key, { name: facet.name, weight: facet.weight, n: facet.n })
  }

  return {
    wantlistReleaseIds: new Set(wantlist.map((item) => item.releaseId)),
    collectionReleaseIds: new Set(collection.map((item) => item.releaseId)),
    artistWeight,
    labelWeight,
    artistTrigrams: new TrigramIndex(
      [...artistWeight.keys()].map((key) => ({ key, value: key })),
    ),
    releaseCount: taste?.releaseCount ?? collection.length,
  }
}

/**
 * Hard filters, applied before scoring. A criterion is either a filter or a
 * dampener, never both — otherwise the dampener is dead code (docs/04 §2).
 */
export function passesFilters(
  listing: Listing,
  filters: MatchFilters,
  index: MatchIndex,
): boolean {
  // Owning it already is the most common reason to drop a listing, so it goes
  // first: it is one set lookup and it removes the most work.
  if (index.collectionReleaseIds.has(listing.releaseId)) return false

  if (!matchesFormat(listing.format, filters.formatsAllow)) return false

  if (filters.maxPrice !== null && listing.price !== null && listing.price > filters.maxPrice) {
    return false
  }

  if (listing.shipsFrom && filters.shipsFromBlock.includes(listing.shipsFrom)) return false

  return true
}

/** The cascade from docs/04 §S3, cheapest stage first. */
function matchArtist(
  artist: string,
  index: MatchIndex,
): { name: string; weight: number; n: number; confidence: number } | null {
  const normalised = norm(artist)
  if (normalised.length === 0 || isAnonymousArtist(normalised)) return null

  const exact = index.artistWeight.get(normalised)
  if (exact) return { ...exact, confidence: 1 }

  // "Kraftwerk / Neu!" contains "kraftwerk". Tokens are cheap; this is still
  // string work, not similarity work.
  for (const token of tokens(normalised)) {
    const hit = index.artistWeight.get(token)
    if (hit) return { ...hit, confidence: 0.85 }
  }

  // Only what stages one and two missed reaches here.
  const fuzzy = index.artistTrigrams.best(normalised, 0.85)
  if (fuzzy) {
    const hit = index.artistWeight.get(fuzzy.value)
    if (hit) return { ...hit, confidence: 0.7 }
  }

  return null
}

export interface MatchResult {
  signals: Signal[]
  score: number
}

export function evaluate(
  listing: Listing,
  index: MatchIndex,
  filters: MatchFilters,
  scoreContext: ScoreContext = {},
): MatchResult | null {
  if (!passesFilters(listing, filters, index)) return null

  const signals: Signal[] = []

  // S1 — the exact release is on the wantlist. Free, and confidence is always 1.
  if (index.wantlistReleaseIds.has(listing.releaseId)) {
    signals.push({
      type: 'WANTLIST_EXACT',
      confidence: 1,
      evidence: { releaseId: listing.releaseId },
    })
  }

  // S3 — an artist already in the collection, this release not.
  const artist = matchArtist(listing.artist, index)
  if (artist) {
    signals.push({
      type: 'ARTIST_KNOWN',
      // Someone you own twelve records by counts more than someone you own
      // one by, so the collection weight scales the confidence.
      confidence: artist.confidence * ownershipFactor(artist.n),
      evidence: { artist: artist.name, owned: artist.n },
    })
  }

  // S5 — a label the collection leans on.
  //
  // docs/04 §S5 defines this over lift, which needs a global denominator the
  // client cannot reach before the horizon exists (M5). Until then the share
  // within the collection is what is actually knowable: "five of your
  // twenty-nine records are Border Community" is true and useful, it is just
  // not the same statement as "nine times the average".
  const label = listing.label ? index.labelWeight.get(norm(listing.label)) : undefined
  if (label && label.n >= 2) {
    signals.push({
      type: 'LABEL_AFFINITY',
      confidence: Math.min(1, label.weight * 4),
      evidence: { label: label.name, owned: label.n, share: label.weight },
    })
  }

  if (signals.length === 0) return null

  const score = barryScore(signals, {
    ...scoreContext,
    conditionBelowPreference: isBelowPreference(listing.condition, filters.prefMediaCondition),
    priceAboveTarget:
      filters.targetPrice !== null &&
      listing.price !== null &&
      listing.price > filters.targetPrice,
  })

  return score >= MIN_STORED_SCORE ? { signals, score } : null
}

/** Twelve records by someone means more than one, with diminishing returns. */
function ownershipFactor(owned: number): number {
  return Math.min(1, 0.6 + 0.1 * Math.log2(owned + 1))
}

function isBelowPreference(condition: string | null, preference: string): boolean {
  if (!condition) return false
  const actual = CONDITION_RANK[condition]
  const wanted = CONDITION_RANK[preference]
  if (actual === undefined || wanted === undefined) return false
  return actual > wanted
}
