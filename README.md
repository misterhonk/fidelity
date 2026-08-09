# Fidelity

> Der Verkäufer hinter der Theke – für Discogs.

Discogs ist eine Suchmaschine, kein Plattenladen. Es beantwortet *„Habt ihr Platte X?"*
perfekt und *„Was hättet ihr für mich?"* überhaupt nicht.

**Fidelity** scannt das Sortiment eines Discogs-Händlers, gleicht es gegen deine Sammlung
und Wantlist ab und liefert eine bewertete Fundliste – **mit einem Satz Begründung
pro Treffer**.

```
Du: "vinyl-tom"
Fidelity, 2 Minuten später:

  91 · Side One, Track One
  Neu! – Neu! 2 · Brain BRAIN 1031 · DE 1973 · VG+ · 24,00 €
  Conny Plank am Pult – du hast 9 seiner Produktionen, diese nicht.
  In der Brain-1000er-Reihe fehlen dir nur noch 1051 und 1060.
  Markt-Tiefstpreis: 41 €.
```

---

## Status

**Konzeptphase.** Noch kein Code. Die Dokumentation unter [`docs/`](docs/) ist vollständig
und als Arbeitsgrundlage für Claude Code gedacht.

## Dokumentation

| Dokument | Inhalt |
|---|---|
| [`docs/00-KONZEPT.md`](docs/00-KONZEPT.md) | Vision, Namensgebung, Wettbewerb, Feature-Backlog |
| [`docs/01-ARCHITEKTUR.md`](docs/01-ARCHITEKTUR.md) | Systemdesign, Tech-Stack mit Begründung, Discogs-Client |
| [`docs/02-DISCOGS-API.md`](docs/02-DISCOGS-API.md) | API-Referenz, verifizierte Limits, Bugs, Fallen |
| [`docs/03-DATENMODELL.md`](docs/03-DATENMODELL.md) | Postgres-Schema, drei Schemas mit getrennter Lizenzsemantik |
| [`docs/04-MATCHING-ENGINE.md`](docs/04-MATCHING-ENGINE.md) | Die 11 Signale, Barry Score, Begründungssätze |
| [`docs/05-DESIGN-SYSTEM.md`](docs/05-DESIGN-SYSTEM.md) | Design Tokens, Komponenten, A11y, PWA |
| [`docs/06-ROADMAP.md`](docs/06-ROADMAP.md) | M0–M8 mit Definition of Done |
| [`docs/07-DEV-PIPELINE.md`](docs/07-DEV-PIPELINE.md) | Docker, CI, Conventional Commits, release-please |
| [`docs/08-DEPLOYMENT.md`](docs/08-DEPLOYMENT.md) | Uberspace: supervisord, Postgres, Symlink-Releases |
| [`docs/09-LEGAL.md`](docs/09-LEGAL.md) | Discogs ToS, CC0, DSGVO, BFSG |
| [`docs/10-DEPLOYMENT-ALTERNATIVEN.md`](docs/10-DEPLOYMENT-ALTERNATIVEN.md) | VPS, Homeserver, Cloudflare Tunnel – Vergleich, Entscheidung offen |
| [`docs/adr/`](docs/adr/) | Architecture Decision Records |

**Zum Anschauen im Browser:**

| Datei | Inhalt |
|---|---|
| [`konzept-onepager.html`](konzept-onepager.html) | Konzept auf einer Seite – Wettbewerbsmatrix, Signale, Roadmap |
| [`wireframes.html`](wireframes.html) | Neun UI-Screens mit Annotationen und echten Design-Tokens |

## Die drei Fakten, die alles bestimmen

1. **Discogs gibt maximal 10.000 Listings pro fremdem Händler heraus.**
   Seite 101 liefert 403. Mit `sort_order` asc+desc kommt man auf 20.000. Bei größeren
   Sortimenten ist vollständige Abdeckung unmöglich – und die UI muss das ehrlich sagen.

2. **Das Rate-Limit von 60 Requests/Minute gilt pro IP, nicht pro Token.**
   Mehr Nutzer bringen kein größeres Budget. Ein Dig kostet ~101 Requests ≈ 2 Minuten.

3. **Marktplatzdaten dürfen max. 6 Stunden alt angezeigt werden – Katalogdaten aus den
   monatlichen Dumps sind CC0 und komplett frei.**
   Daraus folgt die Kernarchitektur: Katalog offline aus Dumps, Marktplatz live aus der API.

## Tech-Stack (Kurzfassung)

```
Runtime    Node 22 LTS (Uberspace-Limit)        pnpm
Framework  Nuxt 4.5 · Vue 3.5 · Vite 8
Server     Nitro + pg-boss (Worker in-process)
DB         PostgreSQL 15 + pg_trgm + unaccent + pgcrypto
ORM        Drizzle (gepinnt auf 0.45.x)
UI         Tailwind CSS 4 · Nuxt UI 4 · Reka UI · OKLCH-Tokens (DTCG)
PWA        @vite-pwa/nuxt · eigene IndexedDB-Outbox
Test       Vitest · Playwright (inkl. WebKit) · axe-core
Release    Conventional Commits · release-please · Keep a Changelog · SemVer
Deploy     lokal Docker · produktiv Uberspace 7 oder VPS (offen)
```

Begründung jeder Entscheidung inkl. der verworfenen Alternativen:
[`docs/01-ARCHITEKTUR.md`](docs/01-ARCHITEKTUR.md) §4.

## Schnellstart (sobald M0 steht)

```bash
cp .env.example .env       # Discogs Consumer Key/Secret eintragen
docker compose -f docker/compose.yml up -d
pnpm db:migrate
open http://localhost:3000
```

---

This application uses Discogs' API but is not affiliated with, sponsored or endorsed by
Discogs. "Discogs" is a trademark of Zink Media, LLC.
