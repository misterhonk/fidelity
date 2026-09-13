# The demo account

> **Status:** set up and filled on 2026-09-13, the smoke run syncs it since the same day · **Script:** `scripts/demo/fill.mjs` · **Smoke:** `tests/e2e/smoke/staging.spec.ts`

A second Discogs account, otherwise empty, that carries a collection anybody may look at.
Martin owns it; its token is a secret, never a line in this repository.

## 1. What it is for

- **The nightly smoke run** syncs it for real, on a fresh device against the live origin — the
  one test in the project that talks to Discogs with a token. Everything else is mocked
  (CLAUDE.md, and `tests/e2e/seed.ts` answers 401 for the fake token).
- **Testers** get a shelf that is not their own: sixty records across jazz, electronic and the
  rest, a wantlist of fifteen, ratings on a third, two notes. Enough for the wall, the map, the
  plan and the wantlist to have something to say.
- **Screenshots** in the docs come from here, so nobody's own collection is in them.

## 2. Filling it

```bash
DISCOGS_DEMO_TOKEN=… pnpm demo:fill --dry-run   # what would be added
DISCOGS_DEMO_TOKEN=… pnpm demo:fill             # adds it
```

The token comes from the environment and nowhere else — not an argument, not a file. The
script is idempotent: what the account already holds is skipped, so it can be run again after
the list in `scripts/demo/fill.mjs` grows. One request at a time, 1 200 ms apart; a 429 waits
a minute and tries once more. Each record is resolved through `/database/search` to the
first vinyl release that fits the title, the year preferred; the demo shelf does not need a
particular pressing.

## 3. Where the token lives

| Place | Name | Used by |
|---|---|---|
| GitHub environment secret, environment `martinmelcher.de` (next to the deploy keys; the Smoke job names that environment) | `DISCOGS_DEMO_TOKEN` | the Smoke workflow — the sync test skips when it is missing |
| Martin's shell, for the moment | `DISCOGS_DEMO_TOKEN` | `pnpm demo:fill` |

Never in `.env`, never in a test file, never in a URL. A token that was pasted anywhere else
is treated as exposed and regenerated at Discogs — the account holds nothing that matters.
