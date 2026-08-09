-- Custom migration: everything the generated schema depends on but Drizzle
-- cannot express — extensions and the two helper functions.
--
-- Order matters. `app.uuid7()` and `app.norm()` are referenced by column
-- defaults and by a GENERATED column, so PostgreSQL resolves them at CREATE
-- TABLE time. They have to exist before migration 0001 runs.

CREATE SCHEMA IF NOT EXISTS app;
--> statement-breakpoint

-- Fuzzy artist/label matching, accent folding, token encryption.
CREATE EXTENSION IF NOT EXISTS pg_trgm  WITH SCHEMA public;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;--> statement-breakpoint

-- uuidv7() is built in from PostgreSQL 18. Uberspace 7 tops out at 15, so we
-- generate one ourselves: 48 bit big-endian unix milliseconds + 74 random bits,
-- with the version and variant nibbles patched in. Time-ordered, which keeps
-- B-tree inserts local instead of scattering them like uuid4 does.
CREATE OR REPLACE FUNCTION app.uuid7() RETURNS uuid
LANGUAGE plpgsql VOLATILE PARALLEL SAFE AS $$
DECLARE
  v_bytes bytea;
BEGIN
  v_bytes :=
      substring(int8send((extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3 FOR 6)
    || public.gen_random_bytes(10);

  -- version 7 into the high nibble of byte 6
  v_bytes := set_byte(v_bytes, 6, (get_byte(v_bytes, 6) & 15) | 112);
  -- RFC 4122 variant (10xx) into the two high bits of byte 8
  v_bytes := set_byte(v_bytes, 8, (get_byte(v_bytes, 8) & 63) | 128);

  RETURN encode(v_bytes, 'hex')::uuid;
END;
$$;
--> statement-breakpoint

-- The single place where artist and label names get normalised. Does exactly
-- what docs/01-ARCHITEKTUR.md §9 step 1 describes, and nothing else.
--
-- IMMUTABLE is a deliberate lie about public.unaccent(), which is only STABLE.
-- Without it the function cannot back an index or a GENERATED column. The price
-- is a REINDEX after any unaccent dictionary change.
CREATE OR REPLACE FUNCTION app.norm(txt text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT btrim(regexp_replace(
    regexp_replace(
      -- drop leading articles: "The Beatles" ≈ "Beatles, The"
      regexp_replace(lower(public.unaccent(coalesce(txt, ''))),
                     '^(the|die|der|das|les|los|la|le)\s+', '', 'i'),
      -- punctuation to spaces. Parentheses stay: "nirvana (2)" is a DIFFERENT
      -- artist from "nirvana".
      '[^a-z0-9()& ]+', ' ', 'g'),
    '\s+', ' ', 'g'))
$$;
