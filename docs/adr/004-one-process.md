# ADR-004: One Node process for app and worker

**Status:** **Superseded by ADR-007** · **Date:** 2026-08-09

> **Moot.** There are zero server processes. The split that matters now runs between the
> main thread and the web worker in the browser (`docs/01-ARCHITECTURE.md`, section 2).

## Context

Pure doctrine would be: web tier and job worker as separate processes. Uberspace gives
**1.5 GB of RAM for everything**. Postgres needs ~250 MB, each Node process ~200–250 MB.

## Decision

**One Nitro process.** The pg-boss worker starts in-process as a Nitro plugin.

## Reasoning

The scan is **I/O-bound at one request per second**. It uses practically no CPU and does
not compete with request handling. A second process would cost ~200 MB for a benefit we
could not measure at 5–30 users.

## Consequences

**Easier:** Half the RAM budget, one supervisord service, one deployment artefact, one
log stream.

**Harder:** No independent scaling. A crash in the worker takes the web app with it
(mitigation: job handlers in try/catch, `autorestart=true`). A CPU-heavy job — the
optimiser on very large baskets, say — can block requests (mitigation: cap candidates at
200, greedy rather than an exact solver).

**The way out:** pg-boss is cross-process anyway. The worker can be split out in a few
lines as its own entry point (`server/worker.mjs`) plus a second supervisord service.
**Trigger:** more than 50 users, several digs in parallel, or measurable request latency
during a scan.
