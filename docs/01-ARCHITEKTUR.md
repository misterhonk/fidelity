# 01 – Architektur & Tech-Stack

> **Fidelity hat kein Backend.** Eine statische PWA, die direkt mit `api.discogs.com`
> spricht. Alle Daten liegen im Browser des Nutzers. Siehe ADR-007.

---

## 1. Die vier harten Randbedingungen

Diese vier Fakten bestimmen die Architektur vollständig. Alle am 2026-08-09 live gegen
die Produktions-API verifiziert.

### RB-1 · Discogs erlaubt CORS aus dem Browser

```
access-control-allow-origin:  *
access-control-allow-headers: Content-Type, authorization, User-Agent,
                              Private-Auth-Secret, Discogs-UID
access-control-expose-headers: Location
```

`/users/juno_records/inventory` mit einem Safari-User-Agent → **200, 43.223 Listings.**
Discogs blockt Browser-User-Agents nicht, obwohl die Doku „avoid Mozilla" sagt.

**Das ist die Grundlage für alles Weitere.** Ohne CORS gäbe es diese Architektur nicht.

> ⚠️ **Zwei Einschränkungen, die daraus folgen:**
>
> 1. **`x-discogs-ratelimit-*` steht nicht in `expose-headers`** → JavaScript kann die
>    Rate-Limit-Header **nicht lesen**. Der adaptive Token-Bucket aus dem Serverentwurf
>    ist nicht baubar. Wir fahren blind und konservativ (siehe §5).
> 2. **`POST /oauth/access_token` ist per CORS gesperrt** (500, nur `HEAD, OPTIONS`)
>    → **OAuth 1.0a ist unmöglich.** Auth läuft über Personal Access Tokens.

### RB-2 · Rate Limit gilt pro Quell-IP – und das ist hier ein Vorteil

- **60 Requests/Minute** authentifiziert, gleitendes 60-Sekunden-Fenster
- **Pro Quell-IP**
- Bei Überschreitung: **429 ohne `Retry-After`**

```
Server-Architektur:   30 Nutzer  →  1 × 60 req/min   →  Warteschlange
Client-Architektur:   30 Nutzer  →  30 × 60 req/min  →  keine Warteschlange
```

Im Serverentwurf war das die härteste Skalierungsgrenze. Im Browser ist sie weg – jeder
Nutzer bringt sein eigenes Budget mit.

### RB-3 · Maximal 10.000 Listings pro fremdem Händler

```
GET /users/{u}/inventory?page=100&per_page=100  →  200 OK
GET /users/{u}/inventory?page=101&per_page=100  →  403
    {"message":"Pagination above 100 disabled for inventories besides your own"}
```

Die Grenze sitzt auf der **Seitenzahl**, nicht auf dem Offset. Und `pagination.pages`
**lügt** – meldet bei 43.234 Items brav `433`, aber ab Seite 101 kommt 403.

**Mitigation:** `sort_order=asc` **und** `desc` liefern zwei disjunkte Fenster →
**bis zu 20.000 Listings**. Darüber ist vollständige Abdeckung unmöglich.

> **Produktkonsequenz:** Die UI muss ehrlich sein. *„18.400 von 43.234 Listings gescannt
> (43 %)"* – nicht so tun, als wäre es vollständig.

### RB-4 · Marktplatzdaten dürfen max. 6 Stunden alt angezeigt werden

Aus den API Terms of Use. Katalogdaten dagegen stehen als CC0-Dumps frei zur Verfügung –
wir holen dieselben Fakten nur über die API und speichern **ausschließlich ID-Kanten**,
nie anzeigbaren Content. Details: `09-LEGAL.md`, `11-KATALOG-STRATEGIE.md` §7.

---

## 2. Systemarchitektur

