# 06 – Roadmap

> SemVer für eine App: **MAJOR** = Breaking Change am IndexedDB-Schema ohne automatische
> Migration · **MINOR** = Features · **PATCH** = Fixes.
> Jeder Meilenstein endet mit Tag und `CHANGELOG.md`-Eintrag.

---

## Wo wir stehen

Die Meilenstein-Versionen in den Überschriften sind Planungsnamen aus der Entwurfszeit
und nicht die tatsächliche Zählung — die steht in `CHANGELOG.md`.

**M0 bis M15 sind abgearbeitet.** Offen sind noch drei Reste:

| offen | wo | Stand |
|---|---|---|
| Den Runout **vorlesen** statt abtippen | M13 | `SpeechRecognition`, erst zu messen |
| Lagerorte über den Tresor mitreisen lassen | M12 | der einzige offene Haken dort |
| `docs/` ist noch deutsch | M10 | größter Brocken, geringste Dringlichkeit |

Wächter mit Web Push und das Hub-Dockerfile standen bis zum 2026-09-10 als offen in
dieser Tabelle und waren beide seit dem 14. August gebaut. Am Code nachgesehen, nicht
aus der Erinnerung gestrichen: `app/sw/sw.ts` hat `push` und `notificationclick`,
`deploy/hub.Dockerfile` liegt da und wird veröffentlicht.

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
- [x] Wächter, Hub-Seite: fragt je Laden höchstens stündlich `num_for_sale` ab –
      **eine Abfrage für alle statt einer je Nutzer**, ohne Token, im Takt von 2,4 s.
      Der erste Blick ist eine Grundlinie und keine Meldung; nach unten wird nie
      gemeldet; tote Empfänger (404/410) fliegen raus. Aus, bis `HUB_WATCH=1`
- [x] **Der Service Worker gehört uns** (`app/sw/sw.ts`, `injectManifest`) — die
      Voraussetzung für einen `push`-Handler, denn eine Meldung kommt an, wenn kein Tab
      offen ist, und darauf kann nur Code im Worker antworten. Dreimal versucht,
      zweimal zurückgenommen; die Ursachen sind gefunden und stehen im Code:

      1. **Die Registrierung blieb aus.** `client: { installPrompt: false }` ließ
         `registerPlugin` `undefined`, weil das Modul sein Vorgabe-Objekt nur einsetzt,
         wenn `client` **ganz** fehlt. Unter `generateSW` fiel es nie auf, weil dort
         zusätzlich ins HTML gespritzt wird. `registerPlugin: true` steht fest drin.
      2. **`srcDir` zählt ab Nuxts `srcDir`**, also `sw` und nicht `app/sw`.
      3. **Die eigentliche Ursache, und sie war auch schon im erzeugten Worker drin:**
         @vite-pwa/nuxt schneidet per `manifestTransforms` das `.html` von jedem
         vorgehaltenen Dokument ab — `200.html` steht als `200` in der Liste.
         `createHandlerBoundToURL` schlägt genau dort nach und **wirft**, wenn die
         Adresse fehlt. Im erzeugten Worker lag dieser Aufruf in einem Promise: der
         Worker installierte, hielt vor, sah gesund aus — und alles darunter, nämlich
         der Cover-Cache, war nie registriert. Gemessen am 2026-08-12, behoben, und
         `tests/e2e/service-worker.spec.ts` sieht jetzt beide Hälften.

      Abnahme: die vier Tests in `tests/e2e/offline.spec.ts` und
      `tests/e2e/service-worker.spec.ts` gegen den gebauten Ausgabestand.
- [x] Wächter, Client-Seite: Push-Subscription und Benachrichtigung — Erlaubnis fragen,
      beim Hub anmelden (`/v1/watch/key`, `subscribe`, `unsubscribe`), `push` und
      `notificationclick` im Worker beantworten. `app/composables/usePush.ts` und
      `app/sw/sw.ts`; am 2026-08-14 gegen den laufenden Hub geklingelt und auf Chrome
      wie iOS angekommen.

      Zwei Dinge kosteten dabei je einen Anlauf, beide unsichtbar: `allowMethods` des
      Hubs kannte kein `POST`, weshalb sich **kein Browser** je anmelden konnte (der
      erste erfolgreiche Test lief per curl an der Lücke vorbei), und Apple lehnt eine
      VAPID-Subject-Adresse auf `.invalid` mit **403** ab. Beides sah von außen wie
      „kommt halt nichts an" aus, bis `watch.ts` gescheiterte Zustellungen zählte.
