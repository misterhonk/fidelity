# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
dieses Projekt folgt [Semantic Versioning](https://semver.org/lang/de/).

Für eine App bedeutet SemVer:
**MAJOR** = Breaking Change am IndexedDB-Schema ohne automatische Migration ·
**MINOR** = Features · **PATCH** = Fixes.

## [Unreleased]

## [0.1.0] - 2026-08-09

**M0 · Fundament.** Eine leere, aber vollständig verdrahtete PWA: `pnpm dev`
startet sie, `pnpm build` erzeugt statische Dateien, und alle Prüfungen laufen
durch. Ein Dig ist noch nicht drin – der kommt mit M2.

### Added

- **Nuxt 4.5 als statisch generierte SPA** (`ssr: false`), Vue 3.5, TypeScript
  im `strict`-Modus. Kein Node zur Laufzeit, das Deployment ist ein Docroot.
- **IndexedDB-Datenmodell** über `idb` (~2 KB): neun Stores samt Indizes,
  Präferenzen mit Default-Merge, und der Verfallsjob, der die 6-Stunden-Regel
  der Discogs-ToS durchsetzt – Marktplatzfelder werden genullt, Score, Signale
  und Begründung bleiben.
- **Web Worker mit typisiertem `postMessage`-Protokoll.** Request/Response mit
  offenem Fortschrittskanal und Abbruch über `AbortSignal`. Der Main-Thread
  rendert, sonst nichts.
- **Design Tokens im DTCG-Format** (`tokens/*.json`) → Style Dictionary →
  Tailwind-4-`@theme`. OKLCH durchgehend, Farbschema-Rollen als eine einzige
  `light-dark()`-Deklaration, fluide Typo-Skala mit erzwungenem `rem`-Term
  (WCAG 1.4.4). Dazu Nuxt UI 4.
- **PWA**: Manifest, Maskable-Icons aus den Tokens gerendert, und
  `registerType: 'prompt'` samt Update-Banner – ein stilles `skipWaiting`
  würde den Code mitten in einem laufenden Dig austauschen.
- **Die drei Hub-Ports** (`HorizonSource`, `ShippingProfileSource`,
  `WatchService`) mit lokalen Implementierungen und der Fallback-Kette:
  2 s Timeout, kein Retry, lautloser Rückfall. Ein kaputter oder gar nicht
  vorhandener Hub ist ununterscheidbar (ADR-008).
- **Toolchain**: ESLint 10 mit `@nuxt/eslint`, Prettier, lefthook,
  commitlint, Vitest 4 mit `fake-indexeddb`, Playwright inklusive WebKit und
  `@axe-core/playwright`.
- **CI** mit Bundle-Budget: 120 KB gzip für den ersten sinnvollen Paint,
  Überschreitung bricht den Build. Alle Actions auf Commit-SHA gepinnt.
- **release-please** mit Keep-a-Changelog-Mapping.
- Projektkonzept und vollständige Architekturdokumentation unter `docs/`,
  ADR-001 bis ADR-008, HTML-Onepager und UI-Wireframes (9 Screens).

### Changed

Entscheidungen, die während M0 revidiert wurden – vor dem ersten Release, also
ohne Migrationspfad:

- **Architektur auf reine Client-PWA umgestellt (ADR-007).** Kein Backend,
  keine Datenbank, kein Serverprozess. Grundlage: Discogs erlaubt CORS aus dem
  Browser (`allow-origin: *`, `authorization` erlaubt), am 2026-08-09
  verifiziert. Der eigentliche Gewinn ist das Rate-Limit – es gilt pro IP, im
  Browser also pro Nutzer statt einmal für alle.
- Speicher von PostgreSQL auf IndexedDB umgestellt.
- Auth von OAuth 1.0a auf Personal Access Token
  (`POST /oauth/access_token` ist per CORS gesperrt).
- Katalogdaten: Volldump (10,4 GB) durch bedarfsgesteuerten Horizont ersetzt
  (ADR-005).
- Deployment auf statisches Hosting reduziert.

### Known Issues

- Der erste sinnvolle Paint liegt bei 114 von 120 KB gzip – und das mit einer
  leeren App. Nuxt UI und sein CSS machen den Löwenanteil aus.
- `--fid-accent` erreicht im Light Mode nur 3,09:1 gegen `--fid-bg` und
  verfehlt damit WCAG 2.2 AA für Fließtext. Betroffene Stellen weichen
  vorerst auf `--fid-text` aus.

[Unreleased]: https://github.com/misterhonk/fidelity/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/misterhonk/fidelity/releases/tag/v0.1.0