```
┌───────────────────────────────────────────────────────────────────────┐
│  BROWSER (installierte PWA)                                            │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  MAIN THREAD — Nuxt 4 SPA (ssr: false)                           │ │
│  │  Vue 3 · Tailwind 4 · Nuxt UI 4 · virtualisierte Listen          │ │
│  └───────────────────────────┬──────────────────────────────────────┘ │
│                              │ postMessage (Fortschritt, Treffer)      │
│  ┌───────────────────────────▼──────────────────────────────────────┐ │
│  │  WEB WORKER — die gesamte Arbeit                                  │ │
│  │  ┌────────────────┐  ┌──────────────┐  ┌───────────────────────┐ │ │
│  │  │ DiscogsClient  │  │ Matching     │  │ Horizon-Expansion     │ │ │
│  │  │ · 1 req/1,2 s  │  │ Engine       │  │ · Artists/Labels/     │ │ │
│  │  │ · 429-Backoff  │  │ (reine Fkt.) │  │   Master → Kanten     │ │ │
│  │  │ · resumierbar  │  │              │  │                       │ │ │
│  │  └────────────────┘  └──────────────┘  └───────────────────────┘ │ │
│  └───────────────────────────┬──────────────────────────────────────┘ │
│                              │                                         │
│  ┌───────────────────────────▼──────────────────────────────────────┐ │
│  │  INDEXEDDB (via idb, ~2 KB)                                       │ │
│  │  token · collection · wantlist · tasteProfile                     │ │
│  │  horizon (Int32Array-Blobs) · digs · dealers · basket             │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  SERVICE WORKER — App-Shell precache, Cover-Cache (LRU 150 MB)   │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────┬───────────────────────────────────────┘
                                │ HTTPS, direkt
                    ┌───────────▼──────────────┐
                    │  api.discogs.com         │
                    │  60 req/min – für DICH   │
                    └──────────────────────────┘

┌───────────────────────────────────────────────────────────────────────┐
│  HOSTING — nur statische Dateien, kein Prozess, keine Datenbank        │
│  Uberspace-Docroot · Cloudflare Pages · GitHub Pages — alle gratis     │
└───────────────────────────────────────────────────────────────────────┘
```

**Alles außer dem Rendering läuft im Worker.** Der Main-Thread bleibt bei 60 fps, auch
während ein Dig 20.000 Listings durchkaut.

---

## 3. Zeit- und Ressourcenbudget

| Vorgang | Requests | Dauer | Rechenzeit |
|---|---:|---:|---:|
| Sammlung + Wantlist, erstmalig | ~25 | ~30 s | ~200 ms |
| Horizont-Expansion, einmalig | ~670 | ~13 min | ~2 s |
| Dig über 10.000 Listings | ~101 | ~2 min | **~60 ms** |
| Dig über 20.000 Listings | ~201 | ~4 min | **~120 ms** |
| Sammlungs-Delta, täglich | 1–3 | ~4 s | ~10 ms |

**Das Netzwerk dominiert um den Faktor 2.000.** Rechenzeit ist in dieser App kein Thema –
was zählt, ist jeder eingesparte Request. Vollständiges Budget: `12-RESSOURCEN-BUDGET.md`.

---

## 4. Tech-Stack – Entscheidung mit Begründung

### 4.1 Framework: **Nuxt 4.5 im SPA-Modus** (`ssr: false`)

Statisch generiert (`nuxt generate`), kein Node zur Laufzeit. Du kannst Vue – das ist das
stärkste Argument, und es ist ein gutes.

- **Nuxt 3 ist seit 2026-07-31 EOL**, also gar nicht erst dort anfangen
- File-based Routing, Auto-Imports, `@vite-pwa/nuxt`, Nuxt UI 4 – alles fertig verdrahtet
- Vite 8 als Build-Layer

| Verworfen | Grund |
|---|---|
| Nuxt **mit** SSR | Bräuchte einen Node-Prozess. Bei einer App hinter Token-Eingabe bringt SSR nichts. |
| Vite + Vue 3 pur | ~40 KB schlanker, aber wir bauen Routing, Auto-Imports und PWA-Integration selbst nach. **Rückfalloption, falls das Bundle-Budget reißt.** |
| Next.js / SvelteKit / Astro | React-Umlernen bzw. falsche Form; kein Gegenwert |
| Laravel / Nitro / irgendein Backend | Es gibt keinen Server mehr. Siehe ADR-007. |

