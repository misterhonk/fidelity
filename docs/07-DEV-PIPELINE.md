# 07 – Development pipeline

---

## 1. Repository

```
discogs-hifi/                    (GitHub: mister-honk/fidelity, private)
├── .github/workflows/
│   ├── ci.yml
│   ├── release.yml
│   └── deploy.yml
├── app/                         # Nuxt: pages, components, composables, layouts
├── worker/                      # Web worker: discogs/, match/, horizon/
├── db/                          # The IndexedDB schema and access via idb
├── shared/                      # Types + the postMessage protocol
├── tokens/                      # DTCG design tokens
├── tests/{unit,e2e,fixtures}/
├── docs/
├── CHANGELOG.md
├── CLAUDE.md
└── release-please-config.json
```

**Branching:** trunk-based. `main` is always deployable. Feature branches
`feat/dig-scan`, short-lived, squash-merged.

---

## 2. Conventional Commits

```
<type>(<scope>): <subject>

feat(dig): add incremental matching during inventory scan
fix(discogs): handle both legacy and FastAPI error shapes
perf(match): index taste_name on normalized name
docs(discogs): document the 10k pagination wall
chore(deps): bump nuxt to 4.5.2
```

**Types → Keep a Changelog:**

| Type | CHANGELOG section | Release |
|---|---|---|
| `feat` | Added | minor |
| `fix` | Fixed | patch |
| `perf` | Changed | patch |
| `refactor` | Changed | patch |
| `docs`, `test`, `chore`, `ci`, `style` | – | none |
| `feat!` / `BREAKING CHANGE:` | Changed + ⚠️ | **major** |

**Scopes:** `dig`, `match`, `discogs`, `auth`, `catalog`, `basket`, `ui`, `db`, `deploy`

Enforced by `commitlint` via `lefthook` (not `husky` — whose last release is from November
2024).

```yaml
# lefthook.yml
pre-commit:
  parallel: true
  commands:
    lint:      { glob: "*.{ts,vue,js}", run: "pnpm eslint --fix {staged_files}", stage_fixed: true }
    format:    { glob: "*.{ts,vue,css,json,md}", run: "pnpm prettier --write {staged_files}", stage_fixed: true }
    typecheck: { glob: "*.{ts,vue}", run: "pnpm typecheck" }
commit-msg:
  commands:
    commitlint: { run: "pnpm commitlint --edit {1}" }
pre-push:
  commands:
    test: { run: "pnpm test:unit" }
```

---

## 3. Versioning & changelog

**`release-please`**, not `semantic-release`.

The reason: release-please opens a **release PR** that collects the changelog and the
version and can be edited before merging. semantic-release fires immediately on merge —
right for libraries, wrong for an app where you want a human gate.

```jsonc
// release-please-config.json
{
  "packages": {
    ".": {
      "release-type": "node",
      "changelog-path": "CHANGELOG.md",
      "bump-minor-pre-major": true,
      "draft": false,
      "changelog-sections": [
        { "type": "feat",     "section": "Added" },
        { "type": "fix",      "section": "Fixed" },
        { "type": "perf",     "section": "Changed" },
        { "type": "refactor", "section": "Changed" },
        { "type": "revert",   "section": "Removed" },
        { "type": "deprecate","section": "Deprecated" },
        { "type": "docs",     "section": "Documentation", "hidden": true },
        { "type": "chore",    "hidden": true }
      ]
    }
  }
}
```

`CHANGELOG.md` follows **Keep a Changelog 1.1.0**. Hand-written additions in the release PR
are expressly welcome — generated changelogs are complete but rarely comprehensible.

**Tags:** `v0.3.0`. Docker images get **both** tags: the SemVer one and the commit SHA.

---

## 4. CI

```yaml
# .github/workflows/ci.yml (extract)
name: CI
on: { pull_request: {}, push: { branches: [main] } }

permissions:
  contents: read              # least privilege, workflow-wide

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  quality:
    runs-on: ubuntu-latest
    strategy: { matrix: { task: [lint, typecheck, test:unit] } }
    steps:
      # ⚠️ Pin all third-party actions to a full commit SHA, not to a tag.
      #    GitHub has supported policy enforcement for this since Aug 2025 –
      #    turn it on.
      - uses: actions/checkout@<SHA>          # v5
      - uses: pnpm/action-setup@<SHA>         # v4
      - uses: actions/setup-node@<SHA>        # v5
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm ${{ matrix.task }}

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<SHA>
      - uses: pnpm/action-setup@<SHA>
      - uses: actions/setup-node@<SHA>
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium webkit
      - run: pnpm test:e2e        # including @axe-core/playwright
      - run: pnpm size            # the bundle budget
```

