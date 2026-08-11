import type { CollectionItem, HorizonChunk, WantlistItem } from '#shared/types'

import { norm, splitArtists } from '../match/normalize'
import { containment } from '../match/trigram'
import type { Listing } from '../match'

import type { HorizonLookup } from './lookup'

/**
 * Stage two of the master/release two-step (docs/11 §4).
 *
 * Stage one is free: expanding an artist gives every `main_release` in one go,
 * which covers the pressing most people mean. What it misses is the other
 * pressings — the 1994 UK cut of a record whose main release is the 2017
 * reissue. Those live behind `/masters/{id}/versions`, one request each, and
 * paying for all of them up front would double the initial build.
 *
 * So they are paid for when a dig proves they matter: a listing that named an
 * artist or album the collection knows, and still did not match, is the exact
 * case a missing versions list explains. One request, and the horizon is
 * permanently better.
 *
 * The horizon grows with use — that is the design, not a workaround.
 */

/**
 * How much of the known album title has to appear in the listing's, before
 * this is worth a request.
 *
 * Containment, not similarity: a marketplace title is the album title with
 * things bolted on — "Dummy (Reissue)", "Dummy - 180g Gatefold" — and Jaccard
 * reads those as barely related because the decoration inflates the union.
 * Nine tenths means the album title must essentially be in there, while the
 * decoration costs nothing.
 */
export const TITLE_THRESHOLD = 0.9

/**
 * A title shorter than this is noise rather than evidence.
 *
 * Deliberately just a floor, not a cleverer guard. The obvious refinement —
 * also requiring the album to account for much of the *listing's* title —
 * was measured and thrown away: legitimate heavy decoration ("Dummy (2017
 * Reissue, 180g)") scores 0,23 backwards and a genuinely wrong match ("Hits"
 * inside "Greatest Hits Of Somebody Else") scores 0,16. Those bands overlap,
 * so the check would have been a knob tuned until a test passed rather than a
 * discriminator.
 *
 * What makes that acceptable: a false positive here costs exactly one request
 * — a master gets expanded that turns out not to help — and MAX_PER_DIG caps
 * how many a single dig can be wrong about.
 */
export const MIN_TITLE_LENGTH = 4

/**
 * How many misses one dig may turn into requests.
 *
 * Eight, because this runs after a scan that already spent two hundred, and a
 * near-miss is a guess: the listing might genuinely be nothing. A cap keeps a
 * wrong guess cheap and lets the next dig try the next eight.
 */
export const MAX_PER_DIG = 8

export interface NearMiss {
  masterId: number
  /** What made it look like it belonged, so the log can be read. */
  title: string
  releaseId: number
}

interface Known {
  masterId: number
  title: string
  normTitle: string
  artists: Set<string>
}

/**
 * Collects near misses while the scan streams past.
 *
 * Same shape as the fingerprint accumulator, and for the same reason: the
 * listings are in hand exactly once, and keeping twenty thousand of them to
 * look at afterwards would be 40 MB for a handful of master ids.
 *
 * A listing qualifies when it is *not* already in the horizon, names an artist
 * the collection knows, and its title reads like one of that artist's albums —
 * all three, because any one of them alone matches most of an inventory.
 */
export class NearMissAccumulator {
  readonly #known: Known[]
  readonly #expanded: Set<number>
  readonly #lookup: HorizonLookup
  readonly #found = new Map<number, NearMiss>()

  constructor(
    lookup: HorizonLookup,
    collection: CollectionItem[],
    wantlist: WantlistItem[],
    chunks: HorizonChunk[],
  ) {
    this.#lookup = lookup
    this.#known = knownAlbums(collection, wantlist)
    // Masters already expanded do not need expanding again.
    this.#expanded = new Set(
      chunks.filter((chunk) => chunk.kind === 'master').map((chunk) => chunk.entityId),
    )
  }

  /** True once there is nothing more to learn from this dig. */
  get full(): boolean {
    return this.#found.size >= MAX_PER_DIG || this.#known.length === 0
  }

  add(listing: Listing): void {
    if (this.full) return

    // Already in the horizon: whatever this is, it is not a gap.
    if (this.#lookup.byRelease.has(listing.releaseId)) return

    const artists = new Set(
      splitArtists(listing.artist ?? '')
        .map(norm)
        .filter(Boolean),
    )
    if (artists.size === 0) return

    const title = norm(listing.title)
    if (!title) return

    for (const album of this.#known) {
      if (this.#expanded.has(album.masterId) || this.#found.has(album.masterId)) continue
      if (![...artists].some((artist) => album.artists.has(artist))) continue
      if (containment(album.normTitle, title) < TITLE_THRESHOLD) continue

      this.#found.set(album.masterId, {
        masterId: album.masterId,
        title: album.title,
        releaseId: listing.releaseId,
      })
      return
    }
  }

  build(): NearMiss[] {
    return [...this.#found.values()]
  }
}

/** Every album the collection or wantlist knows, with a master to expand. */
function knownAlbums(collection: CollectionItem[], wantlist: WantlistItem[]): Known[] {
  const albums = new Map<number, Known>()

  for (const item of [...collection, ...wantlist]) {
    if (item.masterId <= 0 || albums.has(item.masterId)) continue

    const normTitle = norm(item.title)
    if (normTitle.length < MIN_TITLE_LENGTH) continue

    albums.set(item.masterId, {
      masterId: item.masterId,
      title: item.title,
      normTitle,
      artists: new Set(item.artistNorms.filter(Boolean)),
    })
  }

  return [...albums.values()]
}