> ⚠️ **Vue 3.6 / Vapor Mode nicht einplanen.** RC, opt-in pro Komponente, Ökosystem
> unerprobt. Bei Listen kommt die Performance aus Virtualisierung.

### 4.2 Speicher: **IndexedDB via `idb`**

~2 KB Wrapper über die native API. Kein Dexie (~25 KB), kein SQLite-in-WASM
(~1 MB und völlig überdimensioniert für ein paar Key-Value-Stores plus zwei Indizes).

Der Horizont wird als **`Int32Array`-Blob** abgelegt, nicht als Objektliste:
200.000 Release-IDs = **800 KB** statt ~9 MB.

| Verworfen | Grund |
|---|---|
| PostgreSQL + Drizzle | Kein Server mehr. ADR-002 und ADR-003 sind damit gegenstandslos. |
| SQLite WASM (wa-sqlite / SQLocal) | 1 MB Bundle, OPFS-Zicken auf Safari, und wir brauchen keine relationalen Joins – nur Set-Lookups |
| localStorage | 5-MB-Limit, synchron, blockiert den Main-Thread |

### 4.3 Auth: **Personal Access Token**

`POST /oauth/access_token` ist per CORS gesperrt – OAuth ist damit unmöglich. Der Nutzer
holt sich seinen Token unter `discogs.com/settings/developers` und trägt ihn einmal ein.

- Token liegt in IndexedDB, verlässt das Gerät nie
- Wird **nie geloggt**, nie in einen Fehler-Report geschrieben, nie in die URL gepackt
- „Abmelden" löscht Token und alle Daten
- Kein Consumer Secret im Client – wir haben keins

### 4.4 Der Rest

| Bereich | Wahl | Anmerkung |
|---|---|---|
| Sprache | TypeScript (die von Nuxt 4.5 gepinnte Version) | TS 7 erst, wenn `vue-tsc` nachgezogen hat |
| UI | Nuxt UI 4.10 + Tailwind 4.3 + Reka UI | Nuxt UI Pro ist seit 2026 gratis und OSS. **Radix Vue ist tot.** |
| Tokens | DTCG 2025.10 → Style Dictionary → `@theme` | OKLCH |
| Listen | `@tanstack/vue-virtual` | ab ~200 Zeilen Pflicht |
| Validierung | Zod 4.4 (nur an der API-Grenze) | |
| PWA | `@vite-pwa/nuxt` 1.1 | |
| Test | Vitest 4 + Playwright 1.62 **inkl. WebKit** | schwächstes Ziel ist iOS Safari |
| Lint | ESLint 10 + `@nuxt/eslint` + Prettier | Biome kann `eslint-plugin-vue` nicht ersetzen |
| Charts | **keine Bibliothek** | Balken sind `<div>`s, das Serien-Raster ist CSS Grid |
| Monitoring | optional Sentry, **ohne** Session Replay | Bandbreite beim Nutzer |

---

## 5. Der Discogs-Client

Die wichtigste eigene Komponente. Lebt im Web Worker.

```ts
// worker/discogs/client.ts – Verhaltensvertrag

// 1. BLIND UND KONSERVATIV DROSSELN
//    x-discogs-ratelimit-* steht NICHT in access-control-expose-headers.
//    JavaScript kann die Header nicht lesen – der adaptive Token-Bucket aus dem
//    Serverentwurf ist nicht baubar.
//    → feste 1200 ms zwischen Requests (= 50/min, 10 unter dem Limit)
//    → bei 429 (Status IST lesbar): 60s, 120s, 240s + Jitter, max. 3 Versuche
//    → nach 3 Fehlversuchen: Dig pausieren, dem Nutzer sagen warum

// 2. GENAU EIN IN-FLIGHT-REQUEST
//    Nebenläufigkeit bringt nichts – das Limit ist zeitbasiert, nicht parallelitätsbasiert.

// 3. AUTH ALS HEADER
//    Authorization: Discogs token=<PAT>
//    Nie im Querystring (historischer Bug: 25/min statt 60/min).

// 4. USER-AGENT GEHT NICHT
//    fetch() verbietet den Header. Verifiziert unkritisch: Discogs akzeptiert
//    Browser-User-Agents. ⚠️ In M1 als ALLERERSTES gegenprüfen – bricht das,
//    bricht die gesamte Architektur.

// 5. ZWEI FEHLERFORMATE PARSEN
//    Legacy:   { "message": "..." }
//    Migriert: { "detail": [ { "type": "literal_error", ... } ], "message": "..." }

// 6. BILDER NIEMALS AKTIV LADEN
//    i.discogs.com hat ein eigenes, undokumentiertes Cloudflare-Limit (~30–40/min).
//    Wir setzen nur <img loading="lazy"> – der Browser holt sie, wenn sie sichtbar sind.

// 7. JEDER LAUF IST RESUMIERBAR
//    Seitencursor nach jeder Seite in IndexedDB. Tab zu, Handy gesperrt,
//    Netz weg → beim nächsten Öffnen geht es weiter statt von vorn.
```