- [x] Geräte-Sync für Korb und Merkliste — **über den Vault, nicht über den Hub**
      (M8/ADR-007): verschlüsselt, Ziel frei wählbar, funktioniert auch ohne Hub
- [x] Dig teilen per Link (TTL 6 h, ToS-konform) — der Hub trägt Chiffrat unter einer
      Zufallskennung, der Schlüssel steht im `#`-Fragment und erreicht keinen Server.
      `GET /v1/share/:id` ist die einzige Tür am Hub ohne Secret, weil der Empfänger
      keins hat; `POST` bleibt hinter ihm. Die Uhr läuft ab dem Scan, nicht ab dem
      Verschicken, und der Server deckelt zusätzlich auf sechs Stunden.
- [x] Dockerfile für den Hub — `deploy/hub.Dockerfile`, das Release-Workflow
      veröffentlicht das Image mit. Der Hub selbst läuft auf Uberspace unter
      supervisord (`.github/workflows/hub.yml`).
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

## M10 · Zwei Sprachen → `v0.10.0`

Ausgelöst davon, dass das Repository am 2026-08-11 öffentlich wurde. Eine deutsche
Oberfläche mit deutschen Adressen schließt jeden aus, der kein Deutsch spricht — er kann
den Code lesen und trotzdem nicht herausfinden, was ein Bildschirm verspricht.
Entscheidung und Begründung: [ADR-010](adr/010-englisch-als-grundsprache.md).

**Definition of Done**

- [x] Englisch ist die Vorgabe, Deutsch wird bei passendem `navigator.language` gewählt
      und ist unter Einstellungen → Darstellung umschaltbar.
- [x] Kein i18n-Paket. Nachrichtenpakete als getippte Objekte; `de` ist als Form von `en`
      typisiert, ein fehlender Schlüssel ist ein Build-Fehler.
- [x] Geteilt nach Bereichen: die Schale im Eintritt, jeder Bildschirm im eigenen Chunk.
      Erster Paint 117,8 kB von 120 — die Umstellung hat das Budget nicht gekostet.
- [x] Die Sprache steht **vor** dem ersten Strich. Belegt durch einen Test, der die
      Überschrift ab einem MutationObserver vor dem Mounten aufzeichnet.
- [x] Adressen englisch, ohne Sprach-Präfix. Achtzehn alte Pfade leiten dauerhaft weiter —
      Middleware plus echte 301 in nginx und Apache, Abfrage inklusive.
- [x] Die Begründungssätze der Engine entstehen beim Lesen statt beim Scannen.
      `worker/match/reason.ts` behält nur noch die Reihenfolge.
- [x] Jeder nutzersichtbare Text wird in **beiden** Sprachen getestet.
- [ ] `docs/` ist noch deutsch. Der größte Brocken, der am wenigsten dringende — der
      README sagt es offen.

**Was dabei nebenbei herauskam**

- Jeder `Intl`-Formatierer der App war einmal beim Import gebaut und in `de-DE`
  eingefroren. `14,00 €` und `€14.00` sind für zwei Leser derselbe Betrag und füreinander
  Faktor hundert.
- `vaultStatus()` und die Hub-Prüfung gaben deutsche Sätze aus einem Thread zurück, der
  keine Sprache kennt. Beide geben jetzt Gründe zurück, die die Oberfläche wortet.
- Ein Fixture in `db.spec` behauptete ein Signal, das seinen Satz nie hätte erzeugen
  können — verdeckt vom handgeschriebenen Satz daneben.
- `/welcome` hatte zwei `v-if`-Wurzeln in einer `<Transition>` und ließ sich in der
  Entwicklung überhaupt nicht öffnen. Älter als diese Umstellung.

---

## M11 · Beobachtete Platten → `v0.11.0`

