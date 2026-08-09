# 01 – Architektur & Tech-Stack

> **Status:** Entwurf v0.1 · **Stand:** 2026-08-09

---

## 1. Die drei harten Randbedingungen

Bevor irgendeine Technologieentscheidung fällt, müssen drei Fakten auf dem Tisch liegen.
Sie bestimmen die Architektur vollständig.

### RB-1 · Discogs erlaubt maximal 10.000 Listings pro fremdem Händler

```
GET /users/juno_records/inventory?page=100&per_page=100  →  200 OK
GET /users/juno_records/inventory?page=101&per_page=100  →  403
    {"message":"Pagination above 100 disabled for inventories besides your own"}
```

Das Limit gilt auf die **Seitenzahl**, nicht auf den Offset. `per_page=100 × 100 Seiten =
10.000 Listings`. Und `pagination.pages` **lügt** – meldet bei 43.234 Items brav `433`,
aber ab Seite 101 kommt 403.

Besteht seit spätestens 2018, Discogs-Statement: *„this is not a limitation we can lift at
this time."*

**Mitigation:** `sort_order=asc` **und** `desc` liefern zwei disjunkte 10.000er-Fenster →
**bis zu 20.000 Listings**. Bei Sortierung über verschiedene Keys (`listed`, `price`,
`artist`, `catno`) lassen sich weitere Fenster stichprobenartig abgreifen, aber ohne
Vollständigkeitsgarantie.

> **Produktkonsequenz:** Die UI muss ehrlich sein. *„18.400 von 43.234 Listings gescannt
> (42 %)"* – nicht so tun, als wäre es vollständig.

### RB-2 · Rate Limit gilt pro Quell-IP, nicht pro Token

- **60 Requests/Minute** authentifiziert, 25 unauthentifiziert
- Gleitendes 60-Sekunden-Fenster
- **Pro Quell-IP** – mehr OAuth-Tokens kaufen **keinen** zusätzlichen Durchsatz
- Header: `X-Discogs-Ratelimit`, `-Used`, `-Remaining`
- Bei Überschreitung: **429 ohne `Retry-After`-Header** – eigener Backoff nötig

> ⚠️ **Uberspace-spezifisches Risiko:** Uberspace-Hosts haben eine geteilte ausgehende IP.
> Theoretisch teilen wir uns das 60/min-Budget mit anderen Uberspace-Kunden, die die
> Discogs-API nutzen. Wahrscheinlichkeit gering, Auswirkung spürbar. → Adaptiver
> Token-Bucket, der sich **an den Response-Headern orientiert**, nicht am eigenen Zähler.

### RB-3 · Marketplace-Daten dürfen max. 6 Stunden alt angezeigt werden

Aus den API Terms of Use:

> „You may not display in any format or to any audience the Content if it is more than
> six (6) hours older than the information on Our online properties."

**Aber:** Die monatlichen **Data Dumps sind CC0** – Public Domain, keine Frist, keine
Attribution nötig, kommerzielle Nutzung erlaubt.

> **Die daraus folgende Architektur-Regel, und sie ist die wichtigste im ganzen Projekt:**
>
> ```
> Katalogdaten (Releases, Master, Labels, Künstler, Credits)  ←  CC0-Dumps
>     └─ dauerhaft speicherbar, unbeschränkt, offline aufgebaut
>
> Marktplatzdaten (Inventar, Preise) + Nutzerdaten (Sammlung, Wantlist)  ←  Live-API
>     └─ Anzeige max. 6 h alt, Attribution Pflicht, nicht weitergebbar
> ```

---

## 2. Zeitbudget eines Digs

Bei 60 Requests/Minute, ein Request pro ~1,1 s:

| Schritt | Requests | Dauer |
|---|---:|---:|
| Händlerprofil (`/users/{u}`) | 1 | 1 s |
| Inventar 10.000 Listings (`per_page=100`) | 100 | **~1,8 min** |
| Inventar 20.000 (asc + desc) | 200 | ~3,7 min |
| Sammlung 2.000 Releases (gecacht, 1×/Tag) | 20 | 22 s |
| Wantlist 500 Einträge | 5 | 6 s |
| **Ein vollständiger Dig (10k, Sammlung gecacht)** | **~101** | **~2 min** |

