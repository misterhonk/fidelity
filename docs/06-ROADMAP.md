# 06 – Roadmap

> SemVer für eine App: **MAJOR** = Datenmigration oder Breaking Config,
> **MINOR** = Features, **PATCH** = Fixes.
> Jeder Meilenstein endet mit einem Tag und einem `CHANGELOG.md`-Eintrag.

---

## M0 · Fundament → `v0.1.0`

**Ziel:** `docker compose up` startet eine leere, aber vollständig verdrahtete App.

- [ ] Nuxt 4.5 Skeleton, TypeScript, pnpm
- [ ] Docker Compose: `app` (Node 22), `db` (Postgres, gleiche Major wie Uberspace), `mailpit`
- [ ] Drizzle + erste Migration, Extensions `pg_trgm`/`unaccent`/`pgcrypto`
- [ ] Tailwind 4 + Nuxt UI 4 + Design Tokens (DTCG → Style Dictionary → `@theme`)
- [ ] ESLint + Prettier + lefthook + commitlint (Conventional Commits)
- [ ] Vitest + Playwright Grundgerüst, ein echter Smoke-Test
- [ ] GitHub Actions: lint ∥ typecheck ∥ test → build
- [ ] release-please + Keep-a-Changelog-Mapping
- [ ] `CLAUDE.md`, ADR-Ordner
- [ ] Cloudflare Tunnel für Mobile-Tests dokumentiert

**Definition of Done:** Frischer Clone → `docker compose up` → App läuft, Tests grün, ein
Conventional Commit erzeugt einen Release-PR.

---

## M1 · Auth & Sync → `v0.2.0`

**Ziel:** Martin loggt sich mit seinem Discogs-Account ein und sieht seine Sammlung.

- [ ] Discogs-App registrieren (Consumer Key/Secret) – Callback-URL beachten
- [ ] OAuth 1.0a mit **PLAINTEXT**-Signatur (kein HMAC-SHA1!), 4-Schritte-Flow
- [ ] Token verschlüsselt via `pgcrypto`, Key aus ENV
- [ ] Session-Cookie, Einladungscodes
- [ ] **Discogs-Client** mit adaptivem Token-Bucket, 429-Backoff, beide Fehlerformate
- [ ] pg-boss + Job `collection.sync` (Sammlung + Wantlist, TTL 24 h)
- [ ] `taste_profile` + `taste_name` berechnen (Lift-basiert)
- [ ] Screen „Deine Landkarte": Labels, Stile, Dekaden, Künstler

**Risiko:** OAuth 1.0a ist fummelig. **Mitigation:** PLAINTEXT nutzen – das eliminiert die
Base-String-Konstruktion, die Ursache praktisch aller Forenprobleme. Integrationstest gegen
`/oauth/identity` als erster grüner Test.

---

## M2 · Der erste Dig → `v0.3.0` — **das ist der Beweis, dass die Idee trägt**

**Ziel:** Händlername eingeben → in 2 Minuten eine bewertete Trefferliste.

- [ ] `dig.scan`-Job: Inventar paginieren, `per_page=100`
- [ ] Vorabprüfung `num_for_sale`, ehrliche Ansage bei > 10.000
- [ ] Zweiter Durchlauf `sort_order=desc` für Listings 10.001–20.000
- [ ] Harte Filter (Format, Zustand, Preis, Herkunft)
- [ ] Signale **S1** (Wantlist exakt), **S3** (Künstler), **S5** (Label) — alle gratis
- [ ] Fuzzy-Matching-Kaskade: exact → Token-Containment → `pg_trgm`
- [ ] Barry Score v1 mit Sättigung, Begründungssatz-Templates
- [ ] SSE-Fortschritt, **inkrementelles Matching** (erste Treffer nach ~5 s)
- [ ] Screens: Neuer Dig, Dig läuft, Dig-Ergebnis, `MatchCard`
- [ ] `expires_at = now() + 6h` inkl. UI-Sperre nach Ablauf

**Definition of Done:** Martin scannt seinen Stammhändler und findet mindestens eine Platte,
die er ohne die App nicht gefunden hätte. **Das ist der eigentliche Projektmeilenstein.**

---

## M3 · Barry wird klüger → `v0.4.0`

- [ ] Signal **S7** (Stil-Adjazenz, Zentroid + Kosinus in SQL)
- [ ] Feedback-Buttons (👍😐👎🛒) mit Signal-Snapshot
- [ ] Händler-Fingerprint + Affinity-Score → „The Clerk's Take"
- [ ] Filterleiste mit Signal-Chips, Sortierung, Dichte-Umschalter
- [ ] Virtualisierte Liste, Command Palette (⌘K)
- [ ] Release-Detail-Sheet mit View Transition
- [ ] Precision@5 messen (Ziel ≥ 0,6), Gewichte manuell nachziehen
- [ ] Golden-File-Tests der Scoring-Engine

---

## M4 · Der Korb → `v0.5.0`

