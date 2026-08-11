# CLAUDE.md

Arbeitsanweisungen für Claude Code in diesem Repository.

---

## Was das hier ist

**Fidelity** – ein Kaufberater für Discogs. Scannt das Sortiment eines Händlers, gleicht
es gegen Sammlung und Wantlist ab, liefert eine bewertete Fundliste mit Begründungssatz
pro Treffer.

**Es ist eine reine Client-PWA. Es gibt kein Backend.** Statische Dateien, IndexedDB,
direkter Zugriff auf `api.discogs.com` aus dem Browser. Siehe `docs/adr/007-client-only-pwa.md`.

**Lies vor der ersten Aufgabe:** `docs/00-KONZEPT.md`, `docs/01-ARCHITEKTUR.md`,
`docs/02-DISCOGS-API.md`, `docs/12-RESSOURCEN-BUDGET.md`.

---

## Die sieben Regeln, die du nie brichst

1. **Kein Backend, keine Datenbank, kein Server-Prozess.**
   Wenn eine Aufgabe nach einem Server verlangt, ist die Aufgabe falsch gestellt – frag nach.

2. **Niemals `/releases/{id}` in einer Schleife.**
   10.000 Releases ≈ 3 Stunden. Release-Metadaten kommen aus dem Horizont oder gar nicht.

3. **Niemals nebenläufige Discogs-Requests.**
   Genau ein In-Flight-Request, **1.200 ms mit Token, 2.400 ms ohne** – ohne Token
   erlaubt Discogs nur 25 statt 60 Anfragen pro Minute (gemessen 2026-08-10). Alles läuft
   durch den einen `DiscogsClient` im Worker.

   **Und zwar über alle Tabs hinweg.** Das Limit gilt pro IP, ein Tab ist keine IP.
   Der Slot wird unter dem Web Lock `fidelity:discogs` gegen `meta.lastRequestAt`
   beansprucht. Wer den Pacer anfasst, behält das bei.

4. **Niemals Marktplatzdaten älter als 6 Stunden anzeigen.**
   ToS. `dig.expiresAt` erzwingt das. Nicht umgehen, auch nicht „nur für die Entwicklung".

5. **Niemals scrapen.** Kein `discogs.com/sell/…`-HTML, kein undokumentiertes
   `/marketplace/search`. Nur dokumentierte API-Endpunkte.

   **Eine benannte Ausnahme:** `GET /users/{username}/friends` für den Händler-Import –
   standardmäßig aus, pro Gerät einschaltbar, kein Feature hängt daran, Herkunft steht an
   jeder Zeile. Bedingungen und Begründung in ADR-009. Eine zweite Ausnahme braucht eine
   zweite ADR.

6. **Der Personal Access Token verlässt IndexedDB nicht.**
   Nie loggen, nie in eine URL, nie in einen Fehler-Report, nie an Dritte.

7. **Jede neue Abhängigkeit muss ihren Platz im Bundle-Budget rechtfertigen.**
   Budget: ≤ 120 KB gzip für den ersten sinnvollen Paint. Siehe `docs/12-RESSOURCEN-BUDGET.md`.

8. **Kein Feature darf den optionalen Hub voraussetzen.**
   Ab M2 gibt es die Ports `HorizonSource`, `ShippingProfileSource` und `WatchService`
   (`shared/ports.ts`). Hub-Abfragen laufen immer mit 2 s Timeout, ohne Retry, und fallen
   **lautlos** auf den lokalen Weg zurück. Siehe `docs/13-HUB-ADDON.md` und ADR-008.

---

## Fakten über die Discogs-API, die du dir merken musst

Alle am 2026-08-09 live verifiziert.