**Nicht verhandelbar:** Niemals `/releases/{id}` in der Scan-Schleife aufrufen.
10.000 Releases × 1 Request ≈ **3 Stunden** (bei 1,1 s pro Request). Genau dafür existiert die Katalog-DB aus den Dumps.

---

## 3. Systemarchitektur

```
┌─────────────────────────────────────────────────────────────────────┐
│  BROWSER (PWA)                                                       │
│  Nuxt 4 · Vue 3 · Tailwind 4 · Nuxt UI 4                            │
│  Service Worker: App-Shell precache, IndexedDB-Outbox                │
└───────────────┬─────────────────────────────────────────────────────┘
                │ HTTPS · SSE für Scan-Fortschritt
┌───────────────▼─────────────────────────────────────────────────────┐
│  NITRO SERVER  (ein Node-Prozess)                                    │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────────────┐   │
│  │ server/api   │  │ Auth (OAuth   │  │ pg-boss Worker         │   │
│  │ (typed)      │  │ 1.0a Discogs) │  │ (in-process, Nitro-    │   │
│  │              │  │               │  │  Plugin)               │   │
│  └──────────────┘  └───────────────┘  └───────────┬────────────┘   │
│                                                    │                 │
│  ┌─────────────────────────────────────────────────▼─────────────┐  │
│  │  DISCOGS CLIENT                                                │  │
│  │  · globaler Token-Bucket (header-gesteuert, adaptiv)           │  │
│  │  · Serialisierung: max. 1 In-Flight-Request App-weit           │  │
│  │  · 429-Backoff exponentiell + Jitter, ETag-Caching             │  │
│  └────────────────────────────────┬──────────────────────────────┘  │
└───────────────┬───────────────────┼─────────────────────────────────┘
                │                   │
    ┌───────────▼──────────┐   ┌────▼──────────────────┐
    │  PostgreSQL          │   │  api.discogs.com      │
    │  · app-Schema        │   │  60 req/min pro IP    │
    │  · catalog-Schema    │   └───────────────────────┘
    │    (read-only,       │
    │     aus CC0-Dumps)   │
    │  · pgboss-Schema     │
    └──────────▲───────────┘
               │  offline eingespielt, nicht in Produktion erzeugt
    ┌──────────┴────────────────────────────────────────────┐
    │  KATALOG-PIPELINE (läuft LOKAL, nicht auf dem Server)  │
    │  Dumps (10,4 GB gz) → Streaming-XML-Parser →           │
    │  kompakte abgeleitete Tabellen → pg_dump → rsync       │
    └───────────────────────────────────────────────────────┘
```

### Warum ein einziger Node-Prozess?

Uberspace gibt **1,5 GB RAM für alle Prozesse zusammen**. Budget:

| Prozess | RAM |
|---|---:|
| PostgreSQL (`max_connections=20`, kleine `shared_buffers`) | ~250 MB |
| Nitro (SSR + API + Worker in-process) | ~250 MB |
| Reserve (Deploy, Migrationen, Cron) | ~200 MB |
| **Summe** | **~700 MB von 1.500 MB** |

Ein separater Worker-Prozess würde ~200 MB extra kosten, ohne Nutzen: Der Scan ist
**I/O-gebunden bei 1 Request/Sekunde**, nicht CPU-gebunden. Er konkurriert praktisch nicht
mit dem Request-Handling.

> **ADR-004** dokumentiert die Auftrennung für später (>50 Nutzer oder mehrere parallele Digs).

---

## 4. Tech-Stack – Entscheidung mit Begründung

Alle Versionen zum 2026-08-09 verifiziert.

### 4.1 Runtime: **Node 22 LTS**

Nicht Node 24, obwohl es Active LTS ist. **Uberspace bietet nur 18 / 20 / 22 an** –
22 ist dort Default und bis April 2027 supported. Lokales Docker-Image muss identisch sein,
sonst debuggt man Unterschiede statt Features.

