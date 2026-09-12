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
import type {
  HorizonChunk,
  HorizonKind,
  Kin,
  PressingFamilyFacts,
  ShippingTier,
  WatchAlert,
} from './types'

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

export interface WatchService {
  /** Without a hub: checked at app start. With a hub: push. */
  register(dealers: string[]): Promise<void>
  pending(): Promise<WatchAlert[]>
}

export type { WatchAlert }

/**
 * The catalogue service (ADR-013, docs/16 §6): the CC0 dump, built monthly,
 * answering what the API cannot answer cheaply. Rule 1 of ADR-013 in a type:
 * every method answers null for "not configured" and "does not know" alike,
 * and every consumer has the horizon behind it. Nothing here ever throws
 * upward; a dead catalogue costs two seconds, once per call, and is silent.
 */
export interface CatalogueArtist {
  id: number
  name: string
  /** Every other name, the same person first — the lexicon's shape. */
  names: Kin[]
}

export interface CatalogueSource {
  /** The build date of what answers, e.g. "2026-09-01" — or null when nothing does. */
  build(): Promise<string | null>
  artist(id: number): Promise<CatalogueArtist | null>
  /** Every release credited to this person in this role, as a horizon chunk. */
  credits(id: number, role: string): Promise<HorizonChunk | null>
  /** The label's catalogue series under this prefix, as a horizon chunk. */
  run(labelId: number, prefix: string): Promise<HorizonChunk | null>
  family(masterId: number): Promise<PressingFamilyFacts | null>
  /** Release ids carrying this barcode or run-out; `exact` when the whole string matched. */
  identify(query: { barcode?: string; runout?: string }): Promise<number[] | null>
  resolve(name: string): Promise<number[] | null>
}

/**
 * Where a device keeps the block that carries it between devices.
 *
 * Three destinations are planned and they differ in exactly one way that
 * matters — where the bytes end up. Everything above this line is the same for
 * all of them: what is written is already ciphertext, and what is read has to
 * be merged rather than trusted.
 *
 * `available()` exists because one of them cannot work everywhere. The File
 * System Access API is absent from WebKit, so the file target is unavailable
 * on every browser on an iPhone — and a setup screen that offers it there
 * would be lying.
 */
export interface VaultTargetPort {
  /** Whether this device can use it at all, right now. */
  available(): boolean | Promise<boolean>
  /** The block as last written, or null when there is none yet. */
  read(): Promise<unknown | null>
  write(sealed: unknown): Promise<void>
  /** One line for the screen: which destination, and where exactly. */
  describe(): string
}
