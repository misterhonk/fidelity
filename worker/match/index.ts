import { buildLookup, labelLift, type HorizonLookup } from '../horizon/lookup'
import type {
  CollectionItem,
  HorizonChunk,
  Signal,
  TasteProfile,
  WantlistItem,
} from '#shared/types'

import { matchesFormat } from '#shared/format'
import {
  artistGap,
  catalogueRun,
  creditGraph,
  formatUpgrade,
  wantlistPressing,
} from './signals'
import { isAnonymousArtist, norm, splitArtists, tokens } from './normalize'
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
  /**
   * When the dealer listed it, ISO 8601, or null where Discogs omitted it.
   *
   * Not a matching signal — the scan carries it so a later visit can stop at
   * the first listing it has already seen.
   */
  postedAt: string | null
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
  /** Everything the horizon knows, or an empty one before it is built. */
  horizon: HorizonLookup
  /** Normalised label name → its Discogs id, for the lift. */
  labelIds: Map<string, number>
  /** Label id → records owned, the numerator of the lift. */
  ownedByLabel: Map<number, number>
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
  chunks: HorizonChunk[] = [],
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

  // Label ids, so the lift can be looked up from a listing's label string.
  const labelIds = new Map<string, number>()
  const ownedByLabel = new Map<number, number>()
  for (const item of collection) {
    const seen = new Set<number>()
    for (const [index, id] of item.labelIds.entries()) {
      if (seen.has(id)) continue
      seen.add(id)
      labelIds.set(norm(item.labelNames[index] ?? ''), id)
      ownedByLabel.set(id, (ownedByLabel.get(id) ?? 0) + 1)
    }
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
    horizon: buildLookup(chunks, collection, wantlist),
    labelIds,
    ownedByLabel,
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

  // "Kraftwerk / Neu!" is two artists in one field. Splitting on the separator
  // Discogs actually uses finds both, including the multi-word ones that a
  // single-token lookup could never match.
  for (const part of splitArtists(artist)) {
    const hit = index.artistWeight.get(part)
    if (hit) return { ...hit, confidence: 0.85 }
  }

  // Single tokens catch the rest: "Neu! 2" against "neu".
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
  const wantlistExact = index.wantlistReleaseIds.has(listing.releaseId)
  if (wantlistExact) {
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
      // Confidence is the cascade stage and nothing else. An earlier version
      // scaled it by how many records you own of that artist, which sounds
      // reasonable and quietly broke the calibration table: "Künstler bekannt
      // allein" has to be 48, and that assumes confidence 1.0. How many you
      // own belongs in the evidence and the sentence, not in the score.
      confidence: artist.confidence,
      evidence: { artist: artist.name, owned: artist.n },
    })
  }

  // S5 — a label the collection leans on.
  //
  // The lift, once the horizon can supply a catalogue size: how
  // over-represented the label is among the labels this collection buys from.
  // Confidence is min(1, log2(lift) / 3) and it fires from lift ≥ 2, per
  // docs/04 §S5. Without a horizon there is no denominator, and the collection
  // share stands in — true and useful, just a weaker statement.
  const normalisedLabel = listing.label ? norm(listing.label) : ''
  const label = normalisedLabel ? index.labelWeight.get(normalisedLabel) : undefined
  if (label && label.n >= 2) {
    const labelId = index.labelIds.get(normalisedLabel)
    const lift =
      labelId === undefined ? null : labelLift(index.horizon, labelId, index.ownedByLabel)

    if (lift !== null) {
      if (lift >= 2) {
        signals.push({
          type: 'LABEL_AFFINITY',
          confidence: Math.min(1, Math.log2(lift) / 3),
          evidence: { label: label.name, owned: label.n, lift },
        })
      }
    } else {
      signals.push({
        type: 'LABEL_AFFINITY',
        confidence: Math.min(1, label.weight * 4),
        evidence: { label: label.name, owned: label.n, share: label.weight },
      })
    }
  }

  // The five the horizon unlocks. Each is a lookup, none costs a request.
  const fromHorizon = [
    wantlistPressing(listing, index.horizon, wantlistExact),
    artistGap(listing, index.horizon),
    catalogueRun(listing, index.horizon),
    creditGraph(listing, index.horizon),
    formatUpgrade(listing, index.horizon, filters.formatsAllow),
  ]
  for (const signal of fromHorizon) {
    if (signal) signals.push(signal)
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

function isBelowPreference(condition: string | null, preference: string): boolean {
  if (!condition) return false
  const actual = CONDITION_RANK[condition]
  const wanted = CONDITION_RANK[preference]
  if (actual === undefined || wanted === undefined) return false
  return actual > wanted
}