| Verworfen | Grund |
|---|---|
| Node 24/26 | Auf Uberspace nicht verfügbar |
| Bun / Deno | Der Flaschenhals sind 60 Requests/Minute. Runtime-Durchsatz ist irrelevant. Ökosystem-Sicherheit (`pg`, `pg-boss`, Sentry-Instrumentierung, Playwright) wiegt schwerer. |

### 4.2 Framework: **Nuxt 4.5.x** (Vue 3.5, Vite 8)

Du kannst Vue. Das ist das stärkste Argument, und es ist ein gutes.

- **Nuxt 3 ist seit 2026-07-31 EOL** – kein Grund, dort zu starten
- Nuxt 4.5 bringt Vite 8, experimentelles SSR-Streaming, `enabled`-Option für
  `useFetch`/`useAsyncData` (relevant für abhängige Fetches)
- **Nuxt 5 kommt Q4 2026** (im Kern Nitro v3). Plan: auf 4.5.x starten,
  `future.compatibilityVersion: 5` in einem Branch testen, Upgrade Q1 2027

| Verworfen | Grund |
|---|---|
| Next.js 16 | Exzellent, aber React + Vercel-Gravitation. Kein Grund, umzulernen. |
| SvelteKit | Schön und schlank, aber Ökosystem-Tausch ohne Gegenwert |
| Astro | Falsche Form. Das hier ist eine App, keine Dokumentseite. |
| Laravel 13 + Inertia | **Ernsthaft erwogen.** Die stärkste Batteries-included-Job-Story (Horizon, `RateLimited`-Middleware, `Bus::batch()`). Verloren, weil: eine Sprache statt zwei, du kennst Vue besser als du Laravel-Queues brauchst, und wir stehlen Laravels *Design* (Rate-Limiter-Middleware, Batch mit Fortschritt, Overlap-Lock) ohne PHP. |

> ⚠️ **Vue 3.6 / Vapor Mode nicht einplanen.** RC, opt-in pro Komponente, Ökosystem
> unerprobt. Bei datenlastigen Listen kommt die Performance aus Virtualisierung, nicht aus
> dem Render-Modus. 3.6 ist ein Gratis-Bonus, wenn es GA geht.

### 4.3 Datenbank: **PostgreSQL 15**

> Uberspace 7 bietet **12, 13, 14, 15** an, Default ist **15** – kein 16, kein 17, kein 18.
> **Vor dem ersten Commit gegenprüfen:** `uberspace tools version list postgresql`.
> Das lokale Docker-Image wird auf **dieselbe Major-Version** gepinnt (`postgres:15`),
> sonst debuggt man Versionsunterschiede statt Features.
>
> Konsequenz: kein eingebautes `uuidv7()` (kam erst mit PG 18) – wir brauchen einen
> Fallback (siehe `03-DATENMODELL.md` §1). Bei einem späteren Umzug auf einen VPS
> (siehe `10-DEPLOYMENT-ALTERNATIVEN.md`) ist PG 18 möglich; das ist dann ein bewusster
> Versionssprung mit `pg_upgrade`, kein Nebeneffekt.

Nötige Extensions: `pg_trgm`, `unaccent`, `pgcrypto`. Alle im Uberspace-Paket enthalten.

| Verworfen | Grund |
|---|---|
| SQLite / libSQL | **Ernsthaft erwogen** – kein Daemon, kein RAM, Deploy = Datei kopieren. Verloren, weil der Credit-Graph (Signal 8) und die Diskografie-Lücken (Signal 4) echte relationale Graph-Abfragen sind, und weil `pg_trgm` + später `pgvector` sonst fehlen. Wir würden binnen eines Jahres migrieren. |
| MariaDB (Uberspace-Default) | Kein `pg_trgm`, schwächere Volltextsuche, kein JSONB-Äquivalent |
| Redis / Valkey | Kein Bedarf. Ein Dienst weniger im RAM-Budget. |

### 4.4 ORM: **Drizzle ORM 0.45.x** (gepinnt)

