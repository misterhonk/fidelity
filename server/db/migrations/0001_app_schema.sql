-- Hand-edited: `IF NOT EXISTS` added. Migration 0000 already creates the schema
-- because app.uuid7()/app.norm() have to live in it before any table
-- references them. Drizzle emits this once and never again.
CREATE SCHEMA IF NOT EXISTS "app";
--> statement-breakpoint
CREATE TYPE "app"."dig_status" AS ENUM('queued', 'scanning', 'matching', 'done', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "app"."dealer" (
	"discogs_username" text PRIMARY KEY NOT NULL,
	"discogs_user_id" integer,
	"display_name" text,
	"ships_from" text,
	"seller_rating" numeric(4, 1),
	"seller_rating_count" integer,
	"num_for_sale" integer,
	"min_order_total" numeric(10, 2),
	"shipping_note" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_scanned_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app"."dealer_fingerprint" (
	"dealer" text PRIMARY KEY NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sampled_items" integer NOT NULL,
	"total_items" integer NOT NULL,
	"coverage" real NOT NULL,
	"label_dist" jsonb NOT NULL,
	"style_dist" jsonb NOT NULL,
	"decade_dist" jsonb NOT NULL,
	"country_dist" jsonb NOT NULL,
	"median_price" numeric(10, 2),
	"price_position" jsonb
);
--> statement-breakpoint
CREATE TABLE "app"."dealer_shipping_tier" (
	"id" uuid PRIMARY KEY DEFAULT app.uuid7() NOT NULL,
	"dealer" text NOT NULL,
	"to_country" text NOT NULL,
	"min_items" smallint NOT NULL,
	"max_items" smallint,
	"price" numeric(10, 2) NOT NULL,
	"currency" char(3) NOT NULL,
	"source" text NOT NULL,
	"contributed_by" uuid,
	"verified_at" timestamp with time zone,
	CONSTRAINT "dealer_shipping_tier_dealer_toCountry_minItems_unique" UNIQUE("dealer","to_country","min_items"),
	CONSTRAINT "dealer_shipping_tier_source_check" CHECK ("app"."dealer_shipping_tier"."source" IN ('user','parsed','api'))
);
--> statement-breakpoint
CREATE TABLE "app"."dig" (
	"id" uuid PRIMARY KEY DEFAULT app.uuid7() NOT NULL,
	"user_id" uuid NOT NULL,
	"dealer" text NOT NULL,
	"status" "app"."dig_status" DEFAULT 'queued' NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"expires_at" timestamp with time zone DEFAULT now() + interval '6 hours' NOT NULL,
	"listings_total" integer,
	"listings_scanned" integer DEFAULT 0 NOT NULL,
	"pages_fetched" integer DEFAULT 0 NOT NULL,
	"coverage" real,
	"truncated" boolean DEFAULT false NOT NULL,
	"match_count" integer DEFAULT 0 NOT NULL,
	"api_requests" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."dig_match" (
	"id" uuid PRIMARY KEY DEFAULT app.uuid7() NOT NULL,
	"dig_id" uuid NOT NULL,
	"listing_id" bigint NOT NULL,
	"discogs_release_id" integer NOT NULL,
	"title" text NOT NULL,
	"artist_string" text NOT NULL,
	"label_string" text,
	"catno" text,
	"format_string" text,
	"year" smallint,
	"condition" text,
	"sleeve_condition" text,
	"price" numeric(10, 2),
	"currency" char(3),
	"comments" text,
	"thumb_url" text,
	"market_lowest_price" numeric(10, 2),
	"market_num_for_sale" integer,
	"score" smallint NOT NULL,
	"signals" jsonb NOT NULL,
	"reason" text NOT NULL,
	"expired" boolean DEFAULT false NOT NULL,
	CONSTRAINT "dig_match_digId_listingId_unique" UNIQUE("dig_id","listing_id")
);
--> statement-breakpoint
CREATE TABLE "app"."basket_item" (
	"user_id" uuid NOT NULL,
	"dealer" text NOT NULL,
	"listing_id" bigint NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text,
	CONSTRAINT "basket_item_user_id_listing_id_pk" PRIMARY KEY("user_id","listing_id")
);
--> statement-breakpoint
CREATE TABLE "app"."match_feedback" (
	"user_id" uuid NOT NULL,
	"listing_id" bigint NOT NULL,
	"discogs_release_id" integer NOT NULL,
	"verdict" text NOT NULL,
	"signals" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_feedback_user_id_listing_id_pk" PRIMARY KEY("user_id","listing_id"),
	CONSTRAINT "match_feedback_verdict_check" CHECK ("app"."match_feedback"."verdict" IN ('interesting','meh','wrong','bought'))
);
--> statement-breakpoint
CREATE TABLE "app"."watch" (
	"id" uuid PRIMARY KEY DEFAULT app.uuid7() NOT NULL,
	"user_id" uuid NOT NULL,
	"dealer" text NOT NULL,
	"min_score" smallint DEFAULT 60 NOT NULL,
	"cadence_hours" smallint DEFAULT 24 NOT NULL,
	"notify_push" boolean DEFAULT true NOT NULL,
	"notify_email" boolean DEFAULT false NOT NULL,
	"last_run_at" timestamp with time zone,
	"next_run_at" timestamp with time zone NOT NULL,
	CONSTRAINT "watch_userId_dealer_unique" UNIQUE("user_id","dealer")
);
--> statement-breakpoint
CREATE TABLE "app"."watch_seen" (
	"watch_id" uuid NOT NULL,
	"listing_id" bigint NOT NULL,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watch_seen_watch_id_listing_id_pk" PRIMARY KEY("watch_id","listing_id")
);
--> statement-breakpoint
CREATE TABLE "app"."collection_item" (
	"user_id" uuid NOT NULL,
	"discogs_release_id" integer NOT NULL,
	"discogs_master_id" integer,
	"instance_id" bigint,
	"folder_id" integer,
	"rating" smallint,
	"added_at" timestamp with time zone,
	"title" text,
	"artist_names" text[] DEFAULT '{}' NOT NULL,
	"artist_ids" integer[] DEFAULT '{}' NOT NULL,
	"label_names" text[] DEFAULT '{}' NOT NULL,
	"label_ids" integer[] DEFAULT '{}' NOT NULL,
	"catnos" text[] DEFAULT '{}' NOT NULL,
	"genres" text[] DEFAULT '{}' NOT NULL,
	"styles" text[] DEFAULT '{}' NOT NULL,
	"formats" text[] DEFAULT '{}' NOT NULL,
	"year" smallint,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_item_user_id_discogs_release_id_pk" PRIMARY KEY("user_id","discogs_release_id")
);
--> statement-breakpoint
CREATE TABLE "app"."taste_name" (
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"discogs_id" integer NOT NULL,
	"name" text NOT NULL,
	"name_norm" text GENERATED ALWAYS AS (app.norm(name)) STORED NOT NULL,
	"weight" real NOT NULL,
	CONSTRAINT "taste_name_user_id_kind_discogs_id_pk" PRIMARY KEY("user_id","kind","discogs_id"),
	CONSTRAINT "taste_name_kind_check" CHECK ("app"."taste_name"."kind" IN ('artist','label'))
);
--> statement-breakpoint
CREATE TABLE "app"."taste_profile" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"release_count" integer NOT NULL,
	"artists" jsonb NOT NULL,
	"labels" jsonb NOT NULL,
	"styles" jsonb NOT NULL,
	"genres" jsonb NOT NULL,
	"decades" jsonb NOT NULL,
	"countries" jsonb NOT NULL,
	"credits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"style_centroid" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."wantlist_item" (
	"user_id" uuid NOT NULL,
	"discogs_release_id" integer NOT NULL,
	"discogs_master_id" integer,
	"rating" smallint,
	"added_at" timestamp with time zone,
	"title" text,
	"artist_names" text[] DEFAULT '{}' NOT NULL,
	"artist_ids" integer[] DEFAULT '{}' NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wantlist_item_user_id_discogs_release_id_pk" PRIMARY KEY("user_id","discogs_release_id")
);
--> statement-breakpoint
CREATE TABLE "app"."invite" (
	"code" text PRIMARY KEY NOT NULL,
	"created_by" uuid,
	"used_by" uuid,
	"used_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."session" (
	"id" uuid PRIMARY KEY DEFAULT app.uuid7() NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."user" (
	"id" uuid PRIMARY KEY DEFAULT app.uuid7() NOT NULL,
	"discogs_user_id" integer NOT NULL,
	"discogs_username" text NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"oauth_token_enc" "bytea" NOT NULL,
	"oauth_secret_enc" "bytea" NOT NULL,
	"currency" char(3) DEFAULT 'EUR' NOT NULL,
	"ships_to_country" text DEFAULT 'Germany' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	CONSTRAINT "user_discogsUserId_unique" UNIQUE("discogs_user_id")
);
--> statement-breakpoint
CREATE TABLE "app"."user_preference" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"pref_media_cond" text DEFAULT 'Very Good Plus (VG+)' NOT NULL,
	"pref_sleeve_cond" text DEFAULT 'Very Good (VG)' NOT NULL,
	"target_price" numeric(10, 2),
	"max_price" numeric(10, 2),
	"min_seller_rating" numeric(4, 1) DEFAULT '98.0' NOT NULL,
	"ships_from_allow" text[],
	"ships_from_block" text[],
	"formats_allow" text[] DEFAULT '{"Vinyl"}' NOT NULL,
	"exclude_reissues" boolean DEFAULT false NOT NULL,
	"signal_weights" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."dealer_fingerprint" ADD CONSTRAINT "dealer_fingerprint_dealer_dealer_discogs_username_fk" FOREIGN KEY ("dealer") REFERENCES "app"."dealer"("discogs_username") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."dealer_shipping_tier" ADD CONSTRAINT "dealer_shipping_tier_dealer_dealer_discogs_username_fk" FOREIGN KEY ("dealer") REFERENCES "app"."dealer"("discogs_username") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."dealer_shipping_tier" ADD CONSTRAINT "dealer_shipping_tier_contributed_by_user_id_fk" FOREIGN KEY ("contributed_by") REFERENCES "app"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."dig" ADD CONSTRAINT "dig_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."dig" ADD CONSTRAINT "dig_dealer_dealer_discogs_username_fk" FOREIGN KEY ("dealer") REFERENCES "app"."dealer"("discogs_username") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."dig_match" ADD CONSTRAINT "dig_match_dig_id_dig_id_fk" FOREIGN KEY ("dig_id") REFERENCES "app"."dig"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."basket_item" ADD CONSTRAINT "basket_item_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."basket_item" ADD CONSTRAINT "basket_item_dealer_dealer_discogs_username_fk" FOREIGN KEY ("dealer") REFERENCES "app"."dealer"("discogs_username") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_feedback" ADD CONSTRAINT "match_feedback_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."watch" ADD CONSTRAINT "watch_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."watch" ADD CONSTRAINT "watch_dealer_dealer_discogs_username_fk" FOREIGN KEY ("dealer") REFERENCES "app"."dealer"("discogs_username") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."watch_seen" ADD CONSTRAINT "watch_seen_watch_id_watch_id_fk" FOREIGN KEY ("watch_id") REFERENCES "app"."watch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."collection_item" ADD CONSTRAINT "collection_item_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."taste_name" ADD CONSTRAINT "taste_name_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."taste_profile" ADD CONSTRAINT "taste_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."wantlist_item" ADD CONSTRAINT "wantlist_item_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."invite" ADD CONSTRAINT "invite_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."invite" ADD CONSTRAINT "invite_used_by_user_id_fk" FOREIGN KEY ("used_by") REFERENCES "app"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."user_preference" ADD CONSTRAINT "user_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dig_user_id_created_at_index" ON "app"."dig" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "dig_expires_at_index" ON "app"."dig" USING btree ("expires_at") WHERE "app"."dig"."status" = 'done';--> statement-breakpoint
CREATE INDEX "dig_match_dig_id_score_index" ON "app"."dig_match" USING btree ("dig_id","score" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "dig_match_signals_gin" ON "app"."dig_match" USING gin ("signals" jsonb_path_ops);--> statement-breakpoint
CREATE INDEX "collection_item_artist_ids_index" ON "app"."collection_item" USING gin ("artist_ids");--> statement-breakpoint
CREATE INDEX "collection_item_label_ids_index" ON "app"."collection_item" USING gin ("label_ids");--> statement-breakpoint
CREATE INDEX "collection_item_styles_index" ON "app"."collection_item" USING gin ("styles");--> statement-breakpoint
CREATE INDEX "taste_name_norm_trgm" ON "app"."taste_name" USING gin ("name_norm" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "taste_name_norm_exact" ON "app"."taste_name" USING btree ("user_id","kind","name_norm");