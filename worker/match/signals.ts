import { hitsFor, type HorizonLookup } from '../horizon/lookup'
import { parseCatno } from '../horizon/pack'
import type { Signal } from '#shared/types'

import { matchesFormat, sameMedium } from './format'

/**
 * The five signals the horizon unlocks (docs/04 §3, S2/S4/S6/S8/S9).
 *
 * Each one is a pure function of a listing and the lookup. None of them costs
 * a request: the expansion already paid for all of it.
 */

export interface SignalInput {
  releaseId: number
  catno: string | null
  format: string | null
  year: number | null
}

/** S2 — same album, different pressing. */
export function wantlistPressing(
  listing: SignalInput,
  lookup: HorizonLookup,
  alreadyExact: boolean,
): Signal | null {
  // The exact match is the stronger statement; it would only compete with it.
  if (alreadyExact) return null

  for (const hit of hitsFor(lookup, listing.releaseId)) {
    if (hit.kind !== 'master') continue
    const wanted = lookup.wantlistMasters.get(hit.entityId)
    if (!wanted) continue

    // A pressing much younger than the one on the wantlist is probably a
    // reissue, and a reissue is not what was asked for (docs/04 §S2).
    const listingYear = listing.year ?? hit.year
    const suspiciouslyLate =
      wanted.year > 0 && listingYear > 0 && listingYear - wanted.year >= 15

    return {
      type: 'WANTLIST_PRESSING',
      confidence: suspiciouslyLate ? 0.6 : 0.9,
      // The master id travels along so a wantlist screen can say "this album
      // turned up at a dealer" even when the pressing offered was a different
      // one — which is the entire point of this signal.
      evidence: {
        masterId: hit.entityId,
        album: wanted.title,
        wantedYear: wanted.year,
        pressingYear: listingYear,
      },
    }
  }

  return null
}

/** Somebody whose records you own also worked on this one. */
export function creditGraph(listing: SignalInput, lookup: HorizonLookup): Signal | null {
  for (const hit of hitsFor(lookup, listing.releaseId)) {
    // role 0 is a main credit — that is S3's business, not this one.
    if (hit.kind !== 'artist' || hit.role === 0) continue

    const discography = lookup.discography.get(hit.entityId)
    return {
      type: 'CREDIT_GRAPH',
      confidence: 1,
      evidence: { person: hit.name, role: hit.role, owned: discography?.owned ?? 0 },
    }
  }

  return null
}

/** The gap ratio below which an incomplete run is not interesting. */
export const MIN_GAP_RATIO = 0.5

/** Fewer than this and there is no run to be completing. */
export const MIN_GAP_OWNED = 3

/**
 * S4 — you have four of six, this is the fifth.
 *
 * Psychologically the strongest card in the deck, and the one most easily
 * abused: it only counts main credits, and only inside the years you actually
 * collect that artist in.
 */
export function artistGap(listing: SignalInput, lookup: HorizonLookup): Signal | null {
  for (const hit of hitsFor(lookup, listing.releaseId)) {
    if (hit.kind !== 'artist' || hit.role !== 0) continue

    const discography = lookup.discography.get(hit.entityId)
    if (!discography || discography.owned < MIN_GAP_OWNED || discography.total === 0) continue

    const year = listing.year ?? hit.year
    const inWindow =
      discography.from === 0 ||
      year === 0 ||
      (year >= discography.from - 2 && year <= discography.to + 2)
    if (!inWindow) continue

    const ratio = discography.owned / discography.total
    if (ratio < MIN_GAP_RATIO) continue

    return {
      type: 'ARTIST_GAP',
      confidence: Math.min(1, ratio),
      evidence: {
        artist: discography.name,
        owned: discography.owned,
        total: discography.total,
      },
    }
  }

  return null
}

/** How far from an owned number a release still counts as part of the run. */
export const RUN_WINDOW = 30

/** How many of the surrounding series you need before it is a series to you. */
export const MIN_RUN_OWNED = 3

/**
 * S6 — the catalogue series. Blue Note's 4000s, Brain's 1000s, Factory's FAC-.
 *
 * A series only exists if you are already collecting it, so the test is
 * whether this number sits among ones you own, not merely whether the label
 * has a series at all.
 */
export function catalogueRun(listing: SignalInput, lookup: HorizonLookup): Signal | null {
  const parsed = parseListingCatno(listing.catno)
  if (!parsed) return null

  for (const hit of hitsFor(lookup, listing.releaseId)) {
    if (hit.kind !== 'label') continue

    const run = lookup.runs.get(`${hit.entityId}:${parsed.prefix}`)
    if (!run || run.owned.has(parsed.num)) continue

    const nearby = [...run.owned].filter((owned) => Math.abs(owned - parsed.num) <= RUN_WINDOW)
    if (nearby.length < MIN_RUN_OWNED) continue

    const window = run.numbers.filter((num) => Math.abs(num - parsed.num) <= RUN_WINDOW)
    const coverage = window.length > 0 ? nearby.length / window.length : 0

    return {
      type: 'CATALOG_RUN',
      confidence: Math.min(1, Math.max(0.5, coverage)),
      evidence: {
        label: run.label,
        prefix: run.prefix,
        number: parsed.num,
        owned: nearby.length,
        inRun: window.length,
      },
    }
  }

  return null
}

/** S9 — you own it, but not on this medium. */
export function formatUpgrade(
  listing: SignalInput,
  lookup: HorizonLookup,
  preferredFormats: string[],
): Signal | null {
  // Only an upgrade if this copy is the format you actually want.
  if (!matchesFormat(listing.format, preferredFormats)) return null

  for (const hit of hitsFor(lookup, listing.releaseId)) {
    if (hit.kind !== 'master') continue

    const owned = lookup.upgradeMasters.get(hit.entityId)
    if (!owned) continue

    // And only if it is a *different* medium. The preference check above
    // cannot carry this on its own: with no preference set it passes
    // everything, and the CD of a record you already have on CD would be
    // offered as an upgrade to itself.
    if (owned.formats.some((format) => sameMedium(listing.format, format))) return null

    return {
      type: 'FORMAT_UPGRADE',
      confidence: 1,
      evidence: { album: owned.title, ownedAs: owned.formats.join(', ') },
    }
  }

  return null
}

/**
 * A listing's own catalogue number, read by the horizon's parser.
 *
 * Shared rather than copied: the two have to agree exactly or a record lands
 * in a series the collection was indexed under a different prefix.
 */
function parseListingCatno(catno: string | null): { prefix: string; num: number } | null {
  return parseCatno(catno ?? undefined)
}
