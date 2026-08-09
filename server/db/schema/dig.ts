import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  char,
  index,
  integer,
  jsonb,
  numeric,
  real,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

import { appSchema, digStatus } from './_shared'
import { dealer } from './dealer'
import { user } from './user'

export const dig = appSchema.table(
  'dig',
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
    status: digStatus().notNull().default('queued'),
    startedAt: timestamp({ withTimezone: true }),
    finishedAt: timestamp({ withTimezone: true }),
    /**
     * The six-hour rule as a column, not as a policy in somebody's head.
     * Marketplace content may not be displayed once it is older than this.
     */
    expiresAt: timestamp({ withTimezone: true })
      .notNull()
      .default(sql`now() + interval '6 hours'`),
    listingsTotal: integer(), // what the dealer has according to the API
    listingsScanned: integer().notNull().default(0),
    pagesFetched: integer().notNull().default(0),
    coverage: real(), // scanned / total
    truncated: boolean().notNull().default(false), // hit the 10k wall?
    matchCount: integer().notNull().default(0),
    apiRequests: integer().notNull().default(0),
    error: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index().on(t.userId, t.createdAt.desc()),
    index()
      .on(t.expiresAt)
      .where(sql`${t.status} = 'done'`),
  ],
)

export const digMatch = appSchema.table(
  'dig_match',
  {
    id: uuid()
      .primaryKey()
      .default(sql`app.uuid7()`),
    digId: uuid()
      .notNull()
      .references(() => dig.id, { onDelete: 'cascade' }),

    listingId: bigint({ mode: 'number' }).notNull(),
    discogsReleaseId: integer().notNull(),
    title: text().notNull(),
    artistString: text().notNull(),
    labelString: text(),
    catno: text(),
    formatString: text(),
    year: smallint(),

    // Every marketplace field below is nullable on purpose: the hourly cleanup
    // job nulls them once the dig expires. With NOT NULL it would fail on every
    // run and the six-hour rule would never actually be enforced.
    condition: text(),
    sleeveCondition: text(),
    price: numeric({ precision: 10, scale: 2 }),
    currency: char({ length: 3 }),
    comments: text(),
    thumbUrl: text(),
    marketLowestPrice: numeric({ precision: 10, scale: 2 }),
    marketNumForSale: integer(),

    // Ours, derived — no Discogs content, so it survives the cleanup.
    score: smallint().notNull(),
    signals: jsonb().notNull(), // [{ type, confidence, weight, evidence }]
    reason: text().notNull(), // the Barry sentence
    expired: boolean().notNull().default(false),
  },
  (t) => [
    unique().on(t.digId, t.listingId),
    index().on(t.digId, t.score.desc()),
    index('dig_match_signals_gin').using('gin', sql`${t.signals} jsonb_path_ops`),
  ],
)
