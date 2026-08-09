# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
dieses Projekt folgt [Semantic Versioning](https://semver.org/lang/de/).

Für eine App bedeutet SemVer:
**MAJOR** = Datenmigration oder Breaking Config · **MINOR** = Features · **PATCH** = Fixes.

## 0.1.0 (2026-08-09)


### Added

* add /api/health with a database check ([6513a3f](https://github.com/misterhonk/fidelity/commit/6513a3fc116ae89fea0849f3a0758ec814b1c2cf))
* add the hub ports with their local implementations ([5a5ffd7](https://github.com/misterhonk/fidelity/commit/5a5ffd7d05e7806ee0a108a939589ce5e84c202d))
* add the web worker and its typed postMessage protocol ([f404800](https://github.com/misterhonk/fidelity/commit/f4048000f19db01ebd365accda6fb3e799a3a39d))
* **db:** add drizzle schema and first migration for the app schema ([46bcf75](https://github.com/misterhonk/fidelity/commit/46bcf75137cfa276c146c5e106da6bce5f19fb72))
* **db:** add the indexeddb stores via idb ([d7bd142](https://github.com/misterhonk/fidelity/commit/d7bd14210521e9dbf036406d4abf296901984956))
* **deploy:** add docker compose stack with app, postgres 15 and mailpit ([6777b08](https://github.com/misterhonk/fidelity/commit/6777b08ccc899d74aa11dbe6c455c4a2440941e3))
* **pwa:** add the manifest, icons and a prompted update ([83237a9](https://github.com/misterhonk/fidelity/commit/83237a91752761afb420c59cfa5b137bce16ea1b))
* scaffold nuxt 4.5 skeleton with typescript and pnpm ([50205bb](https://github.com/misterhonk/fidelity/commit/50205bbb7ec0d180d8c4a235a8208f6ed867eef7))
* switch nuxt to spa mode with static output ([ad13e63](https://github.com/misterhonk/fidelity/commit/ad13e6368bd8faacf8c6b23d2accaff7bae35757))
* **ui:** add DTCG design tokens, tailwind 4 and nuxt ui 4 ([c659f29](https://github.com/misterhonk/fidelity/commit/c659f29ef1789c22de8fc6b9a8ab3d4ca0baf5aa))


### Fixed

* pin the first release to v0.1.0 and align the commit scopes ([38333bc](https://github.com/misterhonk/fidelity/commit/38333bcfca032add76f52c704b7528cca0e59ef1))
* stop tracking the dist symlink ([74342a9](https://github.com/misterhonk/fidelity/commit/74342a9923b1b66f398afdb68e195ea0806d5623))


### Changed

* remove the server layer, database and docker stack ([ae387fb](https://github.com/misterhonk/fidelity/commit/ae387fb35c0971a791063c055191456cfd9ce658))

## [Unreleased]

### Changed

- **Architektur auf reine Client-PWA umgestellt (ADR-007).** Kein Backend, keine
  Datenbank, kein Serverprozess. Grundlage: Discogs erlaubt CORS aus dem Browser
  (`allow-origin: *`, `authorization` erlaubt), verifiziert am 2026-08-09
- Speicher von PostgreSQL auf IndexedDB umgestellt
- Auth von OAuth 1.0a auf Personal Access Token
  (`POST /oauth/access_token` ist per CORS gesperrt)
- Katalogdaten: Volldump (10,4 GB) durch bedarfsgesteuerten Horizont ersetzt (ADR-005)
- Deployment auf statisches Hosting reduziert

### Added

- Projektkonzept und vollständige Architekturdokumentation unter `docs/`
- ADR-007 (Client-only PWA), ADR-005 neu gefasst
- `docs/11-KATALOG-STRATEGIE.md`, `docs/12-RESSOURCEN-BUDGET.md`, `docs/13-HUB-ADDON.md`
- ADR-008: optionaler, selbst hostbarer Hub (M9)
- Architecture Decision Records ADR-001 bis ADR-006
- Design-System-Spezifikation mit OKLCH-Tokens im DTCG-Format
- HTML-Onepager und UI-Wireframes (9 Screens)
- Deployment-Alternativen: VPS, Homeserver mit Cloudflare Tunnel

[Unreleased]: https://github.com/mister-honk/fidelity/compare/v0.0.0...HEAD
