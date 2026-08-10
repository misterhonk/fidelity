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
├── worker/                      # Web Worker: discogs/, match/, horizon/
├── db/                          # IndexedDB-Schema und Zugriff via idb
├── shared/                      # Typen + postMessage-Protokoll
├── tokens/                      # DTCG Design Tokens
├── tests/{unit,e2e,fixtures}/
├── docs/
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
    steps:
      - uses: actions/checkout@<SHA>
      - uses: pnpm/action-setup@<SHA>
      - uses: actions/setup-node@<SHA>
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium webkit
      - run: pnpm test:e2e        # inkl. @axe-core/playwright
      - run: pnpm size            # Bundle-Budget
```

> ⚠️ **WebKit im CI installieren.** Die App ist eine PWA, deren schwächstes Ziel iOS Safari
> ist. Nur Chromium zu testen heißt, den relevanten Browser nicht zu testen.

**Discogs-API im CI:** niemals live aufrufen. Aufgezeichnete Fixtures (`tests/fixtures/`)
plus ein MSW-artiger Interceptor. Ein einzelner echter Smoke-Test läuft **nightly**, nicht
pro PR – sonst brennt man das Rate-Limit für Merges.

---

## 5. Lokale Entwicklung

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

**Kein Docker, keine Datenbank, kein Compose-Stack.** Es gibt nichts zu orchestrieren.
Man braucht nur einen Personal Access Token aus `discogs.com/settings/developers`.

### Mobile Tests

PWA-Installation und Service Worker brauchen HTTPS:

```bash
cloudflared tunnel --url http://localhost:3000     # schnelle Iteration
```

Für alles, was einen **stabilen Origin** braucht (IndexedDB und Service Worker hängen
am Origin!), lieber die Staging-Domain nutzen – ein wechselnder Tunnel-Hostname wirft
bei jedem Start alle lokalen Daten weg. Siehe `08-DEPLOYMENT.md` §4.

### Bundle-Budget

```bash
pnpm size          # size-limit, bricht bei Überschreitung
```

Budget und Begründung: `12-RESSOURCEN-BUDGET.md` §2. Läuft auch im CI.

## 6. Testing

| Ebene | Werkzeug | Was |
|---|---|---|
| Unit | Vitest 4 | **Scoring-Engine** (reine Funktion → Golden Files), Normalisierung, Drosselung, Versandstaffel-Mathematik |
| Component | Vitest Browser Mode (Provider: Playwright) | `MatchCard`, `ScanProgress`, `CatalogRunGrid` |
| Integration | Vitest + fake-indexeddb | Stores, Migrationen, Horizont-Packung |
| Performance | Vitest Benchmark | 20.000 Listings scoren < 250 ms |
| E2E | Playwright | Login-Flow (gemockt), Dig-Ablauf, Korb, **Start ohne Netz** |
| A11y | `@axe-core/playwright` | Jeder E2E-Screen |
| Contract | Fixtures aus echten API-Antworten | Discogs-Antwortformen, **beide Fehlerformate** |

⚠️ **Der Offline-Test läuft nur in Chromium.** Playwrights WebKit hat zwar einen
Service Worker, bricht aber beim Neuladen mit gekappter Verbindung browser-intern ab
(„WebKit encountered an internal error") – vor dem ersten Byte App-Code. Der Test
überspringt sich dort mit dieser Begründung, statt auf iOS Safaris Rechnung grün zu sein.
**iOS Safari bleibt also von Hand zu prüfen**, und es ist das Ziel, auf das es ankommt.

Gegengeprüft mit einer Negativkontrolle: Worker abgemeldet und Caches geleert, und die
App startet offline nicht mehr. Der Test misst damit den Service Worker und nicht den
HTTP-Cache des Browsers.

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
    { "matchPackagePatterns": ["^@vite-pwa"], "automerge": false }  // SW-Änderungen prüfen
  ]
}
```

> ⚠️ **PWA-Updates nie automergen.** Ein kaputter Service Worker ist der einzige Fehler,
> den man nicht per Deploy zurücknehmen kann – alte Clients halten ihn fest.

---

## 8. Observability

**Optional** – und bewusst sparsam, weil jedes Byte beim Nutzer landet:

- **Sentry** `@sentry/nuxt`, **ohne Session Replay**, `sendDefaultPii: false`
- ⚠️ **`beforeSend`-Hook, der den Personal Access Token herausfiltert.** Ein Token in
  einem Fehler-Report wäre der schlimmste denkbare Bug dieser App:

```ts
beforeSend(event) {
  const s = JSON.stringify(event)
  return s.includes(getToken()) ? null : event
}
```

- **Kein OpenTelemetry**, kein Health-Endpunkt, kein strukturiertes Server-Logging –
  es gibt keinen Server.
- **In-App-Diagnose statt Monitoring:** ein Debug-Screen zeigt Anzahl Requests, 429er,
  Dauer der letzten Digs und Größe der IndexedDB. Das reicht für ein Freundes-Tool und
  kostet niemanden Bandbreite.