| Fakt | Konsequenz |
|---|---|
| **CORS ist offen** (`allow-origin: *`, `authorization` erlaubt) | Der Browser darf direkt zugreifen – Grundlage der ganzen Architektur |
| **`x-discogs-ratelimit-*` steht NICHT in `expose-headers`** | JS kann die Rate-Limit-Header **nicht lesen**. Blind mit 1.200 ms fahren |
| **Die 429 kommt ohne `access-control-allow-origin`** (Cloudflare, gemessen 2026-08-10) | JS sieht **auch den Status 429 nie** – nur einen abgelehnten `fetch()`. `if (status === 429)` ist im Browser toter Code |
| **`POST /oauth/access_token` per CORS gesperrt** | OAuth ist unmöglich → Personal Access Token |
| **`fetch()` kann keinen User-Agent setzen** | Verifiziert unkritisch – Discogs akzeptiert Browser-UAs. Trotzdem: erster Test in M1 |
| **Max. 10.000 Listings** pro fremdem Händler (Seite 101 → 403) | `sort_order` asc+desc für 20.000; Coverage ehrlich anzeigen |
| `pagination.pages` **lügt** bei Inventory | Nie darauf verlassen, immer auf 403 vorbereitet sein |
| **60 Req/min pro IP** – und die IP ist die des **Nutzers** | Kein geteiltes Budget, keine Warteschlange |
| Inventory-`release` hat **kein `master_id`, kein `genre`/`style`** | „Anderes Pressing" braucht den Horizont |
| Inventory-`release.label` ist **nur das erste Label** | Multi-Label-Releases werden unterschätzt |
| Inventory-`artist` ist ein **String ohne IDs** | Fuzzy-Kaskade: Map-Lookup → Token → Trigram |
| `status`-Filter wird bei fremden Händlern **ignoriert** | Clientseitig filtern |
| **`/artists/{id}/releases` liefert ein `role`-Feld** (`Producer`, `Remix`, …) | Der Credit-Graph kostet 11 Requests statt 10,4 GB |
| **Zwei Fehlerformate** (legacy + FastAPI) | Beide parsen |
| **Inventory liefert gar keine Bilder** – `release.thumbnail` ist leer, in 1.200 von 1.200 Zeilen über vier Läden (gemessen 2026-08-10) | `Match.thumbUrl` ist immer `null`. Cover kommen aus `db/covers.ts`: gratis aus der Sammlung, sonst je ein `/releases/{id}` für das, was auf dem Schirm ist |
| Bilder: **separates Cloudflare-Limit** (~30–40/min) | Nur `loading="lazy"`, nie aktiv fetchen |
| Wantlist-Pfad heißt **`/wants`**, nicht `/wantlist` | |

Vollständig: `docs/02-DISCOGS-API.md`.

---

## Codekonventionen

**Sprache: Englisch — überall.** Code, Kommentare, Commits, Variablennamen,
**nutzersichtbare Texte und Adressen**. Deutsch ist eine Übersetzung, keine Grundlage.

Das war bis zum 2026-08-11 anders und ist mit [ADR-010](docs/adr/010-englisch-als-grundsprache.md)
umgestellt: seit das Repository öffentlich ist, schließt eine deutsche Oberfläche mit
deutschen Adressen jeden aus, der kein Deutsch spricht — er kann den Code lesen und trotzdem
nicht herausfinden, was ein Bildschirm verspricht.

- Oberfläche: Englisch ist die Vorgabe, Deutsch wird angeboten und bei passendem
  `navigator.language` automatisch gewählt.
- Adressen: englisch, ohne Sprach-Präfix. Die Sprache ist eine Einstellung, keine Route.
- `docs/` ist noch deutsch und wird es zuletzt. Neue Dokumente dort dürfen deutsch sein,
  neue Kommentare im Code **nicht**.

```
worker/discogs/    Der einzige Ort, an dem fetch() gegen Discogs stattfindet.
                   Kein anderes Modul ruft die API direkt auf.
worker/match/      Scoring-Engine. REINE FUNKTIONEN, kein I/O, kein IndexedDB.
                   Das ist Absicht – so ist sie Golden-File-testbar.
worker/horizon/    Expansion der Sammlung in Release-ID-Mengen.
db/                IndexedDB-Schema und Zugriff via idb.
shared/            Typen und das postMessage-Protokoll zwischen Main und Worker.
app/               Nuxt: pages, components, composables. NUR Darstellung.
```