SQL-transparent. Wir schreiben viel `pg_trgm`-, FTS- und CTE-lastiges SQL – ein ORM, das
sich dazwischendrängt, ist ein Gegner.

> ⚠️ **Ehrliches Risiko:** Drizzle 1.0 ist seit über 18 Monaten im RC. Stable ist immer noch
> die 0.45-Linie. **Version hart pinnen, nicht auf 1.0-rc springen.**
> Fallback, falls die 0.45-Linie stirbt: **Kysely** (reiner typisierter Query-Builder) +
> rohes SQL. Migration wäre schmerzhaft, aber nicht katastrophal, weil die Query-Logik
> ohnehin SQL-nah ist. Siehe **ADR-003**.

### 4.5 Job-Queue: **pg-boss 12.x**

Postgres-nativ, `SELECT ... FOR UPDATE SKIP LOCKED`, kein Redis, kein Extra-Prozess,
kleiner RAM-Fußabdruck. Genau richtig für 5–30 Nutzer.

| Verworfen | Grund |
|---|---|
| BullMQ 6 (Postgres-Backend) | Reifere API, aber das PG-Backend ist erst seit Juli 2026 da und BullMQ 6 bringt viele Breaking Changes. Zu frisch für die Basisschicht. |
| Inngest / Trigger.dev | Gehostete Durable Execution löst ein Problem, das wir nicht haben |

### 4.6 UI: **Nuxt UI 4.10** + **Tailwind CSS 4.3** + **Reka UI**

Nuxt UI Pro ist seit 2026 **kostenlos und vollständig Open Source** (125+ Komponenten,
inkl. Command Palette, Data Table, Dashboard-Layouts). Damit entfällt der einzige Grund,
stattdessen shadcn-vue zu nehmen.

- **Tailwind 4 CSS-first**: `@import "tailwindcss"` + `@theme { --color-*: oklch(...) }`,
  jede Theme-Variable wird automatisch zur CSS Custom Property
- `@tailwindcss/vite` verwenden, **nicht** den PostCSS-Weg
- **Radix Vue ist tot** (letztes Release 2025-02-28) → Reka UI. Jedes Tutorial, das
  `radix-vue` nennt, ist veraltet.

### 4.7 API-Schicht: **Nitro `server/api` + Zod 4**

Nitros typisiertes `$fetch` liefert End-to-End-Typen gratis. **Kein tRPC/oRPC am Anfang** –
das lohnt erst mit einem zweiten Konsumenten (separater Worker, native App). Dann **oRPC**
(RPC *und* OpenAPI aus einer Definition), nicht tRPC.

### 4.8 Der Rest

| Bereich | Wahl | Version |
|---|---|---|
| Sprache | TypeScript (die von Nuxt 4.5 gepinnte Version) | 5.9 / 6.x |
| Validierung | Zod | 4.4.x |
| Lint | ESLint + `@nuxt/eslint` + `eslint-plugin-vue` | 10.x / 1.17 / 10.10 |
| Format | Prettier | 3.9.x |
| Unit/Component | Vitest | 4.1.x |
| E2E + A11y | Playwright + `@axe-core/playwright` | 1.62 / 4.12 |
| Tabellen/Listen | `@tanstack/vue-table` + `@tanstack/vue-virtual` | 9.x / 3.13 |
| Client-State | `@tanstack/vue-query` | 5.101 |
| Motion | `motion-v` | 2.3 |
| PWA | `@vite-pwa/nuxt` | 1.1.x |
| Monitoring | Sentry `@sentry/nuxt` (Free Tier) | 10.69 |

> ⚠️ **TypeScript 7.0** (Go-Port, 7–12× schneller) ist seit Juli 2026 draußen, aber
> `vue-tsc` und `typescript-eslint` hinken hinterher. **Nicht am Projektstart adoptieren.**
> Als Upgrade-Ticket für Q4 2026 anlegen.

> ⚠️ **Biome statt ESLint verworfen.** Biomes Vue-Support ist besser geworden, aber
> `eslint-plugin-vue` (Template-A11y, `vue/no-undef-components`, Ordering) hat kein
> Äquivalent, und `@nuxt/eslint` kennt Auto-Imports und Route-Typen.

