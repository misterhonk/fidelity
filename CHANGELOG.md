# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
dieses Projekt folgt [Semantic Versioning](https://semver.org/lang/de/).

Für eine App bedeutet SemVer:
**MAJOR** = Datenmigration oder Breaking Config · **MINOR** = Features · **PATCH** = Fixes.

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
