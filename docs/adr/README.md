# Architecture Decision Records

Short notes on decisions that are hard to undo.

**Template:**

```markdown
# ADR-NNN: <Title>

**Status:** Proposed | Accepted | Superseded by ADR-XXX
**Date:** YYYY-MM-DD

## Context
What is the situation? What constraints apply?

## Decision
What is being done?

## Alternatives
What was considered, and why was it rejected?

## Consequences
What gets easier, what gets harder? What is the way out?
```

| ADR | Title | Status |
|---|---|---|
| [007](007-client-only-pwa.md) | **Client-only PWA, no backend** | **Accepted** |
| [013](013-catalogue-service.md) | A stateless catalogue service from the CC0 dump, beside the hub | Proposed (M21) |
| [011](011-fidelity-writes-back.md) | Writing back to your own collection | Accepted |
| [010](010-english-base-language.md) | English as the base language | Accepted |
| [009](009-dealer-import.md) | Dealer import via `/friends` | Accepted, off by default |
| [008](008-optional-hub.md) | An optional, self-hostable hub | Proposed (M9) |
| [006](006-dealer-first.md) | Dealer-centric rather than wantlist-centric | Accepted |
| [005](005-horizon-not-dumps.md) | A horizon built on demand instead of a full dump | Accepted |
| [001](001-nuxt-not-laravel.md) | Nuxt/Vue instead of Laravel/PHP | Accepted, partly superseded by 007 |
| [002](002-postgres-not-sqlite.md) | PostgreSQL instead of SQLite | superseded by 007 |
| [003](003-drizzle-pinned.md) | Drizzle 0.45 pinned | superseded by 007 |
| [004](004-one-process.md) | One Node process for app and worker | superseded by 007 |

**ADR-007 is the most important entry.** It replaces the server-side half of the
original design entirely. If you read only one document, read that one.
