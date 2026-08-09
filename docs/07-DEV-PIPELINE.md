# 07 – Entwicklungs-Pipeline

---

## 1. Repository

```
discogs-hifi/                    (GitHub: mister-honk/fidelity, privat)
├── .github/workflows/
│   ├── ci.yml
│   ├── release.yml
│   └── deploy.yml
├── app/                         # Nuxt: pages, components, composables, layouts
├── server/                      # Nitro: api, lib/discogs, jobs, db
├── shared/                      # zwischen Client & Server geteilte Typen/Zod-Schemas
├── scripts/catalog/             # Dump-Pipeline (läuft NUR lokal)
├── tokens/                      # DTCG Design Tokens
├── tests/{unit,e2e,fixtures}/
├── docs/
├── docker/
│   ├── Dockerfile
│   └── compose.yml
├── CHANGELOG.md
├── CLAUDE.md
└── release-please-config.json
```

**Branching:** Trunk-based. `main` ist immer deploybar. Feature-Branches
`feat/dig-scan`, kurzlebig, Squash-Merge.

---

## 2. Conventional Commits

```
<type>(<scope>): <subject>

feat(dig): add incremental matching during inventory scan
fix(discogs): handle both legacy and FastAPI error shapes
perf(match): index taste_name on normalized name
docs(api): document the 10k pagination wall
chore(deps): bump nuxt to 4.5.2
```

**Types → Keep a Changelog:**

| Type | CHANGELOG-Sektion | Release |
|---|---|---|
| `feat` | Added | minor |
| `fix` | Fixed | patch |
| `perf` | Changed | patch |
| `refactor` | Changed | patch |
| `docs`, `test`, `chore`, `ci`, `style` | – | keiner |
| `feat!` / `BREAKING CHANGE:` | Changed + ⚠️ | **major** |

**Scopes:** `dig`, `match`, `discogs`, `auth`, `catalog`, `basket`, `ui`, `db`, `deploy`

Erzwungen durch `commitlint` via `lefthook` (nicht `husky` – dessen letztes Release ist
von November 2024).

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

## 3. Versionierung & Changelog

**`release-please`**, nicht `semantic-release`.

Grund: release-please öffnet einen **Release-PR**, der Changelog und Version sammelt und den
man vor dem Merge redigieren kann. semantic-release feuert sofort beim Merge – richtig für
Libraries, falsch für eine App, bei der man ein menschliches Gate will.

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

`CHANGELOG.md` folgt **Keep a Changelog 1.1.0**. Handgeschriebene Ergänzungen im
Release-PR sind ausdrücklich erwünscht – generierte Changelogs sind vollständig, aber
selten verständlich.

**Tags:** `v0.3.0`. Docker-Images bekommen **beide** Tags: SemVer und Commit-SHA.

---

## 4. CI

```yaml
# .github/workflows/ci.yml (Auszug)
name: CI
on: { pull_request: {}, push: { branches: [main] } }

permissions:
  contents: read              # least privilege, workflow-weit

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  quality:
    runs-on: ubuntu-latest
    strategy: { matrix: { task: [lint, typecheck, test:unit] } }
    steps:
      # ⚠️ Alle Third-Party-Actions auf vollen Commit-SHA pinnen, nicht auf Tags.
      #    GitHub unterstützt seit Aug 2025 Policy-Enforcement dafür – einschalten.
      - uses: actions/checkout@<SHA>          # v5
      - uses: pnpm/action-setup@<SHA>         # v4
      - uses: actions/setup-node@<SHA>        # v5
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm ${{ matrix.task }}

  e2e:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15       # exakt die Uberspace-Major-Version
        env: { POSTGRES_PASSWORD: test }
        options: >-
          --health-cmd pg_isready --health-interval 10s --health-retries 5
    steps:
      - uses: actions/checkout@<SHA>
      - uses: pnpm/action-setup@<SHA>
      - uses: actions/setup-node@<SHA>
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium webkit
      - run: pnpm db:migrate
      - run: pnpm test:e2e        # inkl. @axe-core/playwright
```

> ⚠️ **WebKit im CI installieren.** Die App ist eine PWA, deren schwächstes Ziel iOS Safari
> ist. Nur Chromium zu testen heißt, den relevanten Browser nicht zu testen.

**Discogs-API im CI:** niemals live aufrufen. Aufgezeichnete Fixtures (`tests/fixtures/`)
plus ein MSW-artiger Interceptor. Ein einzelner echter Smoke-Test läuft **nightly**, nicht
pro PR – sonst brennt man das Rate-Limit für Merges.

---

## 5. Docker

### Lokal

