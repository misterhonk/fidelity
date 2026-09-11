# ADR-002: PostgreSQL instead of SQLite

**Status:** **Superseded by ADR-007** · **Date:** 2026-08-09

> **Moot.** There is no server and therefore no server-side database. Storage is
> IndexedDB in the user's browser (`docs/03-DATA-MODEL.md`). Kept as decision history.

## Context

Production runs on Uberspace: 1.5 GB RAM for all processes, 10 GB of disk, no Docker.
SQLite would be considerably simpler there — no daemon, no RAM overhead, backup = copy a
file, deploy = rsync a file. Number of users: 5–30.

## Decision

**PostgreSQL** (major version = whatever Uberspace has, pinned identically in
development), with `pg_trgm`, `unaccent` and `pgcrypto`.

## Alternatives

**SQLite/libSQL** – seriously considered, failed on three points:
1. The credit graph (signal 8) and the discography gaps (signal 4) are genuine
   relational graph queries over 30M+ rows
2. `pg_trgm` is the backbone of the fuzzy matching; SQLite's `spellfix1`/`editdist3` are
   not an equivalent substitute
3. The web tier and the job worker write concurrently; there is no
   `FOR UPDATE SKIP LOCKED`

We would migrate within a year — better to do it properly straight away.

**MariaDB** (the Uberspace default) – no `pg_trgm`, weaker full-text search, no JSONB.

## Consequences

**Easier:** Fuzzy matching, catalogue joins, the queue (pg-boss instead of Redis), and
`pgvector` later for style adjacency.

**Harder:** One more daemon inside the 1.5 GB budget (~250 MB at
`shared_buffers=128MB`). Uberspace-specific setup through supervisord. The version is
probably older than the newest Postgres available locally — which is why development
pins to the same major.

**The way out:** If RAM gives way, see the escalation list in `docs/08-DEPLOYMENT.md` §6. A
move to a VPS is prepared (a Docker image exists).