**Der Main-Thread rechnet nicht.** Scannen, Matching, Scoring und Horizont-Expansion
laufen ausschließlich im Web Worker. Der Main-Thread rendert und nimmt Eingaben entgegen.

**TypeScript:** `strict`. Kein `any`. Externe Daten (API-Antworten) immer durch ein
Zod-Schema an der Grenze.

**Geld:** Integer-Cents oder `decimal.js`. **Niemals `float` für Preise.**

**Große Datenmengen:** TypedArrays statt Objektlisten. Ergebnislisten als `shallowRef`,
nicht `ref` – Vue soll nicht 20.000 Objekte reaktiv machen.

---

## Commits

Conventional Commits, erzwungen durch commitlint:

```
feat(dig): add incremental matching during inventory scan
fix(discogs): handle both legacy and FastAPI error shapes
perf(horizon): pack release ids as Int32Array
docs(api): document the 10k pagination wall
```

Scopes: `dig` `match` `discogs` `horizon` `auth` `basket` `watch` `dealers` `hub` `demo`
`sync` `ui` `i18n` `db` `pwa` `deploy` `deps`

Releases macht `release-please`. **Version niemals von Hand hochsetzen**,
**CHANGELOG.md niemals direkt für ein Release editieren** – nur im Release-PR nachschärfen.

---

## Tests

Vor jedem PR: `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm size`

**Der wichtigste Test des Projekts** ist der Golden-File-Test der Scoring-Engine
(`tests/unit/scoring.spec.ts`) gegen eingefrorene Fixtures echter Inventare und
Sammlungen. **Jede Änderung an Signalgewichten muss den Snapshot aktualisieren** – und
der Diff muss im PR erklärt werden.

**Score-Formel:** stärkstes Signal + 0,3 × Summe der übrigen, skaliert auf 115 = 100 Punkte.
`SCALE` und `SECONDARY` sind **Konstanten und bleiben es** – wer sie pro Meilenstein
nachjustiert, macht Scores über die Zeit unvergleichbar. Details in
`docs/04-MATCHING-ENGINE.md` §4.

**Zusätzlich Pflicht:**

- **Performance-Benchmark:** 20.000 synthetische Listings scoren in < 250 ms
- **Bundle-Budget** (`size-limit`) – Überschreitung bricht den Build
- Discogs-API im Test **immer gemockt**, Fixtures unter `tests/fixtures/`
- Playwright **inkl. WebKit** – schwächstes Ziel ist iOS Safari

---

## Wenn du unsicher bist

- **Neue Discogs-Endpunkte:** erst `docs/02-DISCOGS-API.md` prüfen. Steht er nicht drin,
  vorher Request-Kosten, Auth-Anforderungen **und CORS-Verhalten** klären und dort ergänzen.
- **Architekturentscheidungen:** ADR unter `docs/adr/` anlegen (Vorlage: ADR-001).
- **Neue Signale:** erst `docs/04-MATCHING-ENGINE.md` erweitern, dann implementieren.
- **Neue Abhängigkeit:** Rechtfertigt sie ihre Bytes? Siehe `docs/12-RESSOURCEN-BUDGET.md`.

## Was du nicht ohne Rückfrage tust

- Ein Backend einführen – in irgendeiner Form
- IndexedDB gegen SQLite-WASM oder eine andere Speicher-Engine tauschen
- Eine Chart-Bibliothek hinzufügen (Balken sind `<div>`s, Raster ist CSS Grid)
- `ssr: true` setzen
- Auf TypeScript 7 wechseln (`vue-tsc` hinkt noch)
- Die 6-Stunden-Regel oder `dig.expiresAt` anfassen
- Rechenarbeit vom Worker in den Main-Thread verlagern
- Bilder aktiv per `fetch()` laden
