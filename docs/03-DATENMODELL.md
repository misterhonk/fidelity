# 03 – Datenmodell

> PostgreSQL **15** (die auf Uberspace 7 verfügbare Default-Major; lokal identisch gepinnt).
> Drei Schemas mit klar getrennter Lizenz- und Lebensdauer-Semantik.

```
app      – Nutzer, Sessions, Digs, Treffer, Warenkörbe      (unsere Daten)
catalog  – Discogs-Katalog aus CC0-Dumps                    (Public Domain, read-only)
pgboss   – Job-Queue                                        (von pg-boss verwaltet)
```

> **Diese Trennung ist keine Kosmetik.** `catalog` unterliegt CC0 und darf dauerhaft liegen
> bleiben. Alles, was aus der Live-API stammt und Marktplatzdaten enthält, unterliegt der
> 6-Stunden-Regel und lebt in `app` mit `expires_at`.

---

## 1. Extensions & Konventionen

```sql
CREATE SCHEMA IF NOT EXISTS app;
CREATE SCHEMA IF NOT EXISTS catalog;
-- pgboss legt sein Schema selbst an

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- uuidv7() ist erst ab PostgreSQL 18 eingebaut. Auf 15 brauchen wir einen Fallback
-- (zeitgeordnete UUID aus Unix-ms + Zufall – indexfreundlicher als uuid4).
CREATE OR REPLACE FUNCTION app.uuid7() RETURNS uuid AS $$ ... $$ LANGUAGE plpgsql;

-- IMMUTABLE-Wrapper für unaccent, damit indizierbar.
-- Macht ALLES, was 01-ARCHITEKTUR.md §9 Stufe 1 beschreibt – an genau einer Stelle.
CREATE OR REPLACE FUNCTION app.norm(txt text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT btrim(regexp_replace(
    regexp_replace(
      -- führende Artikel ans Ende: "The Beatles" ≈ "Beatles, The"
      regexp_replace(lower(unaccent(coalesce(txt, ''))),
                     '^(the|die|der|das|les|los|la|le)\s+', '', 'i'),
      -- Interpunktion zu Leerzeichen. Runde Klammern BLEIBEN erhalten:
      -- "nirvana (2)" ist ein ANDERER Künstler als "nirvana".
      '[^a-z0-9()& ]+', ' ', 'g'),
    '\s+', ' ', 'g'))
$$;
-- ⚠️ Nach Wörterbuchänderungen an unaccent: REINDEX aller darauf basierenden Indizes.
```

**Konventionen**

- Tabellen `snake_case`, Singular (`dig`, nicht `digs`)
- PKs: `uuid` (v7) für App-Entitäten, `integer` für Discogs-IDs (deren IDs sind stabil)
- Geld: `numeric(10,2)` + separate `char(3)`-Währung. **Nie `float`.**
- Zeit: immer `timestamptz`
- Discogs-IDs heißen konsequent `discogs_*_id`

---

## 2. Schema `app`

### Nutzer & Auth

```sql
CREATE TABLE app.user (
  id                   uuid PRIMARY KEY DEFAULT app.uuid7(),
  discogs_user_id      integer     NOT NULL UNIQUE,
  discogs_username     text        NOT NULL,
  display_name         text,
  avatar_url           text,
  -- OAuth-Token verschlüsselt at rest. Key aus ENV (FIDELITY_TOKEN_KEY).
  oauth_token_enc      bytea       NOT NULL,
  oauth_secret_enc     bytea       NOT NULL,
  currency             char(3)     NOT NULL DEFAULT 'EUR',
  ships_to_country     text        NOT NULL DEFAULT 'Germany',
  created_at           timestamptz NOT NULL DEFAULT now(),
  last_seen_at         timestamptz
);

CREATE TABLE app.session (
  id          uuid PRIMARY KEY DEFAULT app.uuid7(),
  user_id     uuid NOT NULL REFERENCES app.user(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.invite (
  code        text PRIMARY KEY,
  created_by  uuid REFERENCES app.user(id),
  used_by     uuid REFERENCES app.user(id),
  used_at     timestamptz,
  expires_at  timestamptz NOT NULL
);
```