```yaml
# docker/compose.yml
services:
  app:
    build: { context: .., dockerfile: docker/Dockerfile, target: dev }
    ports: ["3000:3000"]
    volumes: ["..:/app", "/app/node_modules"]
    environment:
      DATABASE_URL: postgres://fidelity:dev@db:5432/fidelity
      NUXT_DISCOGS_CONSUMER_KEY: ${DISCOGS_KEY}
      NUXT_DISCOGS_CONSUMER_SECRET: ${DISCOGS_SECRET}
    depends_on: { db: { condition: service_healthy } }

  db:
    image: postgres:15          # gleiche Major wie Uberspace (12–15, Default 15)
    environment:
      POSTGRES_USER: fidelity
      POSTGRES_PASSWORD: dev
      POSTGRES_DB: fidelity
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U fidelity"]
      interval: 5s

  mailpit:                      # Digest-Mails lokal ansehen
    image: axllent/mailpit
    ports: ["8025:8025"]

volumes: { pgdata: {} }
```

### Production-Image (mehrstufig)

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm build           # → .output/

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Nitros .output ist self-contained – KEIN node_modules nötig.
# Das ist der größte Image-Size-Gewinn und wird oft übersehen.
COPY --from=build /app/.output ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/index.mjs"]
```

> **Hinweis:** Auf Uberspace läuft **kein Docker**. Das Image ist für lokale
> Production-Parität und einen späteren VPS-Umzug. Der Uberspace-Deploy nutzt direkt
> das `.output`-Verzeichnis (siehe `08-DEPLOYMENT.md`).

### Cloudflare Tunnel für Mobile-Tests

```yaml
  tunnel:
    image: cloudflare/cloudflared:latest
    command: tunnel --no-autoupdate run --token ${CF_TUNNEL_TOKEN}
    profiles: ["tunnel"]        # docker compose --profile tunnel up
```

Damit ist die lokale Instanz unter einer echten HTTPS-URL erreichbar – nötig für:
PWA-Installation auf dem iPhone, Web Push (braucht HTTPS), und die
**OAuth-Callback-URL**, die Discogs sonst nicht akzeptiert.

---

## 6. Testing

| Ebene | Werkzeug | Was |
|---|---|---|
| Unit | Vitest 4 | **Scoring-Engine** (reine Funktion → Golden Files), Normalisierung, Rate-Limiter, Versandstaffel-Mathematik |
| Component | Vitest Browser Mode (Provider: Playwright) | `MatchCard`, `ScanProgress`, `CatalogRunGrid` |
| Integration | Vitest + echte Postgres im CI | Matching-Queries, Migrationen |
| E2E | Playwright | Login-Flow (gemockt), Dig-Ablauf, Korb |
| A11y | `@axe-core/playwright` | Jeder E2E-Screen |
| Contract | Fixtures aus echten API-Antworten | Discogs-Antwortformen, **beide Fehlerformate** |

**Der wichtigste Test des Projekts:**

```
tests/fixtures/inventory-*.json  (3 eingefrorene Händlerinventare)
tests/fixtures/collection-*.json (Martins + Jens' Sammlung, anonymisiert)
tests/__snapshots__/scoring.snap (erwartete Top-20 mit Scores)
```

Jede Gewichtsänderung zeigt sofort, was sie mit der Liste macht. Ohne das ist die
Score-Entwicklung Blindflug.

---

## 7. Abhängigkeiten

**Renovate**, nicht Dependabot: Gruppierung (alle `@nuxt/*` in einem PR), Automerge für
Patch + devDependencies nach grünem CI, Zeitfenster-Batching, und – wichtig – es bumpt auch
die **gepinnten Action-SHAs** samt Kommentar-Tag.

```jsonc
// renovate.json
{
  "extends": ["config:recommended", ":semanticCommits"],
  "schedule": ["before 5am on monday"],
  "packageRules": [
    { "matchUpdateTypes": ["patch"], "matchDepTypes": ["devDependencies"], "automerge": true },
    { "matchPackagePatterns": ["^@nuxt/", "^nuxt$"], "groupName": "nuxt" },
    { "matchPackagePatterns": ["^drizzle"], "enabled": false }   // ⚠️ bewusst gepinnt
  ]
}
```

> ⚠️ **Drizzle bewusst von Renovate ausgenommen.** Die 1.0-Linie ist seit über 18 Monaten
> im RC; ein automatischer Sprung dorthin wäre ein Ausfall. Manuell und bewusst upgraden.

---

## 8. Observability

- **Sentry** `@sentry/nuxt` (Free Tier reicht) – Errors, Performance, Release Health,
  verknüpft mit den release-please-Tags via `sentry-cli releases`
- **OpenTelemetry** für die Scan-Schleife (Sentry v8+ baut ohnehin auf OTel auf):
  - Span pro Inventarseite, Attribut `discogs.rate_limit_remaining`
  - Counter für 429er
  - Histogramm der Seiten-Latenz

Das ist der Unterschied zwischen *„der Scan ist langsam"* und *„wir werden ab Seite 84
gedrosselt, weil `remaining` auf 3 steht."*

- **Strukturiertes Logging** (JSON), Level über ENV. **Niemals** OAuth-Tokens loggen –
  Redaction-Liste im Logger fest verdrahtet.
- **Health-Endpunkt** `/api/health`: DB-Ping, pg-boss-Status, letzter erfolgreicher Dig,
  aktuelles Rate-Limit-Budget.