> ⚠️ **Install WebKit in CI.** The app is a PWA whose weakest target is iOS Safari. Testing
> only Chromium means not testing the browser that matters.

**The Discogs API in CI:** never call it live. Recorded fixtures (`tests/fixtures/`) plus an
MSW-style interceptor. A single real smoke test runs **nightly**, not per PR — otherwise you
burn the rate limit on merges.

---

## 5. Local development

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

**No Docker, no database, no compose stack.** There is nothing to orchestrate. All you need
is a Personal Access Token from `discogs.com/settings/developers`.

### Mobile testing

PWA installation and the service worker need HTTPS:

```bash
cloudflared tunnel --url http://localhost:3000     # for fast iteration
```

For anything that needs a **stable origin** (IndexedDB and the service worker hang off the
origin!), use the staging domain instead — a changing tunnel hostname throws away all local
data on every start. See `08-DEPLOYMENT.md` §4.

### The bundle budget

```bash
pnpm size          # size-limit, fails when exceeded
```

Budget and reasoning: `12-RESSOURCEN-BUDGET.md` §2. Runs in CI too.

## 6. Testing

| Level | Tool | What |
|---|---|---|
| Unit | Vitest 4 | **The scoring engine** (a pure function → golden files), normalisation, throttling, shipping-tier arithmetic |
| Component | Vitest browser mode (provider: Playwright) | `MatchCard`, `ScanProgress`, `CatalogRunGrid` |
| Integration | Vitest + fake-indexeddb | Stores, migrations, horizon packing |
| Performance | Vitest benchmark | Score 20,000 listings in < 250 ms |
| E2E | Playwright | Login flow (mocked), the dig run, the basket, **starting with no network** |
| A11y | `@axe-core/playwright` | Every E2E screen |
| Contract | Fixtures from real API responses | Discogs response shapes, **both error formats** |

⚠️ **The offline test runs in Chromium only.** Playwright's WebKit does have a service
worker but aborts internally on a reload with the connection cut ("WebKit encountered an
internal error") — before the first byte of app code. The test skips itself there with that
reason rather than being green on iOS Safari's account. **So iOS Safari has to be checked by
hand**, and it is the target that matters.

Cross-checked with a negative control: unregister the worker, clear the caches, and the app
no longer starts offline. So the test measures the service worker and not the browser's HTTP
cache.

**The project's most important test:**

```
tests/fixtures/inventory-*.json  (3 frozen dealer inventories)
tests/fixtures/collection-*.json (Martin's + Jens's collections, anonymised)
tests/__snapshots__/scoring.snap (the expected top 20 with scores)
```

Every change to a weight shows immediately what it does to the list. Without that, score
development is flying blind.

---

## 7. Dependencies

**Renovate**, not Dependabot: grouping (all `@nuxt/*` in one PR), automerge for patches and
devDependencies after green CI, time-window batching, and — importantly — it also bumps the
**pinned action SHAs** together with their comment tag.

```jsonc
// renovate.json
{
  "extends": ["config:recommended", ":semanticCommits"],
  "schedule": ["before 5am on monday"],
  "packageRules": [
    { "matchUpdateTypes": ["patch"], "matchDepTypes": ["devDependencies"], "automerge": true },
    { "matchPackagePatterns": ["^@nuxt/", "^nuxt$"], "groupName": "nuxt" },
    { "matchPackagePatterns": ["^@vite-pwa"], "automerge": false }  // check SW changes
  ]
}
```

> ⚠️ **Never automerge PWA updates.** A broken service worker is the one failure you cannot
> take back with a deploy — old clients hold on to it.

---

## 8. Observability

**Optional** — and deliberately sparing, because every byte lands on the user's device:

- **Sentry** `@sentry/nuxt`, **without session replay**, `sendDefaultPii: false`
- ⚠️ **A `beforeSend` hook that filters out the Personal Access Token.** A token in an error
  report would be the worst imaginable bug in this app:

```ts
beforeSend(event) {
  const s = JSON.stringify(event)
  return s.includes(getToken()) ? null : event
}
```

- **No OpenTelemetry**, no health endpoint, no structured server logging — there is no
  server.
- **In-app diagnostics instead of monitoring:** a debug screen shows the number of requests,
  429s, the duration of recent digs and the size of IndexedDB. That is enough for a tool
  among friends and costs nobody any bandwidth.
