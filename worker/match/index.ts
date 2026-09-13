import { buildLookup, labelLift, type HorizonLookup } from '../horizon/lookup'
import type {
  CollectionItem,
  FollowedArtist,
  HorizonChunk,
  Kin,
  Signal,
  TasteProfile,
  WantlistItem,
} from '#shared/types'

import { matchesFormat, rankOf } from '#shared/format'
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

/** An artist the collection knows, under one of the names it knows them by. */
export interface ArtistEntry {
  /** The name on the shelf — what the sentence says, whatever the listing said. */
  name: string
  weight: number
  n: number
  /**
   * Set when the key is not the artist's own name but one from the lexicon:
   * "miss dinky" → Dinky, via the alias. The relation decides how sure the
   * match may be and what the sentence says.
   */
  via?: Kin
  /**
   * On the radar rather than on the shelf (M29).
   *
   * `n` is nought for these and the sentence must never count records — which
   * is why the signal is `ARTIST_FOLLOWED` and not `ARTIST_KNOWN` with a zero
   * in it. Everything else about the cascade is the same, lexicon included:
   * somebody who follows Exit North should be found by Exit North's aliases
   * too.
   */
  followed?: true
}

export interface MatchIndex {
  wantlistReleaseIds: Set<number>
  /** Release id → Discogs' 0–5 for the want, only where one was given (M20 #1). */
  wantPriority: Map<number, number>
  collectionReleaseIds: Set<number>
  /**
   * Normalised artist name → how much of the collection is that artist.
   *
   * Every name the collection knows an artist by, not only the one on the
   * shelf: the horizon's lexicon adds aliases, members and groups under the
   * same entry (docs/04 §S3, stage 0).
   *
   * **One stage does not see them.** A lexicon entry carries `via`, and the
   * single-token stage skips those: a whole name may be compared with an
   * alias, a fragment of one may not. See `matchArtist`.
   */
  artistWeight: Map<string, ArtistEntry>
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

/** Built once per dig, from data that only changes on sync. */
export function buildIndex(
  collection: CollectionItem[],
  wantlist: WantlistItem[],
  taste: TasteProfile | null,
  chunks: HorizonChunk[] = [],
  followed: FollowedArtist[] = [],
): MatchIndex {
  const artistWeight = new Map<string, ArtistEntry>()
  const labelWeight = new Map<string, { name: string; weight: number; n: number }>()

  for (const facet of Object.values(taste?.artists ?? {})) {
    const key = norm(facet.name)
    if (key.length > 0 && !isAnonymousArtist(key)) {
      artistWeight.set(key, { name: facet.name, weight: facet.weight, n: facet.n })
    }
  }

  /*
   * And the bands on the radar (M29) — after the shelf, never over it.
   *
   * If a followed artist turns out to be on the shelf as well, the shelf wins
   * and the entry stays an ARTIST_KNOWN: "you have 4 records by them" is the
   * truer sentence, and following is then a thing somebody can forget about.
   *
   * `weight` and `n` are nought, and both are evidence rather than score —
   * confidence is the cascade stage and nothing else, which is why a followed
   * artist can carry a weight of zero without scoring as nothing.
   */
  const followedById = new Map<number, FollowedArtist>()
  for (const artist of followed) {
    followedById.set(artist.artistId, artist)
    const key = norm(artist.name)
    if (key.length === 0 || isAnonymousArtist(key) || artistWeight.has(key)) continue
    artistWeight.set(key, { name: artist.name, weight: 0, n: 0, followed: true })
  }

  // The lexicon, after the names themselves: an alias that spells another
  // collected artist's name stays that artist. "Miss Dinky" is Dinky only
  // because the horizon expanded Dinky — an artist you own once has no chunk
  // and therefore no other names, which is the same line the horizon draws.
  for (const chunk of chunks) {
    if (chunk.kind !== 'artist' || !chunk.kin) continue
    const facet = taste?.artists[String(chunk.entityId)]
    // A followed artist is expanded like a collected one, so it has a chunk
    // and a lexicon of its own — Exit North under any of its spellings.
    const radar = facet ? null : followedById.get(chunk.entityId)
    if (!facet && !radar) continue
    for (const kin of chunk.kin) {
      const key = norm(kin.name)
      if (key.length === 0 || isAnonymousArtist(key) || artistWeight.has(key)) continue
      artistWeight.set(
        key,
        facet
          ? { name: facet.name, weight: facet.weight, n: facet.n, via: kin }
          : { name: radar!.name, weight: 0, n: 0, via: kin, followed: true },
      )
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
    wantPriority: new Map(
      wantlist.filter((item) => item.want > 0).map((item) => [item.releaseId, item.want]),
    ),
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

/**
 * How sure a stage may be about an entry.
 *
 * An alias is the same person, so the stage's own confidence stands. A member
 * or a group is a related act — Holger Czukay is not Can — and is never more
 * certain than the containment stage, whichever stage found it.
 */
function found(entry: ArtistEntry, stage: number): ArtistEntry & { confidence: number } {
  const related = entry.via !== undefined && entry.via.relation !== 'alias'
  return { ...entry, confidence: related ? Math.min(stage, 0.85) : stage }
}

/** The cascade from docs/04 §S3, cheapest stage first. */
function matchArtist(
  artist: string,
  index: MatchIndex,
): (ArtistEntry & { confidence: number }) | null {
  const normalised = norm(artist)
  if (normalised.length === 0 || isAnonymousArtist(normalised)) return null

  const exact = index.artistWeight.get(normalised)
  if (exact) return found(exact, 1)

  // "Kraftwerk / Neu!" is two artists in one field. Splitting on the separator
  // Discogs actually uses finds both, including the multi-word ones that a
  // single-token lookup could never match.
  for (const part of splitArtists(artist)) {
    const hit = index.artistWeight.get(part)
    if (hit) return found(hit, 0.85)
  }

  /*
   * Single tokens catch the rest: "Neu! 2" against "neu".
   *
   * **The lexicon is out of reach from here, since 2026-09-13.** A name from
   * the lexicon is already the weaker claim — Discogs' word that this is the
   * same person, not the name the record is under — and taking one word out
   * of a listing's artist string and looking *that* up stacks the two weakest
   * things the cascade does.
   *
   * What it cost: "The Mark & Clark Band" normalises to "mark & clark band",
   * whose tokens are mark, clark, band. Anne Clark carries "Clark" among her
   * name variations, so "clark" was a key, and a 1977 CBS band nobody in the
   * collection has ever heard of came back at 0,85 as "Clark ist Anne Clark —
   * du hast 10 Platten von Anne Clark". Reported from a real dig.
   *
   * A surname is not a name. `hit.via` is exactly the test for "this key is
   * not what the artist is called", and Miss Dinky still works: "dinky" is
   * Dinky's own name, so it has no `via`.
   */
  for (const token of tokens(normalised)) {
    const hit = index.artistWeight.get(token)
    if (hit && !hit.via) return found(hit, 0.85)
  }

  /*
   * Only what stages one and two missed reaches here.
   *
   * The lexicon stays in reach, unlike the stage above, and the difference is
   * the whole point: this compares a whole string with a whole name. Jaccard
   * cannot exceed the ratio of the two trigram counts, so "mark & clark band"
   * against "clark" is capped at 0,28 and never gets near the threshold —
   * while "Wuppdeckmischmampflo" against "Wuppdeckmischmampflow", one letter
   * short, is 0,95 and is exactly what this stage is for.
   */
  const fuzzy = index.artistTrigrams.best(normalised, 0.85)
  if (fuzzy) {
    const hit = index.artistWeight.get(fuzzy.value)
    if (hit) return found(hit, 0.7)
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
    // How much it is wanted rides along for the sentence — only where Discogs
    // has a number, so a want nobody rated says nothing rather than "0".
    const want = index.wantPriority.get(listing.releaseId)
    signals.push({
      type: 'WANTLIST_EXACT',
      confidence: 1,
      evidence: { releaseId: listing.releaseId, ...(want ? { want } : {}) },
    })
  }

  // S3 — an artist already in the collection, this release not. Or one on the
  // radar and nowhere on the shelf, which is a different sentence (M29).
  const artist = matchArtist(listing.artist, index)
  if (artist) {
    signals.push({
      type: artist.followed ? 'ARTIST_FOLLOWED' : 'ARTIST_KNOWN',
      // Confidence is the cascade stage and nothing else. An earlier version
      // scaled it by how many records you own of that artist, which sounds
      // reasonable and quietly broke the calibration table: "artist known
      // allein" has to be 48, and that assumes confidence 1.0. How many you
      // own belongs in the evidence and the sentence, not in the score.
      confidence: artist.confidence,
      evidence: {
        artist: artist.name,
        owned: artist.n,
        // Under which other name it was found, so the sentence can say
        // "Miss Dinky is Dinky" instead of claiming the listing said Dinky.
        ...(artist.via ? { via: artist.via.name, relation: artist.via.relation } : {}),
      },
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
  const actual = rankOf(condition)
  const wanted = rankOf(preference)
  if (actual === null || wanted === null) return false
  return actual > wanted
}
