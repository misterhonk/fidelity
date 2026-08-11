# Contributing

Thanks for looking. This document is short because the important part is elsewhere:
[`CLAUDE.md`](CLAUDE.md) holds the rules that keep this project together, and
[`docs/`](docs/) explains why they exist.

---

## What it runs on

**Node ≥ 22.5.** Nothing else — no database, no Docker, no seed.

```bash
corepack enable     # fetches exactly the pnpm version from package.json
pnpm install
pnpm dev            # http://localhost:3000
```

pnpm does not have to be installed: `corepack` ships with every Node from 16.9 on and pins
the version through the `packageManager` field. A globally installed, different pnpm is the
most common cause of a lockfile that changes unexpectedly.

The hub is a package of its own, with its own tests and no dependency on the app:

```bash
cd hub
node --test test/*.test.ts
```

## Before you submit anything

```bash
pnpm lint && pnpm typecheck && pnpm test:unit && pnpm size
```

Plus **`pnpm test:e2e`** if you changed anything on a screen. The pre-commit hook only
checks formatting, lint, types and the unit tests — Playwright does not run there because
it takes minutes. Anybody relying on the hook eventually pushes a red suite. (That is not a
hypothesis. That is exactly how it happened.)

And: **read the summary of a test run, not the last line.** With Playwright, `| tail -3`
shows you the last green test rather than the result.

> Playwright reuses a server already listening on its port. If you have `pnpm dev` running,
> the browser suite silently tests _that_ instead of the production build — which fails in
> ways that have nothing to do with your change. `E2E_PORT=4173 pnpm test:e2e` avoids it.

---

## The rules that are not up for negotiation

In full, with reasons, in [`CLAUDE.md`](CLAUDE.md). The short version, because every one of
them has cost somebody something already:

**No backend.** No database, no server process. If a task calls for a server, the task is
wrongly framed — ask. ([ADR-007](docs/adr/007-client-only-pwa.md))

**Never `/releases/{id}` in a loop over everything.** Ten thousand releases is three hours.
Individually, on demand, for what somebody is looking at: fine. All of them: never.

**Never concurrent Discogs requests.** Exactly one at a time, 1,200 ms with a token,
2,400 ms without — and that is **across every tab**, because the limit is per IP and a tab
is not an IP. Everything goes through the one client in the worker.

**Never show marketplace data older than six hours.** Those are the terms under which we
are allowed to use the API. Not to be worked around, not even "just for development".

**Never scrape.** Documented endpoints only. There is exactly one named exception with an
ADR of its own ([ADR-009](docs/adr/009-haendler-import.md)); a second one needs a second
ADR.

**The token does not leave IndexedDB.** Never into a log, never into a URL, never into an
error report, never to a hub.

**Every new dependency has to justify its bytes.** The budget is 180 kB gzip for the first
meaningful paint, and `pnpm size` breaks the build when it is exceeded.

**No feature may require the hub.** It makes things faster. Hub calls run with a two-second
timeout, no retry, and fall back silently to the local path.

---

## How things are written here

**Language: English, everywhere.** Code, comments, commits, variable names, user-facing
text and addresses. German is a translation, not a foundation
([ADR-010](docs/adr/010-englisch-als-grundsprache.md)).

Anything a user reads lives in a message pack under `app/i18n/`, never in a template. The
shell (`en.ts`, `de.ts`) holds what appears on every screen; each area has a file of its
own so a screen's words travel in that screen's chunk rather than in the first paint. Two
things follow from that and are worth knowing before you add a string:

- **`de.ts` is typed as the shape of `en.ts`.** A missing key is a build error, not a blank
  spot somebody finds later. Anything taking a number is a function, so plurals and
  interpolation are ordinary TypeScript.
- **Never read the pack into a top-level constant.** `const m = useMessages().value.nav` at
  the top of a `<script setup>` captures whichever language was active at mount, and that
  panel then keeps its old words through a switch. Inside a `computed()`, inside a function
  or in a template it is a read per evaluation and correct. There is a test that refuses
  the first form.

`docs/` is still German and is being translated last. New documents there may be German;
new comments in the code may not.

**User-facing text does not talk about the machine.** No "requests", no "entities", no
"IndexedDB", no ADR numbers. Costs are named in minutes rather than in requests — that is
the unit somebody plans in. And say what something gives you, not what it does not.