- [ ] Warenkorb pro Händler
- [ ] Versandstaffel-Eingabe + Crowdsourcing über Nutzer hinweg
- [ ] Freitext-Parser für `seller.shipping` (Heuristik, klar als solche gekennzeichnet)
- [ ] Grenzkosten-Kurve + „+1 Platte spart X €/Stk"
- [ ] Kandidatenvorschläge im passenden Preisfenster
- [ ] Signale **S10** (Preis) + **S11** (Seltenheit) via `/marketplace/stats/` —
      **nur für die Top 50 nach Vorscore**, als separate Job-Phase
- [ ] Greedy-Optimierer + Swap-Verbesserung
- [ ] Deeplinks zu Discogs (kein eigener Checkout)

---

## M5 · Die Katalog-DB → `v0.6.0` — **der große Brocken**

- [ ] Download-Skript mit SHA-256-Prüfung gegen `CHECKSUM.txt`
- [ ] Streaming-SAX-Parser (nie mehr als eine Entität im RAM)
- [ ] Extraktion nur der benötigten Felder → `catalog`-Schema, COPY-Bulk
- [ ] **Platzbedarf real messen** vor dem Deploy (Schätzung ~6 GB / 10 GB Quota)
- [ ] `pg_dump --schema=catalog | zstd` → rsync → `psql` auf Uberspace
- [ ] Monatlicher Refresh dokumentiert (halbautomatisch, Auslöser lokal)
- [ ] Signale **S2** (Pressing), **S4** (Diskografie-Lücke), **S6** (Katalogserie),
      **S8** (Credit-Graph), **S9** (Format-Upgrade)
- [ ] `CatalogRunGrid`-Komponente
- [ ] Credit-Graph-Explorer: „Alle Conny-Plank-Produktionen bei diesem Händler"

**Risiko:** 10,4 GB gz / ~110 GB entpackt. **Mitigation:** Streaming, lokal, Eskalationsstufen
für das Quota siehe `03-DATENMODELL.md` §3.

---

## M6 · Watchlist & PWA → `v0.7.0`

- [ ] Händler-Watchlist mit `next_run_at`-Staffelung
- [ ] Diff über `watch_seen` (nur listing_ids – kein 6-h-Konflikt)
- [ ] Web Push (VAPID), iOS: Coach-Mark für Home-Screen-Installation
- [ ] E-Mail-Digest als Fallback
- [ ] `@vite-pwa/nuxt`, App-Shell-Precache, IndexedDB-Outbox (**kein** Background Sync)
- [ ] Offline-Modus für Sammlung und letzten Dig
- [ ] In-Store-Screen (mobil, große Targets, offline)

**Rechenlast beachten:** Ohne `updated_since`-Parameter ist jeder Rescan ein Vollscan.
Bei 5 beobachteten Händlern à 10.000 Listings sind das 500 Requests/Tag ≈ 9 Minuten
API-Zeit. Bei 20 Händlern wird es eng. → Kadenz-Limit pro Nutzer, globale Staffelung.

---

## M7 · Pressing-Beratung → `v0.8.0`

- [ ] Matrix/Runout aus `identifiers` (Dump-Erweiterung)
- [ ] Mastering-Stempel erkennen (RVG, Porky, RL, Pecko)
- [ ] Original vs. Reissue heuristisch aus Land, Jahr, Labelvariante, Presswerk
- [ ] Fallen-Warnung: „Japan-Reissue 1983, kein 65er Original"
- [ ] Widerspruchsprüfung: Händler-`comments` vs. Release-Daten

---

## M8 · Härtung & Freundeskreis → `v1.0.0`

- [ ] Multi-User-Lasttest, Job-Fairness (ein Nutzer blockiert nicht alle)
- [ ] Globale Dig-Warteschlange mit sichtbarer Position
- [ ] Sentry, strukturiertes Logging, Health-Endpunkt
- [ ] Backup-/Restore-Runbook für Uberspace
- [ ] Datenschutzerklärung, Impressum, Datenexport, Kontolöschung
- [ ] Attributions-Strings an jeder Stelle mit Discogs-Daten
- [ ] Onboarding-Flow, den Jens ohne Rückfrage schafft
- [ ] A11y-Audit: Tastatur + VoiceOver komplett

---

## Nicht auf der Roadmap

| Idee | Warum nicht |
|---|---|
| Wantlist-Alerts | Discogs besitzt Wantlister – aussichtslos |
| Eigener Checkout | ToS-Verstoß, strategisch dumm |
| Sammlungs-Katalogisierung | Gelöstes Problem, ein Dutzend Apps |
| Native App | PWA reicht für diesen Anwendungsfall vollständig |
| Bezahlmodell | ToS verbietet Gebühren für API-integrierte Apps ohne schriftliche Genehmigung |
| Multi-Händler-Suche | Es gibt **keinen** Listings-by-Release-Endpunkt. Nur über Scraping – kommt nicht in Frage. |

---

## Reihenfolge-Logik

```
M0 ─▶ M1 ─▶ M2 ─────────────────────▶ M3 ─▶ M4 ─▶ M6 ─▶ M8
              │                                    ▲
              └──▶ M5 (Katalog-DB) ────────────────┘
                        └──▶ M7 (Pressing)
```

**M2 ist der Beweis-Meilenstein.** Wenn Martin danach nicht mindestens eine Platte findet,
die er sonst übersehen hätte, stimmt etwas an der These nicht – dann lieber die
Match-Signale überdenken als M3 bauen.
