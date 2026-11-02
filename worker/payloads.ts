import { z } from 'zod'

import { isHttps, LISTEN_SERVICES } from '#shared/listen'
import {
  CONDITIONS,
  SIGNAL_TYPES,
  type Match,
  type Preferences,
  type SharedDig,
  type VaultSnapshot,
} from '#shared/types'

/**
 * What arrives from somewhere this device does not control (#207).
 *
 * A shared link, a vault block another device sealed, a backup somebody
 * picked. Authentic is not the same as well-formed — a key opens whatever the
 * other side put in — so each of them is parsed here, not cast.
 */

/**
 * Per preference, the type it must have.
 *
 * `hubUrl`, `catalogueUrl`, `hubSecret` and `accessKey` are absent on purpose:
 * where this device's hub lives, and its keys, are entered on this device and
 * never come from a file or another device. Unknown keys are dropped with them.
 */
const PREFERENCE_FIELDS = {
  prefMediaCondition: z.enum(CONDITIONS),
  targetPrice: z.number().nullable(),
  maxPrice: z.number().nullable(),
  minSellerRating: z.number(),
  formatsAllow: z.array(z.string()),
  shipsFromBlock: z.array(z.string()),
  excludeReissues: z.boolean(),
  currency: z.string(),
  shipsToCountry: z.string(),
  importFriends: z.boolean(),
  audioPreview: z.boolean(),
  listenService: z.enum(LISTEN_SERVICES),
  vaultTarget: z.enum(['none', 'hub', 'file', 'dropbox', 'drive']),
  vaultSyncedAt: z.number().nullable(),
  vaultRemember: z.boolean(),
  cloudClientIds: z.object({ dropbox: z.string().optional(), drive: z.string().optional() }),
  updatedAt: z.number(),
} satisfies { [K in keyof Preferences]?: z.ZodType<Preferences[K]> }

/**
 * Field by field: one setting of the wrong type is dropped, the rest kept —
 * a whole vault refused over one knob would stop the sync for good.
 */
export function parsePreferences(value: unknown): Partial<Preferences> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const kept: Record<string, unknown> = {}
  for (const [key, schema] of Object.entries(PREFERENCE_FIELDS)) {
    if (!(key in record)) continue
    const parsed = schema.safeParse(record[key])
    if (parsed.success) kept[key] = parsed.data
  }
  return kept as Partial<Preferences>
}

/** A key IndexedDB can put a row under. */
const rowKey = z.union([z.number(), z.string().min(1)])

/**
 * Each store's row: its key, and the fields later code reads without checking.
 * Loose, so the rest of the row passes through untouched.
 */
export const ROW_SCHEMAS = {
  collection: z.looseObject({ instanceId: z.number() }),
  wantlist: z.looseObject({ releaseId: rowKey }),
  dealers: z.looseObject({ username: rowKey, shippingTiers: z.array(z.unknown()) }),
  feedback: z.looseObject({ listingId: rowKey }),
  basket: z.looseObject({ listingId: rowKey }),
  places: z.looseObject({ id: rowKey }),
  placements: z.looseObject({
    instanceId: rowKey,
    paid: z
      .object({
        cents: z.number().int().nonnegative(),
        currency: z.string().regex(/^[A-Z]{3}$/),
      })
      .nullish(),
    arrivedOn: z.iso.date().nullish(),
  }),
  valueHistory: z.looseObject({ day: rowKey }),
  followed: z.looseObject({ artistId: rowKey }),
  watched: z.looseObject({ releaseId: rowKey, points: z.array(z.unknown()) }),
} as const

export type RowStore = keyof typeof ROW_SCHEMAS

function isRowStore(store: string): store is RowStore {
  return Object.hasOwn(ROW_SCHEMAS, store)
}

/**
 * A vault snapshot. The envelope must be right; rows that are not are dropped,
 * because the database would refuse them halfway through `applySnapshot`.
 */
export const vaultSnapshotSchema = z.object({
  savedAt: z.number(),
  preferences: z.unknown().transform(parsePreferences),
  stores: z.record(z.string(), z.array(z.unknown())).transform((stores) =>
    Object.fromEntries(
      Object.entries(stores)
        .filter(([store]) => isRowStore(store))
        .map(([store, rows]) => [
          store,
          rows.filter((row) => ROW_SCHEMAS[store as RowStore].safeParse(row).success),
        ]),
    ),
  ),
}) satisfies z.ZodType<VaultSnapshot>

/** An address from the other side: kept when it is https, nothing otherwise. */
const httpsOrNull = z.unknown().transform((url) => (isHttps(url) ? url : null))

const matchSchema = z.looseObject({
  digId: z.string(),
  listingId: z.number(),
  releaseId: z.number(),
  score: z.number(),
  signals: z.array(
    z.object({
      type: z.enum(SIGNAL_TYPES),
      confidence: z.number(),
      evidence: z.record(z.string(), z.unknown()),
    }),
  ),
  title: z.string().nullable(),
  artist: z.string().nullable(),
  label: z.string().nullable(),
  catno: z.string().nullable(),
  format: z.string().nullable(),
  year: z.number().nullable(),
  condition: z.string().nullable(),
  sleeve: z.string().nullable(),
  price: z.number().nullable(),
  currency: z.string().nullable(),
  comments: z.string().nullable(),
  thumbUrl: httpsOrNull,
  marketLowestPrice: z.number().nullable(),
  marketNumForSale: z.number().nullable(),
  videos: z
    .array(z.object({ title: z.string(), uri: z.string() }))
    .transform((videos) => videos.filter((video) => isHttps(video.uri)))
    .optional(),
  expired: z.boolean(),
})

/**
 * A find list somebody sent. What the shared page reads is checked; the rest
 * of each match (pressing details and the like) rides along as it came.
 */
export const sharedDigSchema = z.object({
  version: z.number(),
  dealer: z.string(),
  scannedAt: z.number(),
  expiresAt: z.number(),
  coverage: z.number(),
  listingsTotal: z.number(),
  matchesTotal: z.number(),
  // shortcut: the unchecked rest of a Match is cast, upgrade when the shared page reads more of it.
  matches: z.array(matchSchema).transform((matches) => matches as unknown as Match[]),
}) satisfies z.ZodType<SharedDig>
