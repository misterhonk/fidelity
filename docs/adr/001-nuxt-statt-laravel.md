# ADR-001: Nuxt/Node instead of Laravel/PHP

**Status:** Accepted, partly superseded by **ADR-007** · **Date:** 2026-08-09

> The choice of Nuxt/Vue still holds. The reasoning that leaned on Nitro as a server
> runtime is obsolete: Fidelity has no backend any more, Nuxt runs in SPA mode
> (`ssr: false`) and is generated statically. See ADR-007.

## Context

Martin works mainly with PHP (Shopware), JavaScript, Vue and SCSS. The stack was
explicitly left open. The workload is unusual: thousands of paginated, rate-limited
external API calls in background jobs, plus a dense, interactive UI.

## Decision

**Nuxt 4.5 on Node 22.** One language for front and back.

## Alternatives

**Laravel 13 + Inertia/Vue** – seriously considered, and objectively better in one
respect: Laravel's queue story is the best in any web framework. `Bus::batch()` with
progress and `catch()`, `RateLimited` and `WithoutOverlapping` middleware (built for
exactly "60 requests per minute against an external API"), Horizon for queue
observability, Octane. Rejected because two languages in one project mean a permanent
context switch, and knowing Vue on both sides weighs more than a better queue library.

**Next.js 16** – excellent, but React plus Vercel gravity. No reason to relearn.
**SvelteKit** – lean and lovely, but an ecosystem swap with nothing in return.
**Astro** – the wrong shape; this is an app, not a documentation site.

## Consequences

**Easier:** One `pnpm install`, one type system, Zod schemas shared between client and
server, one deployment artefact. Nitro's `.output` is self-contained — on Uberspace that
is an enormous advantage.

**Harder:** We rebuild job infrastructure that Laravel brings along.
**Countermeasure:** steal Laravel's *design* — rate-limiter middleware, batch with
progress, overlap lock — just on pg-boss rather than Horizon.

**The way out:** The scoring engine is a pure function and portable to any language. The
expensive part would be the Discogs client, not the domain logic.