---

## 6. Der Horizont – bedarfsgesteuerter Katalog

Fünf Signale brauchen Daten, die im Inventory-Listing fehlen (`master_id`, Credits,
Genres, vollständige Labelliste). Der naheliegende Weg – `/releases/{id}` pro Listing –
kostet rund **3 Stunden pro Dig** und ist ausgeschlossen.

**Die Lösung ist eine Umkehrung der Abfragerichtung:**

```
FALSCH:  20.000 Inventar-Listings  →  je 1 Request  →  Metadaten
         teuer, flüchtig, pro Dig neu

RICHTIG: ~150 Entitäten aus der SAMMLUNG  →  je 1–11 Requests  →  Release-ID-Mengen
         einmalig, langlebig, danach jeder Dig ein Set-Lookup zum Nulltarif
```

Die Sammlung ist klein und stabil. Das Inventar ist groß und flüchtig.
**Man cacht die kleine, stabile Seite.**

### Verifiziert am 2026-08-09

```
GET /artists/40135/releases?per_page=100        (Conny Plank)
→ 1.095 Einträge · 11 Requests · keine Seitengrenze
  Rollen: { Main: 13, Remix: 11, Producer: 76 }   ← das role-Feld ist der Schlüssel
  Typen:  { master: 72, release: 28 }

GET /masters/2598/versions?per_page=100          (Neu! – Neu! 2)
→ 55 Pressungen mit release_id · 1 Request
```

`/artists/{id}/releases` liefert nicht nur die Alben als Hauptkünstler, sondern **auch die
produzierten, gemischten und geremixten** – mit Rollenangabe. Damit ist der Credit-Graph
für elf Requests erreichbar statt für einen 10,4-GB-Dump.

| Was | Auswahl | Endpunkt | Requests |
|---|---|---|---|
| Wantlist-Alben | alle mit `master_id ≠ 0` | `/masters/{id}/versions` | ~1 je Album |
| Künstler | ≥ 2 Platten in der Sammlung | `/artists/{id}/releases` | 1–11 |
| Labels | Lift ≥ 2 **und** < 1.500 Releases | `/labels/{id}/releases` | 1–15 |
| Credits | Personen mit Lift ≥ 3 | `/artists/{id}/releases` | 1–11 |

**~670 Requests ≈ 13 Minuten, einmalig.** Danach nur Deltas, Revalidierung alle 30 Tage.
**Der 10,4-GB-Releases-Dump wird nicht gebraucht** – Begründung: `11-KATALOG-STRATEGIE.md`.

---

## 7. Ablauf eines Digs

