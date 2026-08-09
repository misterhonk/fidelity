# Fidelity

> Der Verkäufer hinter der Theke — für Discogs.

Discogs ist eine Suchmaschine, kein Plattenladen. Es beantwortet *„Habt ihr Platte X?"*
perfekt und *„Was hättet ihr für mich?"* überhaupt nicht.

**Fidelity** scannt das Sortiment eines Discogs-Händlers, gleicht es gegen deine Sammlung
und Wantlist ab und liefert eine bewertete Fundliste – **mit einem Satz Begründung
pro Treffer**.

```
Du: "vinyl-tom"
Fidelity, 2 Minuten später:

  91 · Side One, Track One
  Neu! – Neu! 2 · Brain BRAIN 1028 · DE 1973 · VG+ · 24,00 €
  Conny Plank am Pult – du hast 9 seiner Produktionen, diese nicht.
  In der Brain-1000er-Reihe fehlen dir nur noch 1051 und 1060.
  Markt-Tiefstpreis: 41 €.
```

**Reine Client-PWA. Kein Backend, keine Datenbank, keine Betriebskosten.**
Alle Daten liegen in deinem Browser.

---

## Status

**Konzeptphase.** Noch kein Code. Die Dokumentation unter [`docs/`](docs/) ist vollständig
und als Arbeitsgrundlage für Claude Code gedacht.

## Dokumentation

| Dokument | Inhalt |
|---|---|
| [`docs/00-KONZEPT.md`](docs/00-KONZEPT.md) | Vision, Namensgebung, Wettbewerb, Feature-Backlog |
| [`docs/01-ARCHITEKTUR.md`](docs/01-ARCHITEKTUR.md) | Systemdesign, Tech-Stack, Discogs-Client, Horizont |
| [`docs/02-DISCOGS-API.md`](docs/02-DISCOGS-API.md) | API-Referenz, verifizierte Limits, CORS, Bugs |
| [`docs/03-DATENMODELL.md`](docs/03-DATENMODELL.md) | IndexedDB-Stores, TypedArray-Packung |
| [`docs/04-MATCHING-ENGINE.md`](docs/04-MATCHING-ENGINE.md) | Die 11 Signale, Barry Score, Begründungssätze |
| [`docs/05-DESIGN-SYSTEM.md`](docs/05-DESIGN-SYSTEM.md) | Design Tokens, Komponenten, A11y, PWA |
| [`docs/06-ROADMAP.md`](docs/06-ROADMAP.md) | M0–M8 mit Definition of Done |
| [`docs/07-DEV-PIPELINE.md`](docs/07-DEV-PIPELINE.md) | CI, Conventional Commits, release-please |
| [`docs/08-DEPLOYMENT.md`](docs/08-DEPLOYMENT.md) | Statisches Hosting – ein rsync |
| [`docs/09-LEGAL.md`](docs/09-LEGAL.md) | Discogs ToS, DSGVO, BFSG |
| [`docs/11-KATALOG-STRATEGIE.md`](docs/11-KATALOG-STRATEGIE.md) | Warum kein 10,4-GB-Dump nötig ist |
| [`docs/12-RESSOURCEN-BUDGET.md`](docs/12-RESSOURCEN-BUDGET.md) | Bundle, Speicher, Rechenzeit, Requests |
| [`docs/13-HUB-ADDON.md`](docs/13-HUB-ADDON.md) | Optionales, selbst hostbares Server-Addon (M9) |
| [`docs/adr/`](docs/adr/) | Architecture Decision Records |

**Zum Anschauen im Browser:**

| Datei | Inhalt |
|---|---|
| [`konzept-onepager.html`](konzept-onepager.html) | Konzept auf einer Seite |
| [`wireframes.html`](wireframes.html) | Neun UI-Screens mit Annotationen |

## Die fünf Fakten, die alles bestimmen

Alle am 2026-08-09 live gegen `api.discogs.com` verifiziert.

1. **Discogs erlaubt CORS** (`access-control-allow-origin: *`, `authorization` erlaubt).
   Deshalb braucht diese App kein Backend.

2. **Das Rate-Limit von 60 req/min gilt pro IP** — und im Browser ist das die IP des
   Nutzers. 30 Nutzer bedeuten 30 × 60 req/min statt 1 × 60. Die härteste
   Skalierungsgrenze des Serverentwurfs ist damit weg.

3. **Discogs gibt max. 10.000 Listings pro fremdem Händler heraus.** Seite 101 liefert
   403, und `pagination.pages` lügt dabei. Mit `sort_order` asc+desc kommt man auf 20.000.
   Die UI sagt das ehrlich.

4. **`/artists/{id}/releases` liefert ein `role`-Feld** (`Producer`, `Remix`, `Engineer`).
   Conny Planks komplettes Werk: 1.095 Einträge in 11 Requests. Deshalb braucht diese App
   den 10,4-GB-Katalogdump nicht.

5. **Die Rate-Limit-Header stehen nicht in `expose-headers`.** JavaScript kann sie nicht
   lesen — wir fahren blind mit 1.200 ms und reagieren auf den 429-Status.

## Tech-Stack

```
Framework  Nuxt 4.5 (ssr: false, statisch generiert) · Vue 3.5 · Vite 8
Arbeit     Web Worker — Scan, Matching, Horizont
Speicher   IndexedDB via idb (~2 KB) · Horizont als Int32Array
Auth       Discogs Personal Access Token, nur lokal
UI         Tailwind CSS 4 · Nuxt UI 4 · Reka UI · OKLCH-Tokens (DTCG)
PWA        @vite-pwa/nuxt · Offline · Installation
Test       Vitest · Playwright (inkl. WebKit) · axe-core · size-limit
Release    Conventional Commits · release-please · Keep a Changelog · SemVer
Hosting    statische Dateien — Uberspace-Docroot, Cloudflare Pages, GitHub Pages
Backend    keins
```

Begründung jeder Entscheidung inkl. verworfener Alternativen:
[`docs/01-ARCHITEKTUR.md`](docs/01-ARCHITEKTUR.md) §4 und die [ADRs](docs/adr/).

## Schnellstart (sobald M0 steht)

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

Kein Docker, keine Datenbank, kein Seed. Nur ein Personal Access Token aus
[discogs.com/settings/developers](https://www.discogs.com/settings/developers).

---

This application uses Discogs' API but is not affiliated with, sponsored or endorsed by
Discogs. "Discogs" is a trademark of Zink Media, LLC.