---

## 5. Der Discogs-Client

Die wichtigste eigene Komponente. Spezifikation:

```ts
// server/lib/discogs/client.ts – Verhaltensvertrag

// 1. GLOBALE SERIALISIERUNG
//    Genau ein In-Flight-Request app-weit. Nebenläufigkeit bringt nichts,
//    weil das Limit pro IP gilt – sie erzeugt nur 429er.

// 2. ADAPTIVER TOKEN-BUCKET
//    Steuergröße ist X-Discogs-Ratelimit-Remaining aus der letzten Antwort,
//    NICHT der eigene Zähler.
//    remaining > 20  → 1100 ms Pause
//    remaining 6–20  → 1600 ms
//    remaining ≤ 5   → 5000 ms
//    429             → exponentiell 60s, 120s, 240s + Jitter (max 3 Versuche)
//    Hinweis: -Used verhält sich nicht monoton. Nicht darauf verlassen.

// 3. USER-AGENT IST PFLICHT
//    'Fidelity/0.1.0 +https://fidelity.example.de'
//    Ohne UA: leere Antwort oder 403, ohne brauchbare Fehlermeldung.

// 4. AUTH IMMER ALS HEADER, NIE ALS QUERYSTRING
//    Authorization: OAuth oauth_consumer_key="…", oauth_signature_method="PLAINTEXT", …
//    (Historischer Bug: Key/Secret im Querystring lieferte 25/min statt 60/min.)

// 5. OAUTH 1.0a MIT PLAINTEXT-SIGNATUR
//    Discogs empfiehlt PLAINTEXT über HTTPS ausdrücklich. Signatur ist dann
//    wörtlich "consumer_secret&" bzw. "consumer_secret&token_secret".
//    Spart die gesamte HMAC-SHA1-Base-String-Konstruktion – die häufigste
//    Fehlerquelle in allen Forenthreads.

// 6. ZWEI FEHLERFORMATE PARSEN
//    Legacy:   { "message": "Invalid sort: expected one of …" }
//    Migriert: { "detail": [ { "type": "literal_error", "loc": […], … } ], "message": "…" }
//    Discogs migriert gerade Backend-Stacks. Beides muss behandelt werden.

// 7. BILDER NIEMALS SERVERSEITIG HOLEN
//    i.discogs.com läuft über Cloudflare mit EIGENEM, undokumentiertem Limit (~30–40/min).
//    Wir liefern die URLs an den Client; der Browser holt sie über die IP des Nutzers.

// 8. ETag / If-None-Match, wo unterstützt. Ein 304 kostet trotzdem ein Rate-Limit-Token,
//    spart aber Bandbreite und Parsing.
```

### OAuth-1.0a-Flow

| Schritt | Methode | URL |
|---|---|---|
| 1. Request Token | GET | `https://api.discogs.com/oauth/request_token` |
| 2. Autorisieren | Redirect | `https://www.discogs.com/oauth/authorize?oauth_token=…` |
| 3. Access Token | POST | `https://api.discogs.com/oauth/access_token` |
| 4. Verifizieren | GET | `https://api.discogs.com/oauth/identity` |

Access Tokens laufen **nicht ab** (bis der Nutzer sie widerruft). **Es gibt keine Scopes** –
ein Token gibt Vollzugriff inkl. Schreibrechten auf Sammlung, Wantlist und Bestellungen.
→ Verschlüsselt at rest (`pgcrypto`), Schlüssel aus ENV, niemals geloggt.

---

## 6. Die Katalog-Pipeline (läuft lokal, nicht in Produktion)

Discogs veröffentlicht monatlich zum 1./2. CC0-XML-Dumps auf `data.discogs.com`:

| Datei | Größe (gz) |
|---|---:|
| `discogs_YYYYMM01_releases.xml.gz` | **10,4 GB** (~100–120 GB entpackt) |
| `discogs_YYYYMM01_masters.xml.gz` | 593 MB |
| `discogs_YYYYMM01_artists.xml.gz` | 472 MB |
| `discogs_YYYYMM01_labels.xml.gz` | 86 MB |

