import { sql } from 'drizzle-orm'
import {
  char,
  check,
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

import { appSchema } from './_shared'
import { user } from './user'

export const dealer = appSchema.table('dealer', {
  discogsUsername: text().primaryKey(),
  discogsUserId: integer(),
  displayName: text(),
  shipsFrom: text(),
  sellerRating: numeric({ precision: 4, scale: 1 }),
  sellerRatingCount: integer(),
  numForSale: integer(),
  minOrderTotal: numeric({ precision: 10, scale: 2 }),
  shippingNote: text(), // free text from seller.shipping
  firstSeenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  lastScannedAt: timestamp({ withTimezone: true }),
})

/**
 * Shipping ladders are crowdsourced: maintained once by anybody, useful to
 * everybody. `shipping_price` in the inventory API is empty for most dealers,
 * so this table is the only reliable source (docs/00-KONZEPT.md §7).
 */
export const dealerShippingTier = appSchema.table(
  'dealer_shipping_tier',
  {
    id: uuid()
      .primaryKey()
      .default(sql`app.uuid7()`),
    dealer: text()
      .notNull()
      .references(() => dealer.discogsUsername, { onDelete: 'cascade' }),
    toCountry: text().notNull(),
    minItems: smallint().notNull(),
    maxItems: smallint(), // NULL = open ended
    price: numeric({ precision: 10, scale: 2 }).notNull(),
    currency: char({ length: 3 }).notNull(),
    source: text().notNull(),
    contributedBy: uuid().references(() => user.id),
    verifiedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    unique().on(t.dealer, t.toCountry, t.minItems),
    check('dealer_shipping_tier_source_check', sql`${t.source} IN ('user','parsed','api')`),
  ],
)

/**
 * "The Clerk's Take" — derived statistics, not marketplace content, so this may
 * outlive the six-hour window.
 */
export const dealerFingerprint = appSchema.table('dealer_fingerprint', {
  dealer: text()
    .primaryKey()
    .references(() => dealer.discogsUsername, { onDelete: 'cascade' }),
  computedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  sampledItems: integer().notNull(),
  totalItems: integer().notNull(),
  coverage: real().notNull(), // sampled/total — the honesty metric
  labelDist: jsonb().notNull(),
  styleDist: jsonb().notNull(),
  decadeDist: jsonb().notNull(),
  countryDist: jsonb().notNull(),
  medianPrice: numeric({ precision: 10, scale: 2 }),
  pricePosition: jsonb(), // per genre: deviation from the median
})
