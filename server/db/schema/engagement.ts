import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  integer,
  jsonb,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

import { appSchema } from './_shared'
import { dealer } from './dealer'
import { user } from './user'

export const watch = appSchema.table(
  'watch',
  {
    id: uuid()
      .primaryKey()
      .default(sql`app.uuid7()`),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    dealer: text()
      .notNull()
      .references(() => dealer.discogsUsername),
    minScore: smallint().notNull().default(60),
    cadenceHours: smallint().notNull().default(24),
    notifyPush: boolean().notNull().default(true),
    notifyEmail: boolean().notNull().default(false),
    lastRunAt: timestamp({ withTimezone: true }),
    nextRunAt: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [unique().on(t.userId, t.dealer)],
)

/**
 * Listing IDs only. No prices, no conditions — so the watchlist diff survives
 * the six-hour window without conflicting with it.
 */
export const watchSeen = appSchema.table(
  'watch_seen',
  {
    watchId: uuid()
      .notNull()
      .references(() => watch.id, { onDelete: 'cascade' }),
    listingId: bigint({ mode: 'number' }).notNull(),
    firstSeen: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.watchId, t.listingId] })],
)

export const basketItem = appSchema.table(
  'basket_item',
  {
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    dealer: text()
      .notNull()
      .references(() => dealer.discogsUsername),
    listingId: bigint({ mode: 'number' }).notNull(),
    addedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    note: text(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.listingId] })],
)

/** The only way Barry ever gets better. */
export const matchFeedback = appSchema.table(
  'match_feedback',
  {
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    listingId: bigint({ mode: 'number' }).notNull(),
    discogsReleaseId: integer().notNull(),
    verdict: text().notNull(),
    signals: jsonb().notNull(), // signal snapshot at the time of the verdict
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.listingId] }),
    check(
      'match_feedback_verdict_check',
      sql`${t.verdict} IN ('interesting','meh','wrong','bought')`,
    ),
  ],
)