```
1  Nutzer gibt Händlernamen ein
2  Worker: GET /users/{dealer}  →  num_for_sale
   → > 10.000?  Sofort ehrlich anzeigen, wie viel erreichbar ist
3  Worker paginiert das Inventar, per_page=100, 1 Request/1,2 s
4  NACH JEDER SEITE:
   a) 100 Listings normalisieren, harte Filter
   b) Set-Lookup gegen den Horizont + Map-Lookup gegen Sammlung/Wantlist
   c) Fuzzy-Stufe nur für die Reste
   d) Scoring + Begründungssatz
   e) postMessage: { scanned, total, eta, newMatches }
   f) Cursor in IndexedDB persistieren
   g) die 100 Rohlistings verwerfen — nur Treffer ab Score 30 bleiben
5  Ab 10.000: automatisch zweiter Durchlauf mit sort_order=desc
6  Fertig: expiresAt = now + 6h  ← ToS, hart im Datenmodell
7  Nach 6 h: Marktplatzfelder werden genullt, Banner „Snapshot abgelaufen"
```

**Warum inkrementell?** Vier Minuten Spinner sind produktfeindlich. Treffer, die nach
fünf Sekunden erscheinen und weiterwachsen, fühlen sich wie Suchen an, nicht wie Warten.

**Warum die Rohlistings sofort verwerfen?** 20.000 Listings à ~2 KB wären 40 MB im
Speicher. Wir behalten ~600 Treffer.

---

## 8. Fuzzy-Matching von Künstler- und Labelnamen

Das eigentliche algorithmische Problem – jetzt in JavaScript statt in `pg_trgm`.

**Das Problem:** Ein Inventory-Listing liefert `release.artist` als **String**
(`"Miles Davis"`, `"Various"`, `"Kraftwerk / Neu!"`) und `release.label` als **String**
(nur das erste!). Die Sammlung liefert `artists[]` und `labels[]` **mit IDs**.

**Die gute Nachricht:** Beide Seiten stammen aus derselben Discogs-Datenbank. Die Strings
sind kanonisch, inklusive Disambiguierungs-Suffixen (`"Nirvana (2)"`). Normalisierter
Exact-Match hat sehr hohe Präzision – und ist eine `Map`-Abfrage in O(1).

```
1. NORMALISIEREN — einmal beim Sync, nicht pro Dig
   lower → Diakritika entfernen (String.normalize('NFD') + Regex)
   → führende Artikel weg ("The Beatles" ≈ "Beatles")
   → Klammer-Qualifikatoren BEHALTEN (!) — "Nirvana (2)" ist ein ANDERER Künstler
   → übrige Interpunktion und Whitespace kollabieren

2. EXACT MATCH  Map.get(norm)                  → Konfidenz 1.00   O(1)
3. TOKEN-CONTAINMENT für Mehrfachkünstler      → Konfidenz 0.85
   "kraftwerk / neu!" enthält Token "kraftwerk"
4. TRIGRAM-ÄHNLICHKEIT ≥ 0.85, nur für Reste   → Konfidenz 0.70
5. "various" / "various artists" / "v/a"       → NIE als Künstlertreffer
```

Stufe 4 ist die einzige teure – sie läuft nur für die wenigen hundert Listings, die
Stufe 2 und 3 nicht getroffen haben. Gemessenes Budget: < 60 ms für 20.000 Listings.

> **Keine Embeddings.** „Gleiche Platte, anderes Pressing" ist ein Normalisierungs- und
> Katalognummern-Problem, kein semantisches.

---

## 9. Sicherheit & Datenschutz

| Thema | Umsetzung |
|---|---|
| Personal Access Token | Nur IndexedDB, nie geloggt, nie in URL oder Fehler-Report, nie an Dritte |
| „Abmelden" | Löscht Token **und** alle lokalen Daten |
| DSGVO | **Es gibt keinen Server, der fremde Daten verarbeitet.** Kein Auftragsverarbeiter, kein Cookie-Banner, kein Tracking. Datenschutzerklärung beschreibt schlicht: alles bleibt auf deinem Gerät |
| CSP | Strikt. `connect-src 'self' https://api.discogs.com` · `img-src 'self' https://i.discogs.com data:` |
| Subresource Integrity | Für alles, was nicht aus dem eigenen Build kommt (idealerweise: nichts) |
| Abhängigkeiten | Renovate, `pnpm audit` im CI, GitHub Actions auf Commit-SHA gepinnt |
| Persistenz | `navigator.storage.persist()` anfragen, damit iOS nicht nach 7 Tagen aufräumt |
