# ADR-003: Drizzle 0.45 pinned, not the 1.0 RC

**Status:** **Superseded by ADR-007** · **Date:** 2026-08-09

> **Moot.** No server, no SQL database, no ORM. Kept as decision history.

## Context

We write a lot of SQL-adjacent code: `pg_trgm` similarity, CTEs for discography gaps,
array operators, JSONB aggregation. An ORM that pushes itself in between is an opponent.

Drizzle fits the domain best — but **1.0 has been in RC for over 18 months** (beta.2 in
February 2025, still RC in August 2026), and stable is still the 0.45 line, last released
in March 2026. That is a signal.

## Decision

**Drizzle ORM 0.45.x, hard-pinned.** Excluded from Renovate. Upgrades only by hand and
deliberately.

## Alternatives

**Drizzle 1.0-rc** – no. A project you intend to keep is not built on an RC that has
been an RC for eighteen months.

**Prisma 7.9** – since 7.0 without the Rust query engine (which removed the
Docker/bundling pain) and on a steady release cadence. Lost on SQL transparency: with
`pg_trgm`- and CTE-heavy queries you end up fighting Prisma.

**Kysely 0.29** – a purely typed query builder with no opinion about migrations. Remains
the fallback.

## Consequences

**Easier:** Raw SQL where it belongs. No fight with an abstraction.

**Harder:** We may be sitting on a stagnating line.

**The way out:** Because the query logic is written close to SQL anyway, migrating to
Kysely would be manageable — essentially schema definitions and migration tooling.
**Trigger for a re-evaluation:** Drizzle 1.0 goes GA, or the 0.45 line goes six months
without a security update.