### Nutzerpräferenzen (die Filter-Grundlinie)

```sql
CREATE TABLE app.user_preference (
  user_id            uuid PRIMARY KEY REFERENCES app.user(id) ON DELETE CASCADE,
  -- WEICH: darunter wird gedämpft, nicht verworfen
  pref_media_cond    text        NOT NULL DEFAULT 'Very Good Plus (VG+)',
  pref_sleeve_cond   text        NOT NULL DEFAULT 'Very Good (VG)',
  target_price       numeric(10,2),        -- Wohlfühlpreis
  -- HART: darüber/darunter wird verworfen bzw. der Dig abgebrochen
  max_price          numeric(10,2),        -- absolutes Budget
  min_seller_rating  numeric(4,1) NOT NULL DEFAULT 98.0,
  ships_from_allow   text[],          -- leer = alle
  ships_from_block   text[],
  formats_allow      text[]      NOT NULL DEFAULT ARRAY['Vinyl'],
  exclude_reissues   boolean     NOT NULL DEFAULT false,
  signal_weights     jsonb       NOT NULL DEFAULT '{}'::jsonb  -- Barry-Score-Tuning
);
```

### Sammlung & Wantlist (Spiegel, TTL 24 h)

```sql
CREATE TABLE app.collection_item (
  user_id             uuid    NOT NULL REFERENCES app.user(id) ON DELETE CASCADE,
  discogs_release_id  integer NOT NULL,
  discogs_master_id   integer,               -- 0/NULL wenn keiner existiert
  instance_id         bigint,
  folder_id           integer,
  rating              smallint,
  added_at            timestamptz,
  -- denormalisiert aus basic_information, damit M2 ohne catalog-Schema läuft
  title               text,
  artist_names        text[]  NOT NULL DEFAULT '{}',
  artist_ids          integer[] NOT NULL DEFAULT '{}',
  label_names         text[]  NOT NULL DEFAULT '{}',
  label_ids           integer[] NOT NULL DEFAULT '{}',
  catnos              text[]  NOT NULL DEFAULT '{}',
  genres              text[]  NOT NULL DEFAULT '{}',
  styles              text[]  NOT NULL DEFAULT '{}',
  formats             text[]  NOT NULL DEFAULT '{}',
  year                smallint,
  synced_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, discogs_release_id)
);

CREATE TABLE app.wantlist_item (
  user_id             uuid    NOT NULL REFERENCES app.user(id) ON DELETE CASCADE,
  discogs_release_id  integer NOT NULL,
  discogs_master_id   integer,
  rating              smallint,
  added_at            timestamptz,
  title               text,
  artist_names        text[]  NOT NULL DEFAULT '{}',
  artist_ids          integer[] NOT NULL DEFAULT '{}',
  synced_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, discogs_release_id)
);

CREATE INDEX ON app.collection_item USING gin (artist_ids);
CREATE INDEX ON app.collection_item USING gin (label_ids);
CREATE INDEX ON app.collection_item USING gin (styles);
```

### Das Geschmacksprofil – vorberechnet, nicht bei jedem Dig

```sql
-- Wird nach jedem Sammlungs-Sync neu materialisiert.
-- Das ist die Wissensbasis von "Barry".
CREATE TABLE app.taste_profile (
  user_id        uuid PRIMARY KEY REFERENCES app.user(id) ON DELETE CASCADE,
  computed_at    timestamptz NOT NULL DEFAULT now(),
  release_count  integer     NOT NULL,
  -- Gewichtete Verteilungen, jeweils { "<id oder name>": { n, weight, lift } }
  -- "lift" = Anteil in deiner Sammlung / Anteil global. > 1 heißt: du sammelst das gezielt.
  artists        jsonb       NOT NULL,
  labels         jsonb       NOT NULL,
  styles         jsonb       NOT NULL,
  genres         jsonb       NOT NULL,
  decades        jsonb       NOT NULL,
  countries      jsonb       NOT NULL,
  credits        jsonb       NOT NULL DEFAULT '{}'::jsonb,  -- ab M5
  -- Für Stil-Adjazenz: normalisierter Stil-Zentroid
  style_centroid jsonb       NOT NULL DEFAULT '{}'::jsonb
);

-- Normalisierte Namensindizes für das Fuzzy-Matching gegen Inventory-Strings
CREATE TABLE app.taste_name (
  user_id     uuid    NOT NULL REFERENCES app.user(id) ON DELETE CASCADE,
  kind        text    NOT NULL CHECK (kind IN ('artist','label')),
  discogs_id  integer NOT NULL,
  name        text    NOT NULL,
  name_norm   text    NOT NULL GENERATED ALWAYS AS (app.norm(name)) STORED,
  weight      real    NOT NULL,
  PRIMARY KEY (user_id, kind, discogs_id)
);

CREATE INDEX taste_name_norm_trgm
  ON app.taste_name USING gin (name_norm gin_trgm_ops);
CREATE INDEX taste_name_norm_exact
  ON app.taste_name (user_id, kind, name_norm);
```