**Auf Uberspace nicht verarbeitbar** (10 GB Quota, 1,5 GB RAM). Deshalb:

```
LOKAL (Docker, viel Platte)                     PRODUKTION (Uberspace)
─────────────────────────────                   ──────────────────────
1. Dump laden + SHA-256 prüfen
2. Streaming-SAX-Parse (nie in den RAM)
3. NUR extrahieren was gebraucht wird:
     release_id → master_id
     release_id → label_ids[], catno[]
     release_id → artist_ids[]
     release_id → genres[], styles[], country, year, format
     release_id → credits[] (nur Producer, Engineer,
                  Mixed By, Mastered By, Recorded At)
     master_id  → main_release_id, title, year
4. → catalog-Schema, COPY-Bulk-Import
5. Indizes bauen, ANALYZE
6. pg_dump --schema=catalog | zstd        ──rsync──▶  psql < catalog.sql
                                                       (~1,5–3 GB, monatlich)
```

> **Nicht extrahieren:** Tracklists, Notes, Bilder, Videos, Identifiers (außer
> Matrix/Runout in Phase 3). Sonst sprengt es das 10-GB-Quota.

**Speicherbudget Produktion** (Schätzung, vor dem Bau messen):

| Tabelle | Zeilen | Größe |
|---|---:|---:|
| `catalog.release` (schlank) | ~20 M | ~1,6 GB |
| `catalog.release_artist` | ~45 M | ~1,2 GB |
| `catalog.release_label` | ~25 M | ~0,7 GB |
| `catalog.credit` (gefiltert) | ~30 M | ~1,0 GB |
| Indizes | | ~1,5 GB |
| **Summe** | | **~6 GB** |

> ⚠️ **Das passt gerade so ins 10-GB-Default-Quota.** Uberspace lässt sich bis 100 GB
> hochbuchen. **Vor M5 exakt vermessen** und ggf. `catalog.credit` auf die relevanten Rollen
> und Releases nach 1950 eindampfen. Notfall-Plan: Credits nur für Labels/Künstler laden,
> die in mindestens einer Nutzersammlung vorkommen.

**Phasing:** M2–M4 laufen **ohne** Katalog-DB. Die Signale 1, 3, 5, 7 (Wantlist exakt,
Künstler, Label, Stil) funktionieren allein aus Sammlung + Inventar. Die Katalog-Pipeline
ist M5 – wenn das Produkt bereits nutzbar ist.

---

## 7. Datenfluss eines Digs

```
1  POST /api/digs { dealer: "vinyl-tom" }
2  → pg-boss Job "dig.scan", Antwort 202 + digId
3  Client öffnet GET /api/digs/:id/stream  (Server-Sent Events)

4  Worker:
   a) GET /users/vinyl-tom              → num_for_sale prüfen
      → wenn > 10.000: dem Nutzer sofort sagen, dass es Teilabdeckung wird
   b) Sammlungs-Snapshot: frisch, wenn älter als 24 h
   c) Inventar Seite für Seite, per_page=100
      → nach jeder Seite: SSE-Event { scanned, total, eta, newMatches }
   d) Ab 10.000: automatisch zweiter Durchlauf mit sort_order=desc
   e) Matching inline pro Seite (nicht am Ende) → erste Treffer nach ~5 s sichtbar
   f) Barry Score, Begründungssätze, Top Five
   g) dig.expires_at = now() + 6h        ← ToS-Regel, hart im Datenmodell

5  Client: Ergebnisliste streamt live ein.
   Nach 6 h: Liste gesperrt, Banner „Snapshot ist abgelaufen – neu scannen".
```

**Warum inkrementelles Matching?** Zwei Minuten Spinner sind produktfeindlich. Treffer, die
nach fünf Sekunden erscheinen und weiterwachsen, fühlen sich wie Suchen an, nicht wie Warten.

---

## 8. Die 6-Stunden-Regel im Datenmodell

