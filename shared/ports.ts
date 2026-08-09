/**
 * The only places an optional hub can plug in (ADR-008, docs/13-HUB-ADDON.md §3).
 *
 * Three rules hold this design up, and all three are enforced here rather than
 * remembered:
 *
 *   1. No feature may require a hub. It makes things faster, never possible.
 *   2. The hub never sees a Discogs token.
 *   3. The hub never scans inventories — it has one IP, and all users would
 *      share its 60 req/min again.
 *
 * These interfaces exist now, with local implementations behind them, because
 * retrofitting them in M9 would be a refactor across the whole worker.
 */
import type { HorizonChunk, HorizonKind, ShippingTier } from './types'

export interface HorizonSource {
  /** Edges for one entity. A hub is asked first; the API is the fallback. */
  fetch(kind: HorizonKind, id: number): Promise<HorizonChunk | null>
  /** Offer what we expanded ourselves. No-op without a hub. */
  contribute?(chunk: HorizonChunk): Promise<void>
}

export interface ShippingProfileSource {
  get(dealer: string, toCountry: string): Promise<ShippingTier[] | null>
  contribute?(dealer: string, toCountry: string, tiers: ShippingTier[]): Promise<void>
}

export interface WatchAlert {
  dealer: string
  /** Listings seen now that were not there at the last check. */
  newListings: number
  seenAt: number
}

export interface WatchService {
  /** Without a hub: checked at app start. With a hub: push. */
  register(dealers: string[]): Promise<void>
  pending(): Promise<WatchAlert[]>
}
