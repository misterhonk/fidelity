# 06 – Roadmap

> SemVer für eine App: **MAJOR** = Breaking Change am IndexedDB-Schema ohne automatische
> Migration · **MINOR** = Features · **PATCH** = Fixes.
> Jeder Meilenstein endet mit Tag und `CHANGELOG.md`-Eintrag.

---

## Wo wir stehen

**M0 bis M9 sind umgesetzt.** Die Meilenstein-Versionen oben sind Planungsnamen aus der
Entwurfszeit und nicht die tatsächliche Zählung — die steht in `CHANGELOG.md`.

Offen sind drei Punkte, alle in M9 und alle am **optionalen** Hub:

| offen | wo |
|---|---|
| Wächter mit Web Push | M9 |
| Dig teilen per Link | M9 |
| Dockerfile für den Hub | M9 |

Zwei Zeilen dieser Datei sind **überholt statt offen** und als solche gekennzeichnet: der
429-Backoff am Status (im Browser nicht baubar, `docs/02`) und die Uberspace-Backend-
Anleitung (die App ist seit ADR-007 rein statisch).

> Diese Liste war lange unabgehakt, während die App längst lief — wer sie las, schloss
> daraus, dass nichts fertig sei. Jeder Haken hier ist am Code geprüft worden, nicht aus
> der Erinnerung gesetzt.

---

## M0 · Fundament → `v0.1.0`

**Ziel:** `pnpm dev` startet eine leere, aber vollständig verdrahtete PWA.

- [x] `git init`, erster Conventional Commit
- [x] Nuxt 4.5 Skeleton, **`ssr: false`**, TypeScript, pnpm
- [x] IndexedDB-Setup mit `idb`, Stores aus `docs/03-DATENMODELL.md`
- [x] Web-Worker-Grundgerüst inkl. typisiertem `postMessage`-Protokoll
- [x] Tailwind 4 via `@tailwindcss/vite` + Nuxt UI 4, Design Tokens (DTCG → `@theme`)
- [x] `@vite-pwa/nuxt`, Manifest, Icons, `registerType: 'prompt'`
- [x] ESLint 10 + `@nuxt/eslint` + Prettier + lefthook + commitlint
- [x] Vitest + Playwright (**inkl. WebKit**), ein echter Smoke-Test
- [x] **Bundle-Budget im CI** (`size-limit`), Überschreitung bricht den Build
- [x] GitHub Actions: lint ∥ typecheck ∥ test → build
- [x] release-please mit Keep-a-Changelog-Mapping
- [x] `CLAUDE.md`, ADR-Ordner

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

