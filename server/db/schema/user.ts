import { sql } from 'drizzle-orm'
import {
  boolean,
  char,
  integer,
  jsonb,
  numeric,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

import { appSchema, bytea } from './_shared'

export const user = appSchema.table('user', {
  id: uuid()
    .primaryKey()
    .default(sql`app.uuid7()`),
  discogsUserId: integer().notNull().unique(),
  discogsUsername: text().notNull(),
  displayName: text(),
  avatarUrl: text(),
  // Encrypted at rest, key from NUXT_TOKEN_KEY. Discogs access tokens never
  // expire and carry no scopes — they are full account access.
  oauthTokenEnc: bytea().notNull(),
  oauthSecretEnc: bytea().notNull(),
  currency: char({ length: 3 }).notNull().default('EUR'),
  shipsToCountry: text().notNull().default('Germany'),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp({ withTimezone: true }),
})

export const session = appSchema.table('session', {
  id: uuid()
    .primaryKey()
    .default(sql`app.uuid7()`),
  userId: uuid()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  userAgent: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

/** No open registration in phase 1 — access is by invite only. */
export const invite = appSchema.table('invite', {
  code: text().primaryKey(),
  createdBy: uuid().references(() => user.id),
  usedBy: uuid().references(() => user.id),
  usedAt: timestamp({ withTimezone: true }),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
})

/**
 * The filter baseline. Soft preferences dampen a match's score, hard limits
 * drop the listing before scoring (docs/04-MATCHING-ENGINE.md §2).
 */
export const userPreference = appSchema.table('user_preference', {
  userId: uuid()
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  // soft — below this we dampen, we do not discard
  prefMediaCond: text().notNull().default('Very Good Plus (VG+)'),
  prefSleeveCond: text().notNull().default('Very Good (VG)'),
  targetPrice: numeric({ precision: 10, scale: 2 }),
  // hard — above/below this the listing is discarded
  maxPrice: numeric({ precision: 10, scale: 2 }),
  minSellerRating: numeric({ precision: 4, scale: 1 }).notNull().default('98.0'),
  shipsFromAllow: text().array(),
  shipsFromBlock: text().array(),
  formatsAllow: text().array().notNull().default(['Vinyl']),
  excludeReissues: boolean().notNull().default(false),
  signalWeights: jsonb().notNull().default({}),
})