### Händler

```sql
CREATE TABLE app.dealer (
  discogs_username    text PRIMARY KEY,
  discogs_user_id     integer,
  display_name        text,
  ships_from          text,
  seller_rating       numeric(4,1),
  seller_rating_count integer,
  num_for_sale        integer,
  min_order_total     numeric(10,2),
  shipping_note       text,        -- Freitext aus seller.shipping
  first_seen_at       timestamptz NOT NULL DEFAULT now(),
  last_scanned_at     timestamptz
);

-- Versandstaffeln: einmal von irgendjemandem gepflegt, alle profitieren.
CREATE TABLE app.dealer_shipping_tier (
  id            uuid PRIMARY KEY DEFAULT app.uuid7(),
  dealer        text NOT NULL REFERENCES app.dealer(discogs_username) ON DELETE CASCADE,
  to_country    text NOT NULL,
  min_items     smallint NOT NULL,
  max_items     smallint,             -- NULL = offen nach oben
  price         numeric(10,2) NOT NULL,
  currency      char(3) NOT NULL,
  source        text NOT NULL CHECK (source IN ('user','parsed','api')),
  contributed_by uuid REFERENCES app.user(id),
  verified_at   timestamptz,
  UNIQUE (dealer, to_country, min_items)
);

-- Händler-Steckbrief ("The Clerk's Take") – abgeleitet, nicht Marktplatzdaten,
-- daher ohne 6h-Verfall speicherbar.
CREATE TABLE app.dealer_fingerprint (
  dealer          text PRIMARY KEY REFERENCES app.dealer(discogs_username) ON DELETE CASCADE,
  computed_at     timestamptz NOT NULL DEFAULT now(),
  sampled_items   integer NOT NULL,
  total_items     integer NOT NULL,
  coverage        real    NOT NULL,   -- sampled/total – Ehrlichkeitsmetrik
  label_dist      jsonb   NOT NULL,
  style_dist      jsonb   NOT NULL,
  decade_dist     jsonb   NOT NULL,
  country_dist    jsonb   NOT NULL,
  median_price    numeric(10,2),
  price_position  jsonb              -- pro Genre: Abweichung vom Median
);
```

### Digs – hier lebt die 6-Stunden-Regel

```sql
CREATE TYPE app.dig_status AS ENUM
  ('queued','scanning','matching','done','failed','cancelled');

CREATE TABLE app.dig (
  id               uuid PRIMARY KEY DEFAULT app.uuid7(),
  user_id          uuid NOT NULL REFERENCES app.user(id) ON DELETE CASCADE,
  dealer           text NOT NULL REFERENCES app.dealer(discogs_username),
  status           app.dig_status NOT NULL DEFAULT 'queued',
  started_at       timestamptz,
  finished_at      timestamptz,
  -- ⚠️ ToS: Marktplatzdaten dürfen max. 6 h alt angezeigt werden.
  expires_at       timestamptz NOT NULL,
  listings_total   integer,        -- was der Händler laut API hat
  listings_scanned integer NOT NULL DEFAULT 0,
  pages_fetched    integer NOT NULL DEFAULT 0,
  coverage         real,           -- scanned / total
  truncated        boolean NOT NULL DEFAULT false,  -- 10k-Wand getroffen?
  match_count      integer NOT NULL DEFAULT 0,
  api_requests     integer NOT NULL DEFAULT 0,
  error            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON app.dig (user_id, created_at DESC);
CREATE INDEX ON app.dig (expires_at) WHERE status = 'done';
```