**Der Fund, auf dem alles hier steht, ist ein negativer.** Es gibt keinen Endpunkt, der
die Angebote zu einer Release-ID auflistet (`docs/02` § „Der Endpunkt, den es nicht
gibt"). „Diese Platte ist gerade bei jemandem aufgetaucht" ist per API **nicht
beantwortbar**. Genau deshalb scrapen die Drittanbieter-Werkzeuge, und genau deshalb
sterben sie regelmäßig.

Was es gibt, ist `GET /marketplace/stats/{release_id}`: **ohne Token**, ein Request pro
Release, liefert `num_for_sale` und `lowest_price`. Das beantwortet nicht „wer hat sie",
aber „wie viele gibt es und was kostet die billigste". Aus einem Mechanismus fallen damit
zwei Richtungen — und die zweite ist die, die es sonst nirgends gibt.

### Richtung 1: die eigene Sammlung (der eigentliche Grund für M11)

„Deine Pressung von *Selected Ambient Works* stand vor drei Monaten bei 40 €, die
billigste kostet jetzt 95 €." Discogs sagt einem das nicht, und keine der bekannten
Drittanbieter-Apps tut es. Wer verkaufen will, erfährt vom Anstieg heute nur durch Zufall.

- [x] Platten aus dem Regal beobachten. Bewusst eine **Auswahl**, keine Sammlung —
      `MAX_WATCHED = 100`, das sind zwei Minuten je Durchlauf.
- [x] Meldung bei einem Anstieg über eine gewählte Schwelle, mit Verlauf statt nur
      Momentwert. Verglichen wird mit dem **ältesten Punkt im Fenster**, nicht mit dem
      vorletzten: ein Anstieg von 40 auf 95 kommt in dreißig kleinen Schritten, und wer
      Nachbarn vergleicht, sieht ihn nie.
- [x] **„Verkauft" wird nicht behauptet.** Ein fallendes `num_for_sale` heißt „ein
      Angebot weniger" — das kann ein Kauf sein oder ein zurückgezogenes Listing, und
      die API sagt nicht, welches. Der Text sagt, was gemessen wurde, nicht was
      vermutet wird.
- [x] Für Platten, die schon in einem Dig auftauchten, geht es genauer:
      `GET /marketplace/listings/{id}` gibt `status`, und steht dort nicht mehr
      `For Sale`, ist genau dieses Angebot weg (`docs/02`). Aus „ein Angebot weniger"
      wird dann „die Kopie bei Plattenkiste steht nicht mehr drin".

⚠️ **Und das ist die einzige Stelle, an der der Wächter einen Laden nennt.** Der Satz
darüber — „wer verkauft Release X" ist per API nicht beantwortbar — gilt unverändert;
was hier abgefragt wird, sind ausschließlich Angebote, an denen ein Dig **dieses Geräts**
selbst vorbeigekommen ist. `noShops` auf dem Bildschirm sagt das jetzt so.

Bezahlbar ist es, weil die teure Nachfrage an einem billigen Signal hängt: gefragt wird
**nur**, wenn `num_for_sale` überhaupt gefallen ist, höchstens dreimal je Meldung
(`MAX_CONFIRM`), und eine einmal als verschwunden erkannte Kopie kostet nie wieder einen
Request (`goneOffers`). Im Normalfall — hundert beobachtete Platten, keine Bewegung —
sind das null zusätzliche Anfragen.

### Richtung 2: die Wantlist, mit Schwelle

Der zweithäufigste Wunsch aus den Foren: Wantlist-Einträge mit Bedingungen — „nur ab
VG+", „nur unter 30 €". Discogs' eigener **Wantlister** meldet jede Listung, ungefiltert.

⚠️ **Hier sind wir strikt schwächer als Discogs und das gehört gesagt.** Wantlister weiß,
*wer* gerade gelistet hat, weil Discogs den Marktplatz besitzt. Wir sehen nur „es gibt
jetzt drei Exemplare, das billigste für 24 €". Der Mehrwert ist deshalb **die Schwelle,
nicht die Entdeckung** — und der Dig bleibt das, was den Laden findet.

- [x] Preisschwelle je beobachtetem Eintrag (Zustand folgt: `/marketplace/stats/` kennt ihn nicht)
- [x] Meldung, wenn die billigste Kopie darunter fällt — einmal beim Übertreten, nicht bei jedem Durchlauf
- [x] Der Text nennt nie einen Laden, weil wir keinen kennen — und der Bildschirm sagt das auch

### Was das kostet — und warum es eine Auswahl bleibt

Ein Request pro beobachtetem Release und Runde. Mit Token sind 50 Platten **eine
Minute**, 500 Platten **zehn**. Die ganze Sammlung zu beobachten hätte genau die Form,
die Regel 2 verbietet.

Die Obergrenze ist deshalb kein Schönheitsfehler, sondern der Entwurf: **man beobachtet,
was man verkaufen würde, und was man wirklich sucht.** Der Hub kann es für einen
Freundeskreis mittragen — `/marketplace/stats/` braucht keinen Token, eine Abfrage bedient
alle —, aber nach Regel 8 muss es ohne ihn funktionieren.

---

## M12 · Wo die Platte steht → `v0.12.0`

**Optional, und das einzige Feature der ganzen Roadmap, das null Requests kostet.**

Die Sammlung liegt nicht in einer Liste, sie liegt in einer Wohnung: Regal im Wohnzimmer,
zweites Fach, die Kiste im Keller, der Karton auf dem Dachboden, den man seit dem Umzug
nicht aufgemacht hat. Discogs kennt diesen Ort nicht und will ihn nicht kennen.

Das ist dieselbe Frage wie der In-Store-Bildschirm, einen Schritt weiter: dort heißt sie
„habe ich die schon?", hier „und wo ist sie dann?".

- [x] Orte als flache Hierarchie: Ort → Möbel → Fach/Kiste. Drei Ebenen, erzwungen.
- [x] Ein Exemplar liegt an einem Ort — an der `instanceId`, nicht an der `releaseId`.
- [x] Beide Richtungen: „wo ist X" im Regal-Sheet, „was liegt im Keller" als Reiter.
- [x] Offline und lokal, **null Requests**. Ein eigener Store, den der Sync nicht anfasst.
- [x] Über den Tresor mitreisen, damit das Telefon im Keller dieselbe Antwort gibt — und
      in der Sicherungsdatei, denn Standorte sind das Einzige darin, das sich nirgends
      wiederbeschaffen lässt.

⚠️ **Dafür musste das Löschen aus beiden Stores verschwinden.** Der Abgleich kennt nur
„diese Zeile ist neuer" (`worker/vault/merge.ts`); eine gelöschte Zeile ist für ihn keine
Nachricht, sondern eine Lücke, und das Gerät, das sie noch hat, füllt sie beim nächsten
Mal wieder auf. Ein aufgelöstes Regal käme zurück, und eine heruntergenommene Platte läge
wieder darin — lautlos, und erst im Keller vor dem falschen Fach zu merken.

Seitdem trägt ein aufgelöster Ort `removedAt` und eine heruntergenommene Platte
`placeId: null`. Beides sind Schreibvorgänge und gewinnen jeden Vergleich. Gefiltert wird
ausschließlich in `worker/places.ts` — kein anderes Modul liest diese Stores, und ein
zweiter Filter wäre einer, den jemand vergisst. Ein Ort bekam dafür `updatedAt`: bei einem
umbenannten Regal ist `createdAt` auf beiden Geräten gleich, und dann entschiede der
Zufall.
- [x] Umziehen können: „alles aus Kiste 3 nach Regal 2".

✅ **Gemessen am 2026-09-11, und die Antwort ist nein.** `GET
/users/{u}/collection/fields` gibt genau drei Felder zurück — Media Condition, Sleeve
Condition, Notes — und keine selbst angelegten. Ein Standort kann also auch optional
nicht zu Discogs mitwandern: es gibt kein Feld dafür.

⚠️ **Der zweite Fund war wichtiger und stand nicht in der Liste.**
`worker/sync/library.ts` schreibt jede Sammlungszeile mit `put()` neu. Ein `placeId`
**am** Eintrag wäre nach dem nächsten vollen Durchlauf weg — lautlos, und niemand merkt
es, bis er eine Platte sucht. Deshalb ein eigener Store, und ein Test hält fest, dass der
Sync ihn nicht kennt.

---

## M13 · Die Platte in der Hand erkennen → `v0.13.0`

Zwei Stufen, die billigere zuerst.

### Stufe 1: Barcode

`GET /database/search?barcode=…` ist dokumentiert, kostet einen Request und geht **ohne
Token** (am 2026-09-11 gemessen).

> ⚠️ **Und er ist nicht eindeutig — das stand hier vorher falsch.** Gemessen am
> 2026-09-11: `5012394144777` liefert **acht** Releases in fünf Ländern (UK, Italien,
> Frankreich, Portugal, Europe), und das Release, aus dem der Barcode stammt, steht auf
> **Platz sieben**. Ein Barcode benennt eine *Veröffentlichung*, keine *Pressung*.
>
> Für Fidelitys Frage ist das kein Problem — „habe ich die schon" fragt ohnehin nach der
> Platte. Es wird nur eines, sobald die Oberfläche einen Treffer als *die* Antwort zeigt,
> oder wenn nur der erste Kandidat gegen die Sammlung geprüft wird: die eigene Pressung
> stand in der Messung an siebter Stelle.
>
> **Und nicht jede Platte hat einen.** Stichprobe über zehn Platten aus einer echten
> Sammlung: acht ja, zwei nein — eine Club-12" und ein White Label. Genau die Fälle, für
> die Stufe 2 gedacht ist.

- [x] Kamera → Barcode → Release → die Frage, die Fidelity stellt: *habe ich die schon,
      steht sie auf meiner Wantlist*. Gebaut in den In-Store-Bildschirm, der diese Frage
      schon beantwortet — die Kamera ist dort ein dritter Weg ins Suchfeld.
- [x] **Ohne neue Abhängigkeit.** `BarcodeDetector` ist in Chromium da und in WebKit
      nicht; auf einem iPhone wird deshalb kein Kameraknopf angeboten, sondern gesagt,
      dass dort getippt wird. Ein Decoder in JavaScript wiegt über hundert Kilobyte, und
      Regel 7 verlangt eine Rechtfertigung, die getippte Ziffern nicht brauchen.

Die Discogs-App hat einen Barcode-Scanner. Unserer beantwortet eine andere Frage — und
zwar die, für die man im Laden steht.

### Stufe 2: die Auslaufrille — nicht das Cover

> ⚠️ **Der Cover-Entwurf, der hier stand, ist nicht baubar. Gemessen am
> 2026-09-11.**
>
> Er lautete: perzeptueller Hash über die Cover aus `db/covers.ts`, verglichen mit einem
> Kamerabild, ohne einen einzigen Request. Das scheitert an einer Zeile, die nirgends
> steht: **`i.discogs.com` schickt keine CORS-Kopfzeile.** Am Server nachgeprüft — weder
> `access-control-allow-origin` noch irgendetwas Verwandtes, auch nicht auf einen
> Preflight.
>
> Die Folge im Browser: ohne `crossOrigin` lädt das Bild und **vergiftet den Canvas**,
> `getImageData` wirft einen `SecurityError`. Mit `crossOrigin="anonymous"` lädt es gar
> nicht. Ein `fetch` scheitert ebenfalls. Es gibt also keinen Weg, die Pixel der eigenen
> Cover zu lesen — und ohne lesbare Vergleichswerte kein Hash.
>
> Auch der Umweg über eine Texterkennung ist zu: `TextDetector` gibt es in keinem
> Browser mehr (gemessen: `BarcodeDetector` ja, `TextDetector` und `FaceDetector` nein).
> Eine OCR-Bibliothek wiegt Megabyte und fällt unter Regel 7.

**Stattdessen das, was Sammler ohnehin tun: die Nummer im Auslauf lesen.** Und sie ist
der bessere Ausweis, gemessen an derselben Stichprobe von zwölf Platten:

| | |
|---|---|
| mit Barcode | 10 von 12 |
| **mit Runout** | **11 von 12** |
| mit keinem von beidem | 0 |
| ohne Barcode, aber mit Runout | 2 |

Und genauer: die volle Zeichenkette `MPO SK 032 A1 G PHRUPMASTERGENERAL T2T LONDON`
liefert **einen** Treffer, wo ein Barcode acht liefert. Bruchstücke werden schnell
unbrauchbar — `MPO SK 032 A1` ergab 21, `SK 032 A1` dreitausendvierhundert, eine
markante Mastering-Signatur allein zwei.

- [x] Ein Feld nimmt beides und entscheidet selbst: nur Ziffern sind ein Barcode, alles
      mit Buchstaben ein Runout. Wer eine Platte in der Hand hält, will nicht erst
      wählen, welche Art Nummer er abtippt.
- [x] Zu kurze Bruchstücke werden gar nicht erst gesucht — unter sechs Zeichen holt die
      Suche den halben Katalog und kostet eine Anfrage für nichts.
- [ ] Offen: den Runout **vorlesen** statt abtippen. `SpeechRecognition` ist in Chrome
      da und in WebKit teilweise; zu messen, bevor es jemand verspricht.

⚠️ **Was hier weiterhin nicht versprochen wird:** Buchrücken im Regal erkennen. Ein
fotografiertes Regal in einzelne Platten zu zerlegen ist ein anderes, deutlich härteres
Problem.

---

## M14 · Gradet dieser Laden ehrlich? → `v0.14.0`

**Die Lücke, die Discogs strukturell nicht schließen kann.** Aus den Foren: das
Feedback-System misst „quality of transaction" und sagt nichts über die
Bewertungsgenauigkeit; negative Bewertungen wegen Übergrading werden auf Beschwerde des
Verkäufers entfernt. Übrig bleibt Aberglaube — „kauf nichts unter 100 %".

Fidelity kann etwas, was ein öffentliches Bewertungssystem nicht kann: **eine private
Aufzeichnung der eigenen Käufe.** Keine Fremdbewertung, kein Pranger, keine Moderation —
nur „bei diesem Laden waren sieben von acht Platten so, wie sie beschrieben waren", auf
dem eigenen Gerät.

- [x] Nach einer Lieferung: eine Frage, ein Tippen. Wie angekommen, besser, schlechter.
      Auf der Startseite (`ArrivalQuestion.vue`, immer nur **eine** Platte) und auf der
      Kaufliste, dort für jede gekaufte Zeile und jederzeit änderbar.
- [x] Steht im Händlerprofil — **neben** dem Fingerprint, nicht darin (siehe unten)
- [x] Bleibt lokal. Ein Ehrlichkeits-Score über fremde Menschen gehört niemandem außer
      dem, der die Platte ausgepackt hat. `worker/grading.ts` enthält kein `fetch`, und
      ein Test hält das fest.

### Die Messung, die der Entwurf umgehen musste

⚠️ Die Vorgabe war, `GET /marketplace/orders` auf die gelistete Kondition je Position zu
prüfen. **Am 2026-09-11 gemessen: der Endpunkt antwortet auf diesem Konto mit
`items: 0`** — es gibt dort keine Bestellungen. Die Messung ist nicht durchführbar, und
ein Feature auf ein Feld zu bauen, das niemand gesehen hat, wäre geraten.

Es zeigte sich außerdem, dass die Frage falsch gestellt war. Die versprochene Note wäre
**Discogs-Content** und dürfte nach sechs Stunden nicht mehr auf dem Schirm stehen
(Regel 4, `docs/09` §1.1). Ein Feature, das sie mitschreibt, um sie Wochen später
danebenzustellen, verstößt gegen die Regel — egal aus welchem Endpunkt sie kommt.

**Der Ausweg ist, nur den Vergleich zu speichern.** „Wie beschrieben / besser /
schlechter" ist ein *abgeleitetes* Datum, dieselbe Kategorie wie Scores und der
Fingerprint, und die dürfen ausdrücklich bleiben. Die Oberfläche fragt deshalb auch nicht
„war es wirklich VG+", sondern „wie kam sie an" — eine Frage, die die Antwort nicht
voraussetzt, die die App gar nicht kennt. Zwei Tests halten das: einer liest
`shared/types.ts` und `worker/grading.ts` gegen jedes Notenwort, einer den Wortschatz
beider Sprachen.

### Zwei Entscheidungen, die beim Bauen dazukamen

- **Zehn Tage Reifezeit** (`ASK_AFTER_MS`). Ein Haken bei „gekauft" heißt bestellt, nicht
  angekommen; wer am selben Abend gefragt wird, lernt die Frage zu überlesen. Nur die
  Frage *von selbst* wartet — auf der Kaufliste steht sie ab dem ersten Tag.
- **Nicht in den Fingerprint.** Der wird aus einem Inventar-Scan gebaut und trägt
  Coverage; eine Quote aus den eigenen Käufen ist etwas anderes und müsste den
  Fingerprint bei jedem Daumen neu schreiben. Sie steht im Profil direkt unter der
  Discogs-Verkäuferbewertung — nebeneinander liest man den Unterschied zwischen „Ablauf"
  und „stimmte die Note", untereinander kämen sie nie zusammen.

⚠️ **Unter fünf beurteilten Platten gibt es keine Prozentzahl** (`MIN_FOR_RATE`). Zwei von
zwei sind 100 %, und das liest sich wie ein Urteil über einen Laden, über den man nichts
weiß.

---

## M15 · Der Stapel → `v0.15.0`

Eine **zweite** Oberfläche für dieselben Daten, neben der Liste und nicht statt ihr:
oben eine Reihe Händler wie bei Instagram — farbiger Ring, wo es Neues gibt —, darunter
eine Platte nach der anderen, ganzflächig, mit Cover, Begründungssatz und Preis. Wischen
geht weiter, drei Knöpfe: mögen, in den Korb, teilen. Am Ende eines Ladens geht es beim
nächsten weiter.

### Warum das technisch billig ist

**Ein Wisch kostet null Requests.** Der Dig hat längst stattgefunden, die Treffer liegen
in `matches`, die Cover in `covers`, und der Nachschlag über die Top 50 ist gelaufen. Der
Stapel *zeigt* nur, was schon da ist. Damit gilt weder Regel 3 noch das Tempo-Problem —
und ein Feed, der beim Wischen nachlädt, wäre bei 1,2 s pro Anfrage ohnehin unbenutzbar.

Auch die drei Knöpfe sind Verdrahtung, kein neuer Apparat: `feedback` (M3), `basket` (M4)
und das Teilen aus M9 gibt es. Der Ring am Händler ist eine Darstellung von Daten, die
schon existieren — `depth: 'neu'` weiß, was seit dem letzten Besuch dazugekommen ist, und
der Wächter aus M9 weiß, ob sich der Bestand verändert hat.

- [x] Eigene Route, eigener Chunk, nur geladen wenn jemand ihn öffnet (Regel 7) —
      `stack-*.js` liegt als eigene Datei im Build
- [x] Wischen mit Pointer Events und einer CSS-Transformation. **Keine Bibliothek** — eine
      Karte, die der Geste folgt, sind rund hundert Zeilen, und das Budget ist 180 kB.
      Die Schwelle liegt bei 80 px; darunter ist es ein Zittern beim Tippen
- [x] `prefers-reduced-motion` respektiert — über die globale Regel in `main.css`, die
      jede Übergangsdauer auf 0,01 ms zieht. Der Stapel braucht dafür keine eigene Zeile
- [x] Vollständig mit der Tastatur bedienbar (Pfeiltasten links und rechts). Ein Stapel,
      den nur ein Daumen bedienen kann, ist ein Bildschirm, den ein Teil der Leute nicht
      hat

### Vier Entwurfsentscheidungen, die nicht verhandelbar sind

- [x] **Zurücknehmen.** Tinder kann sich ein verlorenes Nein leisten, eine seltene Platte
      nicht. Jeder Wisch ist umkehrbar, und zwar sichtbar.
- [x] **Die Reihenfolge bleibt die Punktzahl.** Zu mischen, damit es länger spannend
      bleibt, würde das Einzige wegwerfen, was diese App kann. Der Stapel sortiert
      überhaupt nicht — er zeigt, was `dig.get` liefert, und das ist nach Punktzahl
      geordnet.
- [x] **Der Begründungssatz steht auf jeder Karte** (`reasonFor(match.signals)`). Ohne ihn
      ist der Stapel ein Spielautomat mit Plattenhüllen. Mit ihm ist er das, was Fidelity
      ohnehin verspricht, nur schneller zu lesen.
- [x] **Er hört auf.** Ein Laden ist irgendwann durch, und dann sagt das der Bildschirm
      und bietet den nächsten an, der noch etwas hat. Unendlichkeit vorzutäuschen wäre
      die eine Sorte Sog, die zu einer App, deren ganzer Wert Ehrlichkeit ist, nicht
      passt.
- [x] Preise grauen aus, sobald `expiresAt` überschritten ist. Ein Stapel, durch den man
      schnell wischt, ist der leichteste Ort, an dem ein sechs Stunden alter Preis
      unbemerkt stehen bleibt (Regel 4).

### Hörprobe — möglich, aber sie kostet ein Versprechen

**Am 2026-09-10 gemessen:** `GET /releases/{id}` liefert `videos[]` mit `uri` (YouTube),
`title` und `duration` — bei Release 1 vierzehn Stück. **Der Nachschlag holt diesen
Endpunkt für die Top-Treffer ohnehin**, die Hörproben kämen also gratis mit, genau wie die
Pressing-Felder.

Stichprobe über sieben Releases: fünf hatten Videos (14, 17, 9, 1, 1), zwei keine. Also
grob zwei von drei — bei sieben Stück ist das ein Anhaltspunkt und keine Zahl.

**Entschieden am 2026-09-10: [ADR-012](adr/012-hoerprobe.md).** Die Hörprobe kommt, als
benannte Ausnahme in der Form von ADR-009 — denn Discogs' einzige Tonquelle ist YouTube,
und ein Embed lädt Google. Was dabei tatsächlich abfließt, ist nicht die Sammlung, sondern
die IP und welche Platte gerade angesehen wird; der Satz „verlässt dieses Gerät nicht"
stimmt danach trotzdem nicht mehr ohne Zusatz, und ein Versprechen, das nur fast stimmt,
ist gebrochen.

- [x] Standardmäßig aus, ein Schalter pro Gerät
- [x] **Kein Byte an Google, bevor jemand es will.** Der `<iframe>` entsteht erst beim
      ersten bewussten Tippen, nicht beim Zeichnen einer Karte
- [x] Danach eine Player-Instanz, die mitwandert (`loadVideoById()` je Karte). Das ist
      zugleich der einzige Weg, der funktioniert: Browser verlangen für Ton eine Geste,
      und diese eine trägt dann durch den Stapel. **Autoplay auf Karte eins gibt es
      nicht**, in keinem Browser
- [x] `youtube-nocookie.com` — verhindert Cookies vor dem Abspielen, nicht die Anfrage
- [x] Die Datenschutzseite hat einen eigenen Absatz, der beim Namen nennt, wer was
      erfährt
- [x] Der Ton hängt an der Platte, nicht am Stück: `videos[]` gehört zum Release. Bei
      einer Compilation nennt der Bildschirm den Titel, den er spielt, statt so zu tun,
      als wäre es *die* Platte

---

## Nicht auf der Roadmap

| Idee | Warum nicht |
|---|---|
| Wantlist-Alerts als Entdeckung | Discogs besitzt Wantlister, und der weiß, **wer** gerade gelistet hat, weil Discogs den Marktplatz besitzt. Wir sehen über `/marketplace/stats/` nur „es gibt jetzt drei Exemplare, das billigste für 24 €". Auf Entdeckung zu konkurrieren wäre aussichtslos — auf die **Schwelle** nicht, die Wantlister nicht hat. Deshalb M11 Richtung 2, und deshalb nennt sie nie einen Laden. |
| Eigener Checkout | ToS-Verstoß, strategisch dumm |
| Sammlungs-Katalogisierung | Gelöstes Problem, ein Dutzend Apps |
| Native App | PWA reicht vollständig |
| Bezahlmodell | ToS verbietet Gebühren für API-integrierte Apps ohne Genehmigung |
| Multi-Händler-Suche | Es gibt **keinen** Listings-by-Release-Endpunkt. Nur über Scraping – kommt nicht in Frage. |
| Nutzerkonten mit Passwort | Braucht niemand. Der optionale Hub (M9) nutzt ein geteiltes Secret. |
| Signalgewichte pro Nutzer | Stand als `signalWeights` im Datenmodell und wurde nie gelesen; am 2026-08-11 entfernt. Punktzahlen müssen über die Zeit **und zwischen Menschen** vergleichbar bleiben — deshalb sind `SCALE` und `SECONDARY` Konstanten, und deshalb wäre eine Verstellung pro Nutzer derselbe Fehler eine Ebene höher. |

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

M11 (Marktwächter) ─┬─▶ braucht M5 nicht, nur /marketplace/stats/
                    └─▶ teilt sich den Zustellweg mit dem Wächter aus M9

M12 (Lagerorte) ────▶ hängt an nichts. Null Requests, rein lokal.
      │
      └──▶ M13 (Erkennen) — Stufe 2 rechnet auf den Covern aus db/covers.ts

M14 (Grading) ──────▶ hängt am Händler-Fingerprint aus M3

M15 (Stapel) ───────▶ **nach** „Dig teilen" aus M9, nicht davor: der dritte
                      Knopf auf jeder Karte *ist* das Teilen. Andersherum
                      baut man einen Knopf, der nichts tut — oder zweimal
```
