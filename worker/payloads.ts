import { z } from 'zod'

import { LISTEN_SERVICES } from '#shared/listen'
import {
  CONDITIONS,
  SIGNAL_TYPES,
  type Preferences,
  type PressingRules,
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

const pressingRule = z.object({
  firstOnly: z.boolean(),
  except: z.array(z.number().int().positive()),
  updatedAt: z.number().optional(),
})

/** Pressing rules from a file (#242): per master id; a malformed entry is dropped, not the lot. */
export function parsePressingRules(value: unknown): PressingRules | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const kept: PressingRules = {}
  for (const [master, rule] of Object.entries(value)) {
    const parsed = pressingRule.safeParse(rule)
    if (/^[1-9]\d*$/.test(master) && parsed.success) kept[Number(master)] = parsed.data
  }
  return Object.keys(kept).length > 0 ? kept : null
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
  pressingRules: z.unknown().optional().transform(parsePressingRules),
}) satisfies z.ZodType<VaultSnapshot>

/**
 * A find list somebody sent (#249). Strict about what it reads, and blind to
 * anything else: a price somebody slipped into a link is dropped, not shown.
 */
export const sharedDigSchema = z.object({
  version: z.number(),
  coverage: z.number(),
  matchesTotal: z.number(),
  matches: z.array(
    z.object({
      releaseId: z.number(),
      listingId: z.number(),
      score: z.number(),
      artist: z.string().nullable(),
      title: z.string().nullable(),
      label: z.string().nullable(),
      catno: z.string().nullable(),
      format: z.string().nullable(),
      year: z.number().nullable(),
      signals: z.array(
        z.object({
          type: z.enum(SIGNAL_TYPES),
          confidence: z.number(),
          evidence: z.record(z.string(), z.unknown()),
        }),
      ),
    }),
  ),
}) satisfies z.ZodType<SharedDig>