**Comments explain the why.** What the code does is in the code. Why it does it that way —
and what the alternative cost — goes above it. Especially for anything that follows from a
measurement: then the measurement belongs there, with its date.

**Measure rather than assert.** Most of the hard decisions in this project come out of an
experiment against the real API or a real browser. If you write something about Discogs, a
browser or a limit: check it, note the date, and if you could not check it, write that down.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/), enforced by commitlint.

```
feat(dig): add incremental matching during inventory scan
fix(discogs): handle both legacy and FastAPI error shapes
perf(horizon): pack release ids as Int32Array
docs(api): document the 10k pagination wall
```

Scopes: `dig` `match` `discogs` `horizon` `auth` `basket` `watch` `dealers` `hub` `demo`
`sync` `ui` `i18n` `db` `pwa` `deploy` `deps`. A new scope belongs in
`commitlint.config.mjs` **and** in `CLAUDE.md` — otherwise the two lists drift apart.

The body underneath may be long. It is often the only place that says why a change was
necessary.

## Releases

`release-please` makes them from the commits. **Never raise the version by hand**, and
never edit `CHANGELOG.md` directly for a release — only sharpen it in the release PR.

---

## Tests

**The most important test in the project** is the golden-file test of the scoring engine
(`tests/unit/scoring.spec.ts`) against frozen real inventories and collections. Every
change to a signal weight has to update the snapshot — **and the diff has to be explained
in the PR.** A snapshot silently re-recorded is not a test.

`SCALE` and `SECONDARY` in the score formula are constants and stay constants. Adjusting
them per milestone makes scores incomparable over time.

**Also required:**

- Discogs is **always** mocked in tests. Fixtures under `tests/fixtures/`. The suite must
  not need a real API — otherwise CI fails for reasons that have nothing to do with the
  code.
- Playwright **including WebKit**. The weakest target is iOS Safari, and it regularly
  behaves differently from Chrome.
- 20,000 synthetic listings have to be scored in under 250 ms.
- `pnpm size` holds the bundle budget.

**Screens with something on them are tested too.** `tests/e2e/seed.ts` writes a used
device straight into IndexedDB — an identity, a collection, a dig with matches, a basket
with two lines — so a browser test can render the find list, the basket and the shelf
without a token and without a single request. Before it existed the whole browser suite
ran signed out, on empty screens, and the first thing it found when it stopped doing that
was twenty-odd `aria-label`s still in German.

Which is the other rule: **an accessible name comes from a message pack, never from a
literal in a template.** `tests/unit/accessible-names.spec.ts` refuses the literal. Not
because a literal is always wrong — because "is this still German?" is a question a person
has to remember to ask about a string they cannot see, and "is this bound?" is one a
machine asks every time. URLs and things with no letters in them are allowed through; they
are examples of input, not prose.

**Anything a user reads is tested in both languages.** Not for thoroughness: a phrase that
exists in one pack and not the other is invisible in whichever language you happen to be
testing in. The reason sentences, the pressing warnings and the demo examples all run
twice for that reason.

**Check your guards by breaking them.** If a test is meant to secure a condition, invert
the condition once and see whether the test really falls over. A test that stays green when
you break the thing it checks is checking nothing.

## Decisions

Anything hard to undo goes into `docs/adr/` as an ADR — the template is
[ADR-001](docs/adr/001-nuxt-statt-laravel.md). The rejected ones stay too: the history of a
decision is half its value.

A new signal for the matching engine is described in
[`docs/04-MATCHING-ENGINE.md`](docs/04-MATCHING-ENGINE.md) first and built second.

A new Discogs endpoint goes into [`docs/02-DISCOGS-API.md`](docs/02-DISCOGS-API.md) first —
with its cost, its auth requirement and its CORS behaviour, measured.

---

## Licence

[**GNU AGPL-3.0**](LICENSE). Anybody contributing here puts it under the same licence.
There is no contributor licence agreement — you keep your copyright, and the contribution
stands under the project's licence.

In practice: forking, rebuilding and running your own is expressly welcome. If you pass on
your version or host it for other people, your source belongs open as well.

`"private": true` in `package.json` stays. It only prevents accidental publishing to npm
and has nothing to do with the licence — this is an app, not a package.