- [x] Token-Eingabe mit Anleitung („discogs.com/settings/developers → Generate token")
- [x] Validierung gegen `GET /oauth/identity`
- [x] Token in IndexedDB, Redaction-Liste im Logger, `beforeSend`-Hook falls Sentry
- [x] **DiscogsClient im Worker**: 1 Request/1,2 s, beide Fehlerformate, resumierbarer
      Cursor. ⚠️ Der ursprünglich geplante **429-Backoff am Status** ist im Browser nicht
      baubar: die 429 kommt ohne CORS-Header, `fetch()` lehnt ab, und JS sieht nie einen
      Status (gemessen 2026-08-10, siehe `docs/02` §Rate-Limit). Stattdessen: zwei kurze
      Wiederholungen, danach das Rate-Limit-Fenster aussitzen
- [x] Sammlung + Wantlist synchronisieren, **Delta-Strategie** (`sort=added&desc`)
- [x] Namen beim Sync normalisieren und mitspeichern
- [x] Geschmacksprofil berechnen (Lift-basiert)
- [x] Screen „Deine Landkarte": Labels, Stile, Dekaden, Künstler
- [x] „Abmelden" löscht die gesamte Datenbank

---

## M2 · Der erste Dig → `v0.3.0` — **der Beweis-Meilenstein**

**Ziel:** Händlername eingeben → in 2 Minuten eine bewertete Trefferliste.

- [x] Vorabprüfung `GET /users/{dealer}` → `num_for_sale`, ehrliche Ansage bei > 10.000
- [x] Inventar paginieren, `per_page=100`, zweiter Durchlauf mit `sort_order=desc`
- [x] **Inkrementell pro Seite** verarbeiten, Rohlistings sofort verwerfen
- [x] Harte Filter (Format, Budget, Versandherkunft, bereits besessen)
- [x] Signale **S1** (Wantlist exakt), **S3** (Künstler), **S5** (Label) — alle gratis
- [x] Fuzzy-Kaskade in JS: Map-Lookup → Token-Containment → Trigram
- [x] Barry Score v1 mit Begründungssatz-Templates
- [x] Fortschritt per `postMessage`, erste Treffer nach ~5 s
- [x] Screens: Neuer Dig, Dig läuft, Dig-Ergebnis, `MatchCard`
- [x] `expiresAt = now + 6h` inkl. Verfalls-Job und UI-Sperre
- [x] Dig bei Tab-Schließen resumierbar

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

- [x] Service Worker: App-Shell precache, Cover-Cache mit LRU-Deckel (150 MB)
- [x] `navigator.storage.persist()` anfragen
- [x] Offline-Modus: Sammlung und letzte Digs vollständig nutzbar
- [x] **In-Store-Screen** (mobil, große Targets, offline) — der Keller-im-Plattenladen-Fall
- [x] iOS-Coach-Mark „Teilen → Zum Home-Bildschirm" (kein `beforeinstallprompt` auf iOS)
- [x] Watchlist: Händler merken, **Prüfung beim App-Start** statt nachts
- [x] Günstige Änderungserkennung: `GET /users/{dealer}` → `num_for_sale` vergleichen
      (**1 Request statt 100**), Vollscan nur bei Veränderung
- [x] Badge-API + „seit deinem letzten Besuch"-Banner

**Anmerkungen:**

- **Der 150-MB-Deckel wurde zu 6.000 Einträgen.** Workbox' `ExpirationPlugin`
  zählt Einträge und Alter, nicht Bytes — einen Byte-Deckel gibt es dort nicht.
  6.000 ist dasselbe Budget in der verfügbaren Einheit, gerechnet mit den
  ~25 KB, die ein 150px-Thumbnail wiegt. `purgeOnQuotaError` ist das eigentliche
  Sicherheitsnetz, falls die Schätzung danebenliegt.
- **Der Banner verspricht nicht mehr, als die Zahl hergibt.** `num_for_sale`
  bewegt sich um 40 heißt nicht „40 neue Platten" — wer fünf verkauft und fünf
  einstellt, bewegt sich um null. Der Text sagt „40 Listings mehr im Angebot
  als beim letzten Mal" und erklärt den Vorbehalt darunter.
- **Offline live geprüft:** Build ausgeliefert, Service Worker registriert,
  Server abgeschaltet, Seite neu geladen — Shell, Worker und IndexedDB-Abfrage
  liefen vollständig ohne Netz.

> ⚠️ **Keine Push-Benachrichtigungen.** Web Push braucht einen Application Server, den
> wir bewusst nicht haben. Falls Push später wirklich vermisst wird: `08-DEPLOYMENT.md` §6.

---

## M7 · Pressing-Beratung → `v0.8.0`

- [x] Matrix/Runout aus `identifiers` (bedarfsgesteuert für Top-Treffer)
- [x] Mastering-Stempel erkennen (RVG, Porky, RL, Pecko + Plastylite, Sterling,
      Masterdisk, Kendun)
- [x] Original vs. Reissue — **nicht heuristisch, sondern aus `formats[].descriptions`**
- [x] Fallen-Warnung: „Europe-Neuauflage von 2017, nicht das Original von 1994"
- [x] Widerspruchsprüfung: Händler-`comments` vs. Release-Daten

**Anmerkungen:**

- **Kostet null zusätzliche Requests.** Die Pressing-Felder kommen in derselben
  Antwort wie `styles` für S7 — der Top-50-Nachschlag lief ohnehin. Die Felder
  sind jetzt in `docs/02` dokumentiert, live verifiziert an drei Pressungen von
  Blue Notes „Newk's Time".
- **„Reissue" ist keine Heuristik.** Discogs pflegt das Feld selbst. Nur wo
  wirklich geschlossen wird — ein Jahresabstand ohne Eintrag — sagt der Text
  „vermutlich" und die Warnung ist eine Stufe milder.
- **Der Nachschlag ist jetzt unbedingt.** Vorher wurde `/releases/{id}` ohne
  Stil-Zentroid übersprungen; die Pressungsberatung braucht aber nur das
  Release und ist gerade für jemanden ohne Geschmacksprofil die nützlichere
  Hälfte. Ehrliche Folge: zwei Requests je Platte statt einem, gedeckelt bei 50,
  und der Fortschrittsbalken nennt die Zahl vorher.
- **An echten Daten geprüft:** Der höchstbewertete Treffer eines echten Digs
  (87 Punkte, 33,99 €) ist eine Europa-Pressung von 2017 eines Albums von 1994,
  das auf der Wantlist steht. Release 10147986 → Master 5542 → Horizont kennt
  1994 über 160 Pressungen. Als Test festgehalten.

---

## M8 · Rundschliff → `v1.0.0`

- [x] Onboarding, das Jens ohne Rückfrage schafft
- [x] Datenexport (JSON) und „alles löschen"
- [x] Dig-Export als Datei (Ersatz fürs Teilen per Link)
- [x] Datenschutzerklärung + Impressum (kurz — es gibt fast nichts zu erklären)
- [x] Attributions-Strings an jeder Stelle mit Discogs-Daten
- [x] A11y-Audit: Tastatur + VoiceOver komplett
- [x] Lighthouse ≥ 95 auf Mobile-Drosselung
- [x] Fehlerbehandlung: Token abgelaufen, offline, 429, Speicher voll

**Lighthouse, mobil gedrosselt, gegen den echten Build:**

| Kategorie | Wert |
|---|---:|
| Performance | **95** |
| Accessibility | **100** |
| Best Practices | **100** |
| SEO | 63 – siehe unten |

> **SEO wird bewusst nicht erreicht.** Genau eine Prüfung schlägt fehl:
> „Page is blocked from indexing". Fidelity ist ein privates Werkzeug für einen
> Freundeskreis (`docs/00` §9) und trägt `robots.txt: Disallow: /` plus
> `noindex`. Ohne die beiden stünde dort 100 — die Zahl höher zu bekommen hieße,
> ein privates Werkzeug indexierbar zu machen. Alle übrigen SEO-Prüfungen sind
> grün, `robots.txt` eingeschlossen.

**Anmerkungen:**

- **axe läuft jetzt über alle acht Screens**, in Chromium *und* WebKit, plus
  Tastaturprüfungen für Fokus-Sichtbarkeit und die ⌘K-Palette. Null Verstöße.
- **Der Export enthält weder Token noch Marktplatzdaten.** `docs/09` §1.3 nennt
  Preise und Zustände Restricted Data und verbietet die Weitergabe — eine
  Exportdatei ist das dritt-parteiischste Ding der App. Geteilt wird, *welche*
  Platten wie gut passen und warum, mit Deeplink zum aktuellen Preis.
- **Der Worker warf bis M8 den Fehlergrund weg.** „Token abgelaufen" und „429"
  kamen als anonymer Text an; die ganze Erklärungsschicht wäre ins Leere
  gelaufen. Mit echtem ungültigem Token gegen die Live-API geprüft.
- **Das Impressum ist absichtlich unausgefüllt.** Eine Anbieterkennzeichnung ist
  eine Erklärung über einen echten Menschen; ihren Inhalt zu erfinden ist nichts,
  was ein Generator tun sollte.

---

## M9 · Der Hub (optional) → `v1.1.0`

**Ziel:** Ein winziger, selbst hostbarer Dienst, der die App anreichert – ohne dass
irgendein Feature ihn voraussetzt. Vollständiges Konzept: `docs/13-HUB-ADDON.md`.

- [x] `hub/` als eigenes Paket: Node + Hono + `node:sqlite`, 5 Routen
- [x] Horizont-Cache (`GET/PUT /v1/horizon/:kind/:id`) – erspart jedem weiteren Nutzer
      die 13-minütige Ersteinrichtung
- [x] Versandstaffeln als Community-Speicher statt Pull Request
- [x] Cover-Cache (`GET/PUT /v1/covers`) – der Inventar-Endpunkt liefert gar keine Bilder
      (gemessen 2026-08-10), also kostet jedes Cover eine eigene Abfrage, und die Antwort
      ist für alle dieselbe. Gebündelt, mit Herkunftsprüfung an beiden Enden
- [x] Hub-Erkennung im Client: sucht `http://localhost:8787`, und sagt, wenn der Browser
      die Verbindung verweigert statt „nicht gefunden" zu behaupten
- [ ] Wächter: pollt stündlich `num_for_sale` je Händler – **1 Request statt 100**,
      **ohne Token** – und schickt bei Veränderung Web Push
- [x] Geräte-Sync für Korb und Merkliste — **über den Vault, nicht über den Hub**
      (M8/ADR-007): verschlüsselt, Ziel frei wählbar, funktioniert auch ohne Hub
- [ ] Dig teilen per Link (TTL 6 h, ToS-konform)
- [ ] Dockerfile für den Hub — `hub/compose.yml` gibt es, ein Image noch nicht.
      ⚠️ Der Zusatz „supervisord + `uberspace web backend`" ist überholt: die App ist seit
      ADR-007 rein statisch und läuft in einem Docroot, ein Backend gibt es nicht mehr
      (siehe `docs/08-DEPLOYMENT.md`). Betroffen ist nur noch der optionale Hub
- [x] **CI-Test: Die App muss mit leerer `hubUrl` vollständig durchlaufen**

**Umgesetzt ist der unstrittige Kern** — Horizont-Cache, Versandstaffeln und
Cover. Alle drei brauchen keinen Token, keine Marktplatzdaten und keinen
Dauerbetrieb; der Hub darf jederzeit aus sein. Geräte-Sync kam dazu, aber über den
Vault statt über den Hub — was die Regel „kein Feature setzt den Hub voraus" eher
bestätigt als verletzt.

Offen bleiben **Wächter mit Web Push**, **„Dig teilen"** und ein **Dockerfile für
den Hub**. Der Wächter ist von den dreien der einzige, der den Hub wirklich
rechtfertigt: eine Abfrage je Händler für alle statt einer je Händler und Nutzer.
Er ist auch der einzige, der VAPID-Schlüssel, Subscriptions und einen laufenden
Prozess braucht — bisher ist der Hub ein Cache, den man jederzeit abschalten kann,
und ein Wächter macht ihn zu etwas, das läuft.

**Was ein Hub bewusst nicht wird:** Konten, eine eigene Weboberfläche, irgendein
serverseitiges Rechnen an der Matching-Engine (die ist rein und lokal, und das ist
ihr Wert), Statistik über Nutzer. Der Hub ist ein gemeinsames Gedächtnis für
Fakten, die für alle gleich sind — mehr nicht.

**Anmerkungen:**

- **SQLite kommt aus `node:sqlite`.** Kein Treiber, keine native Abhängigkeit,
  nichts zu kompilieren — für einen Dienst, dessen Sinn das einfache
  Selbsthosten ist, wiegt das schwerer als jedes Feature eines echten Treibers.
- **Der Horizont reist als Base64.** `JSON.stringify(new Int32Array([1,2]))`
  ergibt `{"0":1,"1":2}` — falsch beim Zurücklesen und größer als das Array.
  Das Format steht in `shared/wire.ts`, weil Hub und Client sich einig sein
  müssen und ein doppelt vorhandenes Format auseinanderläuft.
- **Jede Antwort wird misstraut.** Zod-Schema *und* eine Plausibilitätsprüfung:
  wenn die Parallelarrays unterschiedlich lang sind, beschreibt Index *i* von
  `roles` eine andere Platte als Index *i* von `releaseIds`. So ein Chunk würde
  den Horizont still und dauerhaft verderben — schlimmer als jede Langsamkeit.
- **Geteilt werden nur handgetippte Versandstaffeln.** Eine geparste Vermutung
  weiterzureichen hieße, eine Heuristik als Tatsache zu waschen.
- **Acht Tests für „läuft ohne Hub"**, weil das mehrere Formen hat: nie
  konfiguriert, konfiguriert aber tot, langsam, oder lügend. Alle vier müssen
  im lokalen Weg enden, ohne ein Wort darüber zu verlieren.

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
