import { sql } from 'drizzle-orm'
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

import { appSchema } from './_shared'
import { user } from './user'

/**
 * Mirror of the user's Discogs collection, TTL 24 h.
 *
 * Deliberately denormalised out of `basic_information` so that M2 works without
 * the catalog schema — the free signals (wantlist, artist, label) need nothing
 * but this table and the inventory page currently in flight.
 */
export const collectionItem = appSchema.table(
  'collection_item',
  {
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    discogsReleaseId: integer().notNull(),
    discogsMasterId: integer(),
    instanceId: bigint({ mode: 'number' }),
    folderId: integer(),
    rating: smallint(),
    addedAt: timestamp({ withTimezone: true }),
    title: text(),
    artistNames: text().array().notNull().default([]),
    artistIds: integer().array().notNull().default([]),
    labelNames: text().array().notNull().default([]),
    labelIds: integer().array().notNull().default([]),
    catnos: text().array().notNull().default([]),
    genres: text().array().notNull().default([]),
    styles: text().array().notNull().default([]),
    formats: text().array().notNull().default([]),
    year: smallint(),
    syncedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.discogsReleaseId] }),
    index().using('gin', t.artistIds),
    index().using('gin', t.labelIds),
    index().using('gin', t.styles),
  ],
)

export const wantlistItem = appSchema.table(
  'wantlist_item',
  {
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    discogsReleaseId: integer().notNull(),
    discogsMasterId: integer(),
    rating: smallint(),
    addedAt: timestamp({ withTimezone: true }),
    title: text(),
    artistNames: text().array().notNull().default([]),
    artistIds: integer().array().notNull().default([]),
    syncedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.discogsReleaseId] })],
)

/**
 * Barry's knowledge base. Recomputed after every collection sync, never during
 * a dig — a dig has a two-minute budget and none of it belongs here.
 *
 * "lift" = share in your collection / share globally. Above 1 means you collect
 * that thing on purpose rather than by accident.
 */
export const tasteProfile = appSchema.table('taste_profile', {
  userId: uuid()
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  computedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  releaseCount: integer().notNull(),
  artists: jsonb().notNull(),
  labels: jsonb().notNull(),
  styles: jsonb().notNull(),
  genres: jsonb().notNull(),
  decades: jsonb().notNull(),
  countries: jsonb().notNull(),
  credits: jsonb().notNull().default({}), // from M5
  styleCentroid: jsonb().notNull().default({}),
})

/**
 * Normalised name index for the fuzzy cascade against inventory strings, which
 * carry no IDs at all (docs/01-ARCHITEKTUR.md §9).
 */
export const tasteName = appSchema.table(
  'taste_name',
  {
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    kind: text().notNull(),
    discogsId: integer().notNull(),
    name: text().notNull(),
    nameNorm: text()
      .notNull()
      .generatedAlwaysAs(sql`app.norm(name)`),
    weight: real().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.kind, t.discogsId] }),
    check('taste_name_kind_check', sql`${t.kind} IN ('artist','label')`),
    index('taste_name_norm_trgm').using('gin', sql`${t.nameNorm} gin_trgm_ops`),
    index('taste_name_norm_exact').on(t.userId, t.kind, t.nameNorm),
  ],
)