```sql
CREATE TABLE app.dig_match (
  id                 uuid PRIMARY KEY DEFAULT app.uuid7(),
  dig_id             uuid NOT NULL REFERENCES app.dig(id) ON DELETE CASCADE,
  -- Marktplatzdaten (verfallen mit dem Dig)
  listing_id         bigint  NOT NULL,
  discogs_release_id integer NOT NULL,
  title              text    NOT NULL,
  artist_string      text    NOT NULL,
  label_string       text,
  catno              text,
  format_string      text,
  year               smallint,
  -- ⚠️ ALLE Marktplatzfelder sind NULLABLE. Der Cleanup-Job entkernt sie nach
  -- 6 Stunden (siehe §4) – mit NOT NULL würde er bei jedem Lauf scheitern und
  -- die ToS-Regel wäre technisch nie durchgesetzt.
  condition           text,
  sleeve_condition    text,
  price               numeric(10,2),
  currency            char(3),
  comments            text,
  thumb_url           text,
  market_lowest_price numeric(10,2),   -- aus /marketplace/stats/ – KEIN Median,
  market_num_for_sale integer,         -- den gibt die API nicht her (siehe 02 §7)
  -- unsere abgeleiteten Daten (dürfen bleiben – kein Discogs-Content)
  score              smallint NOT NULL,
  signals            jsonb    NOT NULL,   -- [{ type, confidence, weight, evidence }]
  reason             text     NOT NULL,   -- der Barry-Satz
  expired            boolean  NOT NULL DEFAULT false,
  UNIQUE (dig_id, listing_id)
);

CREATE INDEX ON app.dig_match (dig_id, score DESC);
CREATE INDEX ON app.dig_match USING gin (signals jsonb_path_ops);
```

### Watchlist & Warenkorb

```sql
CREATE TABLE app.watch (
  id             uuid PRIMARY KEY DEFAULT app.uuid7(),
  user_id        uuid NOT NULL REFERENCES app.user(id) ON DELETE CASCADE,
  dealer         text NOT NULL REFERENCES app.dealer(discogs_username),
  min_score      smallint NOT NULL DEFAULT 60,
  cadence_hours  smallint NOT NULL DEFAULT 24,
  notify_push    boolean NOT NULL DEFAULT true,
  notify_email   boolean NOT NULL DEFAULT false,
  last_run_at    timestamptz,
  next_run_at    timestamptz NOT NULL,
  UNIQUE (user_id, dealer)
);

-- Nur listing_ids für den Diff. Keine Preise, keine Zustände → kein 6h-Konflikt.
CREATE TABLE app.watch_seen (
  watch_id   uuid   NOT NULL REFERENCES app.watch(id) ON DELETE CASCADE,
  listing_id bigint NOT NULL,
  first_seen timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (watch_id, listing_id)
);

CREATE TABLE app.basket_item (
  user_id     uuid   NOT NULL REFERENCES app.user(id) ON DELETE CASCADE,
  dealer      text   NOT NULL REFERENCES app.dealer(discogs_username),
  listing_id  bigint NOT NULL,
  added_at    timestamptz NOT NULL DEFAULT now(),
  note        text,
  PRIMARY KEY (user_id, listing_id)
);

-- Feedback für die Score-Kalibrierung. Der einzige Weg, Barry besser zu machen.
CREATE TABLE app.match_feedback (
  user_id            uuid    NOT NULL REFERENCES app.user(id) ON DELETE CASCADE,
  listing_id         bigint  NOT NULL,
  discogs_release_id integer NOT NULL,
  verdict      text   NOT NULL CHECK (verdict IN ('interesting','meh','wrong','bought')),
  signals      jsonb  NOT NULL,   -- Signal-Snapshot zum Zeitpunkt des Urteils
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);
```

---

## 3. Schema `catalog` (ab M5, aus CC0-Dumps)

**Read-only in Produktion.** Wird lokal gebaut und als `pg_dump` eingespielt.
Bewusst schlank – jede Spalte kostet auf Uberspace echtes Quota.