Nicht als Policy im Kopf, sondern als Spalte in der Datenbank:

```sql
-- Jeder Dig trägt sein eigenes Verfallsdatum.
-- Kein Spalten-DEFAULT möglich (der dürfte created_at nicht referenzieren) –
-- gesetzt wird es beim INSERT durch die Applikation bzw. per BEFORE-INSERT-Trigger.
ALTER TABLE app.dig
  ADD COLUMN expires_at timestamptz NOT NULL DEFAULT now() + interval '6 hours';

-- Abgelaufene Digs liefern keine Marktplatzdaten mehr aus.
-- Was wir behalten dürfen: unsere ABGELEITETEN Daten (Scores, Signale,
-- Händler-Fingerprint) und listing_ids für den Diff der Watchlist.
-- Was wir nicht mehr anzeigen: Preise, Zustände, Verfügbarkeit.
```

Der Watchlist-Diff braucht den alten Snapshot. Zulässig, solange wir daraus nur
*„6 neue Treffer"* anzeigen und die Details frisch nachladen.

---

## 9. Fuzzy-Matching von Künstler- und Labelnamen

Das eigentliche algorithmische Problem in M2.

**Das Problem:** Ein Inventory-Listing enthält `release.artist` als **String**
(`"Miles Davis"`, `"Various"`, `"Kraftwerk / Neu!"`) und `release.label` als **String**
(nur das erste Label!). Die Sammlung liefert dagegen `artists[]` und `labels[]` **mit IDs**.

**Die gute Nachricht:** Beide Seiten stammen aus derselben Discogs-Datenbank. Die Strings
sind kanonisch, inklusive Disambiguierungs-Suffixen (`"Nirvana (2)"`). Normalisierter
Exact-Match hat daher sehr hohe Präzision.

**Die Kaskade:**

```
1. NORMALISIEREN – exakt das, was app.norm() in 03-DATENMODELL.md §1 tut,
   gespeichert als GENERATED-Spalte und indiziert:
   lower → unaccent → führende Artikel weg ("The Beatles" ≈ "Beatles, The")
   → Klammer-Qualifikatoren behalten (!) ("Nirvana (2)" ist ein ANDERER Künstler)
   → übrige Interpunktion/Whitespace kollabieren

2. EXACT MATCH auf normalisiert           → Konfidenz 1.00
3. TOKEN-CONTAINMENT für Mehrfachkünstler → Konfidenz 0.85
   "Kraftwerk / Neu!" enthält "Kraftwerk"
4. pg_trgm similarity() ≥ 0.85            → Konfidenz 0.70
   fängt Tippfehler und Schreibvarianten
5. "Various" / "Various Artists"          → NIE als Künstlertreffer werten
```

`unaccent()` ist `STABLE`, nicht `IMMUTABLE`. Für einen Index braucht es einen
`IMMUTABLE`-Wrapper – mit dem bekannten Vorbehalt, dass Wörterbuchänderungen ein `REINDEX`
erfordern.

> **Keine Embeddings am Anfang.** „Gleiche Platte, anderes Pressing" ist ein
> Normalisierungs- und Katalognummern-Problem, kein semantisches. `pgvector` erst, wenn
> gemessene Relevanz das rechtfertigt (Stil-Adjazenz in Phase 3).

---

## 10. Sicherheit

| Thema | Umsetzung |
|---|---|
| OAuth-Tokens | `pgcrypto`-verschlüsselt at rest, Key aus ENV, nie geloggt, nie an den Client |
| Sessions | HTTP-only, Secure, SameSite=Lax Cookie; serverseitige Session-Tabelle |
| Zugang | Einladungscodes, keine offene Registrierung (Phase 1) |
| Secrets | `~/.env` auf Uberspace, `0600`, nie im Repo; GitHub Secrets für CI |
| CSP | strikt, `img-src` erlaubt `i.discogs.com` |
| Rate Limiting eigener API | pro Session, verhindert versehentliche Dig-Spam-Loops |
| Abhängigkeiten | Renovate, `pnpm audit` im CI, GitHub Actions auf Commit-SHA gepinnt |
