# 06 – Roadmap

> SemVer für eine App: **MAJOR** = Breaking Change am IndexedDB-Schema ohne automatische
> Migration · **MINOR** = Features · **PATCH** = Fixes.
> Jeder Meilenstein endet mit Tag und `CHANGELOG.md`-Eintrag.

---

## M0 · Fundament → `v0.1.0`

**Ziel:** `pnpm dev` startet eine leere, aber vollständig verdrahtete PWA.

- [ ] `git init`, erster Conventional Commit
- [ ] Nuxt 4.5 Skeleton, **`ssr: false`**, TypeScript, pnpm
- [ ] IndexedDB-Setup mit `idb`, Stores aus `docs/03-DATENMODELL.md`
- [ ] Web-Worker-Grundgerüst inkl. typisiertem `postMessage`-Protokoll
- [ ] Tailwind 4 via `@tailwindcss/vite` + Nuxt UI 4, Design Tokens (DTCG → `@theme`)
- [ ] `@vite-pwa/nuxt`, Manifest, Icons, `registerType: 'prompt'`
- [ ] ESLint 10 + `@nuxt/eslint` + Prettier + lefthook + commitlint
- [ ] Vitest + Playwright (**inkl. WebKit**), ein echter Smoke-Test
- [ ] **Bundle-Budget im CI** (`size-limit`), Überschreitung bricht den Build
- [ ] GitHub Actions: lint ∥ typecheck ∥ test → build
- [ ] release-please mit Keep-a-Changelog-Mapping
- [ ] `CLAUDE.md`, ADR-Ordner

**Kein Docker, keine Datenbank, kein Compose-Stack.**

**Definition of Done:** Frischer Clone → `pnpm dev` → App läuft, Tests grün,
ein Conventional Commit erzeugt einen Release-PR.

---

## M1 · Token & Sync → `v0.2.0`

**Ziel:** Martin trägt seinen Token ein und sieht seine Sammlung.