```sql
CREATE TABLE catalog.release (
  id          integer PRIMARY KEY,
  master_id   integer,
  title       text     NOT NULL,
  title_norm  text     NOT NULL,
  year        smallint,
  country     text,
  formats     text[],        -- ['Vinyl','LP','Album']
  genres      text[],
  styles      text[]
);

CREATE TABLE catalog.master (
  id               integer PRIMARY KEY,
  main_release_id  integer,
  title            text NOT NULL,
  year             smallint,
  version_count    integer NOT NULL DEFAULT 0
);

CREATE TABLE catalog.artist (
  id         integer PRIMARY KEY,
  name       text NOT NULL,
  name_norm  text NOT NULL
);

CREATE TABLE catalog.label (
  id          integer PRIMARY KEY,
  name        text NOT NULL,
  name_norm   text NOT NULL,
  parent_id   integer
);

CREATE TABLE catalog.release_artist (
  release_id integer NOT NULL,
  artist_id  integer NOT NULL,
  -- ⚠️ PK-Spalten sind in Postgres implizit NOT NULL – "NULL = Hauptkünstler"
  -- funktioniert hier NICHT. Deshalb ein Sentinel-Wert.
  role       text    NOT NULL DEFAULT 'main',
  PRIMARY KEY (release_id, artist_id, role)
);

CREATE TABLE catalog.release_label (
  release_id integer NOT NULL,
  label_id   integer NOT NULL,
  -- ⚠️ Ebenfalls PK-Spalte → NOT NULL. Sehr viele Discogs-Releases haben keine
  -- Katalognummer (oder wörtlich "none"), deshalb Leerstring statt NULL.
  catno        text    NOT NULL DEFAULT '',
  catno_prefix text,             -- "BLP 4058" → "BLP"
  catno_num    integer,          -- "BLP 4058" → 4058
  PRIMARY KEY (release_id, label_id, catno)
);

-- Der Credit-Graph. Nur die Rollen, die für Empfehlungen taugen.
CREATE TABLE catalog.credit (
  release_id integer NOT NULL,
  artist_id  integer NOT NULL,
  role       text    NOT NULL,   -- 'Producer','Engineer','Mixed By','Mastered By','Recorded At'
  PRIMARY KEY (release_id, artist_id, role)
);

CREATE INDEX ON catalog.release (master_id);
CREATE INDEX ON catalog.release_artist (artist_id);
CREATE INDEX ON catalog.release_label (label_id, catno_prefix, catno_num);
CREATE INDEX ON catalog.credit (artist_id, role);
CREATE INDEX ON catalog.artist USING gin (name_norm gin_trgm_ops);
CREATE INDEX ON catalog.label  USING gin (name_norm gin_trgm_ops);
```

> ⚠️ **Vor dem Bau von M5 den Platzbedarf real messen.** Schätzung ~6 GB inkl. Indizes bei
> 10 GB Uberspace-Default-Quota. Eskalationsstufen, in dieser Reihenfolge:
> 1. `catalog.credit` auf Releases ab 1950 und die 5 Kernrollen begrenzen
> 2. Nur Releases behalten, deren Format Vinyl/CD enthält
> 3. Uberspace-Quota hochbuchen (bis 100 GB möglich)
> 4. Notfall: `catalog.credit` nur für Künstler/Labels, die in einer Nutzersammlung vorkommen

---

## 4. Aufräum-Jobs

```sql
-- Stündlich: abgelaufene Digs entkernen, unsere Ableitungen behalten.
-- Alle hier genullten Spalten sind Marktplatzdaten und unterliegen der 6-h-Regel.
UPDATE app.dig_match m SET
  price               = NULL,
  currency            = NULL,
  condition           = NULL,
  sleeve_condition    = NULL,
  comments            = NULL,
  thumb_url           = NULL,
  market_lowest_price = NULL,
  market_num_for_sale = NULL,
  expired             = true
FROM app.dig d
WHERE m.dig_id = d.id AND d.expires_at < now() AND m.expired = false;

-- Täglich: Digs älter als 30 Tage löschen; Sessions abräumen;
--          watch_seen-Einträge älter als 180 Tage löschen
```