> ⚠️ **ALLERERSTE AUFGABE, vor allem anderen:** Aus einem echten Browser heraus
> `GET /users/{u}/inventory` aufrufen und verifizieren, dass Discogs den
> Browser-User-Agent akzeptiert. Curl-Tests am 2026-08-09 waren positiv, aber
> `fetch()` kann den UA nicht setzen. **Bricht das, bricht die gesamte Architektur** –
> dann zurück auf den Serverentwurf (ADR-007, Abschnitt „Ausstiegspfad").

- [ ] Token-Eingabe mit Anleitung („discogs.com/settings/developers → Generate token")
- [ ] Validierung gegen `GET /oauth/identity`
- [ ] Token in IndexedDB, Redaction-Liste im Logger, `beforeSend`-Hook falls Sentry
- [ ] **DiscogsClient im Worker**: 1 Request/1,2 s, 429-Backoff, beide Fehlerformate,
      resumierbarer Cursor
- [ ] Sammlung + Wantlist synchronisieren, **Delta-Strategie** (`sort=added&desc`)
- [ ] Namen beim Sync normalisieren und mitspeichern
- [ ] Geschmacksprofil berechnen (Lift-basiert)
- [ ] Screen „Deine Landkarte": Labels, Stile, Dekaden, Künstler
- [ ] „Abmelden" löscht die gesamte Datenbank

---

## M2 · Der erste Dig → `v0.3.0` — **der Beweis-Meilenstein**

**Ziel:** Händlername eingeben → in 2 Minuten eine bewertete Trefferliste.

- [ ] Vorabprüfung `GET /users/{dealer}` → `num_for_sale`, ehrliche Ansage bei > 10.000
- [ ] Inventar paginieren, `per_page=100`, zweiter Durchlauf mit `sort_order=desc`
- [ ] **Inkrementell pro Seite** verarbeiten, Rohlistings sofort verwerfen
- [ ] Harte Filter (Format, Budget, Versandherkunft, bereits besessen)
- [ ] Signale **S1** (Wantlist exakt), **S3** (Künstler), **S5** (Label) — alle gratis
- [ ] Fuzzy-Kaskade in JS: Map-Lookup → Token-Containment → Trigram
- [ ] Barry Score v1 mit Begründungssatz-Templates
- [ ] Fortschritt per `postMessage`, erste Treffer nach ~5 s
- [ ] Screens: Neuer Dig, Dig läuft, Dig-Ergebnis, `MatchCard`
- [ ] `expiresAt = now + 6h` inkl. Verfalls-Job und UI-Sperre
- [ ] Dig bei Tab-Schließen resumierbar

**Definition of Done:** Martin scannt seinen Stammhändler und findet mindestens eine
Platte, die er ohne die App nicht gefunden hätte. **Das ist der eigentliche Projektmeilenstein.**

---

## M3 · Barry wird klüger → `v0.4.0`

- [x] Signal **S7** (Stil-Adjazenz, Kosinus über Sparse-Vektoren)
- [x] Feedback-Buttons (👍😐👎🛒) mit Signal-Snapshot
- [x] Händler-Fingerprint + Affinity-Score → „The Clerk's Take"
- [x] Filterleiste mit Signal-Chips, Sortierung, Dichte-Umschalter
- [x] Virtualisierte Liste, Command Palette (⌘K)
- [x] Release-Detail-Sheet mit View Transition
- [x] Golden-File-Tests der Scoring-Engine, Precision@5 messen (Ziel ≥ 0,6)

**Ergebnis:** Precision@5 = 1,0 · Precision@10 = 0,9 gegen den Golden-Dig.
S7 läuft als Top-50-Nachschlag über `/releases/{id}` nach dem Scan – dieselbe
Form wie S10/S11 in M4 –, weil die Stile eines Releases sonst nirgends in
Massen erreichbar sind. Der Golden-Dig hat beim ersten Lauf einen echten Fehler
in S9 gefunden (siehe `docs/04` §S9).

---

## M4 · Der Korb → `v0.5.0`

- [x] Warenkorb pro Händler
- [x] Versandstaffel: Nutzereingabe + `shipping-profiles.json` aus dem Repo
- [x] Freitext-Parser für `seller.shipping` (klar als Heuristik gekennzeichnet)
- [x] Grenzkosten-Kurve + „+1 Platte spart X €/Stk"
- [x] Kandidatenvorschläge im passenden Preisfenster
- [x] Signale **S10** (Preis) + **S11** (Seltenheit) via `/marketplace/stats/` —
      **nur für die Top 50** nach Vorscore
- [x] Greedy-Optimierer + Swap-Verbesserung
- [x] Deeplinks zu Discogs (kein eigener Checkout)

**Anmerkungen:**

- S10/S11 laufen im selben Top-50-Durchgang wie S7, nicht in einem zweiten.
  Zwei Abfragen je Platte, rund zwei Minuten – die Liste steht vorher schon da.
- Das **Preisfenster für Kandidaten ist der Wohlfühlpreis des Nutzers**, keine
  aus der Versandersparnis abgeleitete Zahl. Niemand kauft eine Platte, weil sie
  Porto spart; die Ersparnis kippt nur eine ohnehin knappe Entscheidung.
- Der Korb zeigt Preise nach sechs Stunden **nicht mehr an** (CLAUDE.md Regel 4).
  Die Platte bleibt drin, nur die Zahl geht. Eine Teilsumme über die noch
  frischen Zeilen wäre eine kleinere Zahl als die Wahrheit.
- Der Worker wurde dafür aufgeteilt: Korb und Detail-Sheet laden erst beim
  Öffnen (`worker.format: 'es'`), sonst hätte der Korb das 35-KB-Budget aus
  `docs/12` §2 gerissen.

---

## M5 · Der Horizont → `v0.6.0`

**Ziel:** Die fünf teuren Signale freischalten – ohne Volldump, ohne XML-Parser.

- [x] Relevante Entitäten ermitteln (Künstler ≥ 2 Platten · Labels · Wantlist-Master)
- [x] **Credits als eigene Entitäten** — geerntet von den Lieblingsplatten
- [x] Expansion über `/artists/{id}/releases`, `/labels/{id}/releases`,
      `/masters/{id}/versions`
- [x] `role`-Feld auswerten (`Main`, `Producer`, `Remix`, `Engineer`, …)
- [x] Master/Release-Zweischritt: `main_release` sofort, `versions` bedarfsgesteuert nach
- [x] Packen als `Int32Array`/`Uint8Array`-Parallelarrays (~1,4 MB statt ~9 MB)
- [x] Fortschrittsanzeige für die Ersteinrichtung (~670 Requests ≈ 13 Min),
      häppchenweise und reload-fest
- [x] Revalidierung alle 30 Tage, gestaffelt
- [x] Signale **S2** (Pressing), **S4** (Diskografie-Lücke), **S6** (Katalogserie),
      **S8** (Credit-Graph), **S9** (Format-Upgrade)
- [x] `CatalogRunGrid`-Komponente
- [x] Credit-Graph-Explorer: „Alle Conny-Plank-Produktionen bei diesem Händler"

**Anmerkungen:**

- Der **Lift ≥ 2 / < 1.500 Releases**-Filter für Labels kann die Auswahl nicht
  steuern: beide Zahlen entstehen erst in der Expansion. Die billige Bedingung
  wählt aus, die Expansion bricht ein zu großes Label nach einer Seite ab und
  markiert es als unvollständig.
- Stufe 2 des Zweischritts sammelt Beinahetreffer **während** des Scans mit,
  wie der Fingerprint — 20.000 Listings danach noch zu haben wären 40 MB.
  Höchstens acht Master pro Dig, weil ein Beinahetreffer eine Vermutung ist.
- Der Credit-Explorer kostet **null Requests**. Er gruppiert nur um, was der
  Horizont ohnehin weiß.

> ### Wie Credit-Personen gefunden werden
>
> `docs/11` §3 wählt „Personen mit Lift ≥ 3 in der Sammlung" als vierte
> Entitätenklasse, sagt aber nicht, wie man sie findet. Man kann es auch nicht
> billig: `extraartists` steht ausschließlich in `/releases/{id}`, ein
> Durchlauf über 2.412 Platten wären 2.412 Requests (~48 Min) — genau das
> Muster, das CLAUDE.md Regel 2 verbietet.
>
> **Gelöst über die Lieblingsplatten:** geerntet werden nur Platten mit
> **4 oder 5 Sternen**. Die sind ein paar hundert statt ein paar tausend, es
> sind genau die, deren Produktion einen interessiert, und der Lauf ist
> begrenzt, wiederaufnehmbar und wird von Hand gestartet.
>
> **Aus „Lift ≥ 3" wurde „auf ≥ 3 Lieblingsplatten".** Ein Lift braucht einen
> Nenner — wie oft eine Person in Musik allgemein vorkommt —, den kein Browser
> messen kann. Der Label-Lift hat einen, weil Katalogumfänge bei der Expansion
> gratis mitkommen; bei einer Person käme der Umfang erst *nach* der
> Entscheidung, sie zu expandieren. Also eine schlichte Anzahl, mit der Zahl
> aus dem Dokument.
>
> ⚠️ **Voraussetzung: bewertete Platten.** Wer bei Discogs keine Sterne vergibt,
> bekommt hier nichts — der Screen sagt das und nennt den Grund.

**Kein Download, kein Parser, kein Wartungstermin.** Siehe `11-KATALOG-STRATEGIE.md`.

> Seit dem Wegfall des Volldumps ist M5 klein genug, um bei Bedarf **direkt nach M2**
> gezogen zu werden – die fünf Signale sind der eigentliche Produktvorsprung.

---

## M6 · Offline & Watchlist → `v0.7.0`

- [ ] Service Worker: App-Shell precache, Cover-Cache mit LRU-Deckel (150 MB)
- [ ] `navigator.storage.persist()` anfragen
- [ ] Offline-Modus: Sammlung und letzte Digs vollständig nutzbar
- [ ] **In-Store-Screen** (mobil, große Targets, offline) — der Keller-im-Plattenladen-Fall
- [ ] iOS-Coach-Mark „Teilen → Zum Home-Bildschirm" (kein `beforeinstallprompt` auf iOS)
- [ ] Watchlist: Händler merken, **Prüfung beim App-Start** statt nachts
- [ ] Günstige Änderungserkennung: `GET /users/{dealer}` → `num_for_sale` vergleichen
      (**1 Request statt 100**), Vollscan nur bei Veränderung
- [ ] Badge-API + „seit deinem letzten Besuch"-Banner

> ⚠️ **Keine Push-Benachrichtigungen.** Web Push braucht einen Application Server, den
> wir bewusst nicht haben. Falls Push später wirklich vermisst wird: `08-DEPLOYMENT.md` §6.

---

## M7 · Pressing-Beratung → `v0.8.0`

- [ ] Matrix/Runout aus `identifiers` (bedarfsgesteuert für Top-Treffer)
- [ ] Mastering-Stempel erkennen (RVG, Porky, RL, Pecko)
- [ ] Original vs. Reissue heuristisch aus Land, Jahr, Labelvariante
- [ ] Fallen-Warnung: „Japan-Reissue 1983, kein 65er Original"
- [ ] Widerspruchsprüfung: Händler-`comments` vs. Release-Daten

---

## M8 · Rundschliff → `v1.0.0`

- [ ] Onboarding, das Jens ohne Rückfrage schafft
- [ ] Datenexport (JSON) und „alles löschen"
- [ ] Dig-Export als Datei (Ersatz fürs Teilen per Link)
- [ ] Datenschutzerklärung + Impressum (kurz — es gibt fast nichts zu erklären)
- [ ] Attributions-Strings an jeder Stelle mit Discogs-Daten
- [ ] A11y-Audit: Tastatur + VoiceOver komplett
- [ ] Lighthouse ≥ 95 auf Mobile-Drosselung
- [ ] Fehlerbehandlung: Token abgelaufen, offline, 429, Speicher voll

---

## M9 · Der Hub (optional) → `v1.1.0`

**Ziel:** Ein winziger, selbst hostbarer Dienst, der die App anreichert – ohne dass
irgendein Feature ihn voraussetzt. Vollständiges Konzept: `docs/13-HUB-ADDON.md`.

- [ ] `hub/` als eigenes Paket: Node 22 + Hono + SQLite, ~8 Routen
- [ ] Horizont-Cache (`GET/PUT /v1/horizon/:kind/:id`) – erspart jedem weiteren Nutzer
      die 13-minütige Ersteinrichtung
- [ ] Versandstaffeln als Community-Speicher statt Pull Request
- [ ] Wächter: pollt stündlich `num_for_sale` je Händler – **1 Request statt 100**,
      **ohne Token** – und schickt bei Veränderung Web Push
- [ ] Geräte-Sync für Korb, Feedback und Wantlist-Notizen
- [ ] Dig teilen per Link (TTL 6 h, ToS-konform)
- [ ] Docker-Image + Uberspace-Anleitung (supervisord + `uberspace web backend`)
- [ ] **CI-Test: Die App muss mit leerer `hubUrl` vollständig durchlaufen**

> ⚠️ **Der Hub scannt keine Inventare** und **speichert keine Discogs-Tokens.**
> Beides würde die Vorteile der Client-Architektur wieder einreißen (ADR-008).

**Vorbereitet wird das schon in M2/M5:** die drei Ports `HorizonSource`,
`ShippingProfileSource` und `WatchService` samt Fallback-Kette. Etwa eine Stunde Aufwand –
ohne sie wäre M9 ein Refactoring quer durch den Worker.

---

## Nicht auf der Roadmap

| Idee | Warum nicht |
|---|---|
| Wantlist-Alerts | Discogs besitzt Wantlister – aussichtslos |
| Eigener Checkout | ToS-Verstoß, strategisch dumm |
| Sammlungs-Katalogisierung | Gelöstes Problem, ein Dutzend Apps |
| Native App | PWA reicht vollständig |
| Bezahlmodell | ToS verbietet Gebühren für API-integrierte Apps ohne Genehmigung |
| Multi-Händler-Suche | Es gibt **keinen** Listings-by-Release-Endpunkt. Nur über Scraping – kommt nicht in Frage. |
| Nutzerkonten mit Passwort | Braucht niemand. Der optionale Hub (M9) nutzt ein geteiltes Secret. |

---

## Reihenfolge

```
M0 ─▶ M1 ─▶ M2 ──────────────▶ M3 ─▶ M4 ─▶ M6 ─▶ M8
       ▲      │                        ▲
       │      └──▶ M5 (Horizont) ──────┘
       │                └──▶ M7 (Pressing)
       │
   ⚠️ User-Agent-Test in M1 —
      bricht der, bricht alles
```
