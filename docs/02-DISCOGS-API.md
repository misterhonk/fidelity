# 02 – Discogs-API-Referenz (projektbezogen)

> Recherchiert und **live gegen die Produktions-API verifiziert am 2026-08-09**.
> Die offizielle Doku ist an mehreren Stellen nachweislich veraltet – Abweichungen sind
> unten markiert. Basis-URL: `https://api.discogs.com`

---

## 1. Authentifizierung

| Ebene | Identifiziert Nutzer? | Limit | Für uns |
|---|---|---|---|
| Ohne | nein | 25/min | nein |
| Key + Secret | **nein** | 60/min | nein (liest keine privaten Sammlungen) |
| **Personal Access Token** | nur den Besitzer | 60/min | ✅ **unser Weg** - jeder Nutzer liest seine eigenen Daten |
| **OAuth 1.0a** | jeden zustimmenden Nutzer | 60/min | ❌ per CORS gesperrt, siehe 1b |

### OAuth 1.0a mit PLAINTEXT

Discogs empfiehlt **ausdrücklich PLAINTEXT über HTTPS statt HMAC-SHA1**. Damit ist die
Signatur wörtlich:

```
Schritt 1 (request_token):  oauth_signature = "{consumer_secret}&"
Schritt 3 (access_token):   oauth_signature = "{consumer_secret}&{request_token_secret}"
```

Keine Base-String-Konstruktion, keine Parameter-Sortierung, keine Prozent-Encoding-Fallen.
Das ist die mit Abstand häufigste Fehlerquelle in allen Forenthreads – und hier vermeidbar.

```http
Authorization: OAuth oauth_consumer_key="KEY",
                     oauth_nonce="RANDOM",
                     oauth_signature="SECRET&",
                     oauth_signature_method="PLAINTEXT",
                     oauth_timestamp="1786000000",
                     oauth_callback="https://fidelity.example.de/auth/callback"
```

Antwort ist **form-encoded, nicht JSON**: `oauth_token`, `oauth_token_secret`,
`oauth_callback_confirmed=true`.

**Wichtig:**
- Access Tokens **laufen nicht ab** – bis der Nutzer sie widerruft
- **Es gibt keine Scopes.** Ein Token gibt Voll-Schreibzugriff auf Sammlung, Wantlist,
  Inventar und Bestellungen. Read-only ist nicht anforderbar. → entsprechend behandeln
- **User-Agent ist Pflicht**: `Fidelity/0.1.0 +https://fidelity.example.de`.
  Ohne UA: leere Antwort oder 403 ohne brauchbare Meldung. Nie `curl` oder `Mozilla/…`
- Auth **immer als Header**, nie im Querystring (historischer Bug: 25/min statt 60/min)

---

## 1b. CORS - Zugriff direkt aus dem Browser

**Verifiziert am 2026-08-09.** Das ist die Grundlage der gesamten Architektur (ADR-007).

```
access-control-allow-origin:   *
access-control-allow-headers:  Content-Type, authorization, User-Agent,
                               Private-Auth-Secret, Discogs-UID
access-control-allow-methods:  HEAD, OPTIONS, GET        (Datenbank-/Marketplace-Endpunkte)
                               DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT  (User-Endpunkte)
access-control-expose-headers: Location
```

| Test | Ergebnis |
|---|---|
| `GET /releases/{id}` mit `Origin` | 200, `allow-origin: *` |
| Preflight mit `authorization` | 204, Header erlaubt |
| `/users/juno_records/inventory` mit **Safari-User-Agent** | **200**, 43.223 Listings |
| Preflight `POST /oauth/access_token` | **500**, nur `HEAD, OPTIONS` |

### Drei Konsequenzen

**1. Die Rate-Limit-Header sind fuer JavaScript unsichtbar.**
`access-control-expose-headers` listet nur `Location`. `x-discogs-ratelimit-remaining`
kommt zwar ueber die Leitung, aber `fetch()` gibt den Header nicht heraus. Ein adaptiver
Token-Bucket ist damit **nicht baubar**.
Konsequenz: blind und konservativ drosseln - **1 Request/1.200 ms** (= 50/min, 10 unter
dem Limit). Der **429-Status** ist lesbar, darauf reagieren wir mit exponentiellem Backoff.

**2. OAuth 1.0a ist unmoeglich.**
`POST /oauth/access_token` ist per CORS gesperrt. Deshalb: **Personal Access Token**,
vom Nutzer selbst unter `discogs.com/settings/developers` erzeugt.

**3. `fetch()` kann keinen User-Agent setzen.**
Der Browser sendet seinen eigenen. Die Doku sagt "avoid Mozilla" - der Live-Test zeigt
aber, dass Discogs Browser-User-Agents akzeptiert (200 auf dem Inventory-Endpunkt).
**Das ist die riskanteste Annahme des Projekts** und gehoert in M1 als allererstes
aus einem echten Browser gegengeprueft.

---

## 2. Rate Limits

```
X-Discogs-Ratelimit:            60
X-Discogs-Ratelimit-Used:        3
X-Discogs-Ratelimit-Remaining:  57
```

- **60/min authentifiziert, 25/min ohne**, gleitendes 60-Sekunden-Fenster
- **Pro Quell-IP.** Zusätzliche Tokens erhöhen den Durchsatz **nicht**
- Bei Überschreitung: **429**, Body `{"message":"You are making requests too quickly."}`
- ⚠️ **Kein `Retry-After`-Header** – verifiziert. Eigener Backoff nötig
- ⚠️ `-Used` verhält sich **nicht monoton** (0→1→2→0→3 in einem Burst beobachtet).
  Steuere über `-Remaining`, nie über `-Used`
- ⚠️ **Bilder auf `i.discogs.com` haben ein separates, undokumentiertes Cloudflare-Limit**
  (~30–40/min). 429er bei Bildern, obwohl das API-Budget noch bei 50 steht, sind normal.
  → Bilder ausschließlich clientseitig laden

**Praxiswert:** 1 Request pro **1,1–1,2 s**, single-threaded. Nebenläufigkeit > 1 ist
kontraproduktiv.

---

## 3. `GET /users/{username}/inventory` – der zentrale Endpunkt

### Parameter

| Parameter | Werte | Anmerkung |
|---|---|---|
| `status` | `For Sale`, `Draft`, `Expired`, `Sold`, `Violation`, `All` | ⚠️ **wird bei fremden Händlern still ignoriert** – clientseitig filtern |
| `sort` | `listed`, `price`, `item`, `artist`, `label`, `catno`, `audio`, `status` | ⚠️ dokumentiertes `location` wirft **422** |
| `sort_order` | `asc`, `desc` | |
| `per_page` | 1–100 (Default 50) | `250` wird auf 100 geklemmt |
| `page` | **1–100 bei fremden Händlern** | siehe unten |
| `curr_abbr` | `USD GBP EUR CAD AUD JPY CHF MXN BRL NZD SEK ZAR` | |

### ⚠️⚠️ Die harte Paginierungsgrenze

```
page=100 → 200 OK
page=101 → 403 {"message":"Pagination above 100 disabled for inventories besides your own"}
```

Die Grenze sitzt auf der **Seitenzahl**, nicht auf dem Offset – `page=101&per_page=10`
scheitert genauso. **Maximal 10.000 Listings pro fremdem Händler.**

`pagination.pages` ist **unzuverlässig**: meldet bei 43.234 Items `433`, obwohl ab Seite 101
403 kommt. (Bei `/database/search` wird korrekt auf 100 geklemmt – bei Inventory nicht.)

Besteht seit spätestens 2018. Discogs: *„this is not a limitation we can lift at this time."*

**Umgehungen:**
- `sort_order=asc` + `desc` → zwei disjunkte Fenster → **bis 20.000**
- Weitere `sort`-Keys (`price`, `artist`, `catno`, jeweils asc/desc) → weitere Stichproben,
  **ohne** Vollständigkeitsgarantie
- Keine Filter nach Preis/Zustand/Format verfügbar, um die Menge einzugrenzen
- Über 20.000: vollständige Abdeckung ist **unmöglich**. Nur der Händler selbst kann
  per `/inventory/export` vollständig exportieren

### Antwortstruktur (real, reicher als die Doku)

```jsonc
{
  "pagination": { "page": 1, "pages": 433, "per_page": 100, "items": 43234, "urls": {…} },
  "listings": [{
    "id": 4073868451,
    "uri": "https://www.discogs.com/sell/item/4073868451",
    "status": "For Sale",
    "condition": "Mint (M)",
    "sleeve_condition": "Mint (M)",
    "comments": "All items new, and sealed if originally sealed…",
    "ships_from": "United Kingdom",
    "posted": "2026-03-16T04:25:00-07:00",
    "allow_offers": false,
    "audio": false,
    "price": { "value": 10.99, "currency": "GBP" },
    "original_price": { "curr_abbr": "GBP", "formatted": "£10.99", "value": 10.99 },
    "shipping_price": {},                 // ⚠️ häufig LEER – siehe unten
    "shipping_is_blocked": true,
    "seller": {
      "id": 937252, "username": "Juno_Records",
      "stats": { "rating": "100.0", "stars": 5.0, "total": 58655 },
      "min_order_total": 0.0,
      "payment": "PayPal Commerce",
      "shipping": "See cart for shipping costs…"   // Freitext
    },
    "release": {
      "id": 40175,
      "title": "Deflect",
      "artist": "O.S.T.",                 // STRING, keine IDs
      "description": "O.S.T. - Deflect (CD, Album)",
      "format": "CD, Album",              // STRING, kein formats[]
      "label": "Emanate Records",         // STRING, nur das ERSTE Label
      "catalog_number": "EMA005 CD",
      "year": 2000,
      "thumbnail": "",
      "stats": { "community": { "in_wantlist": 15, "in_collection": 48 } }
    }
  }]
}
```

### Was im `release`-Objekt fehlt – und warum das wehtut

| Feld | vorhanden? | Konsequenz |
|---|---|---|
| `id` | ✅ | Exakter Wantlist-Match ist **gratis** |
| `artist` | ✅ als String | Fuzzy-Matching nötig, keine IDs |
| `label` | ✅ als String, **nur das erste** | Multi-Label-Releases werden unterschätzt |
| `catalog_number` | ✅ | Basis für `CATALOG_RUN` |
| **`master_id`** | ❌ | **Kritisch.** „Anderes Pressing" braucht die Katalog-DB |
| `genre` / `style` | ❌ | Stil-Matching braucht die Katalog-DB |
| `country` | ❌ | Pressing-Herkunft nur über Katalog-DB |

> ⚠️ **`shipping_price` ist oft `{}`.** Discogs berechnet Versand erst im Warenkorb.
> → Händler-Versandprofil als Nutzereingabe, siehe `00-KONZEPT.md` §7.

**Nutzlast:** Das komplette `seller`-Objekt wird **in jedem Listing wiederholt** – bei
`per_page=100` also 100 Kopien desselben ~800-Byte-Blobs. **250–400 KB pro Seite.**
Beim Parsen sofort dedupliziert wegwerfen.

---

## 4. Nutzerdaten

### `GET /users/{u}/collection/folders/{id}/releases`

**Keine 100-Seiten-Grenze.** Sortierung: `label`, `artist`, `title`, `catno`, `format`,
`rating`, `added`, `year`.

`basic_information` ist deutlich reicher als das Inventory-`release` – **mit IDs**:

```jsonc
"basic_information": {
  "id": 1096227,
  "master_id": 0, "master_url": null,      // 0/null = kein Master
  "title": "Search And Destroy", "year": 2003,
  "formats": [{ "name": "CDr", "qty": "1", "descriptions": ["Compilation"] }],
  "labels":  [{ "name": "…", "catno": "DBCDR003", "id": 96948 }],   // ← IDs!
  "artists": [{ "name": "Various", "anv": "", "id": 194 }],         // ← IDs!
  "genres": ["Electronic"],
  "styles": ["Drum n Bass"],
  "thumb": "…", "cover_image": "…"
}
```

**Fehlt:** `country`, `tracklist`, `notes`, `barcode`, `community`.

### `GET /users/{u}/wants`

⚠️ Der Pfad heißt **`/wants`**, nicht `/wantlist`. `basic_information` ist **strukturgleich**
zur Sammlung – ein Parser reicht für beides.

### Sichtbarkeit (verifiziert)

| Ressource | Fremd, öffentlich | Fremd, privat | Besitzer |
|---|---|---|---|
| Profil | meiste Felder | meiste Felder | + E-Mail, Zähler |
| Collection Folders | **nur Ordner 0** | 403 | alle |
| Collection Releases | ja | 403 | + private Notizen |
| Collection Value | 403 | 403 | ✅ (nur als **formatierter String**, z. B. `"$2,000.00"`) |
| Wantlist | ja | 403 | + Notizen |
| Inventar | nur „For Sale", ≤100 Seiten | – | alles, unbegrenzt |

> **Die meisten Sammlungen und fast alle Wantlists sind privat.** (Stichprobe: 7 von 8
> Wantlists privat.) → OAuth ist nicht optional, auch nicht für die eigenen Daten.

---

## 5. Weitere Endpunkte

| Endpunkt | Auth | Kosten | Nutzen für uns |
|---|---|---|---|
| `GET /users/{u}` | nein | 1 | `num_for_sale` als **Vorabprüfung der Inventargröße** |
| `GET /marketplace/stats/{release_id}` | **nein** | 1/Release | `num_for_sale`, `lowest_price` → Signale 10 + 11 |
| `GET /marketplace/price_suggestions/{id}` | ja **+ Verkäufer-Settings** | 1/Release | ❌ für eine Käufer-App unbrauchbar |
| `GET /masters/{id}/versions` | nein | 1/100 | **Beste Quelle für „alle Pressungen"**, undokumentierte Facetten-Filter `format`, `label`, `country`, `released` |
| `GET /artists/{id}/releases` | nein | 1/100 | keine Seitengrenze; Basis für `ARTIST_GAP` |
| `GET /labels/{id}/releases` | nein | 1/100 | keine Seitengrenze; Basis für `CATALOG_RUN` |
| `GET /releases/{id}` | nein | **1/Release, ~16 KB → ~3 h für 10.000** | ⛔ **niemals in der Scan-Schleife**; liefert `styles`, `extraartists`, `identifiers` (siehe unten) |
| `GET /database/search` | nein (Doku sagt ja) | 1/100, max 100 Seiten | Händlersuche, Disambiguierung via `barcode` |

### Was `/releases/{id}` für die Pressing-Beratung hergibt

Am 2026-08-09 an echten Releases verifiziert (Blue Note „Newk's Time", drei Pressungen):

| Feld | Form | Wofür |
|---|---|---|
| `identifiers[]` | `{ type, value, description? }` | `type` ist u. a. `Matrix / Runout`, `Pressing Plant ID`, `Rights Society`, `Barcode` |
| `formats[].descriptions[]` | `["LP","Album","Reissue","Remastered","Stereo"]` | **„Reissue" steht hier als Faktum** – das ist keine Heuristik |
| `formats[].text` | `"Plastylite Pressing"`, `"180g"` | Freitext des Einpflegers |
| `country` | `"US"`, `"Japan"`, `"Worldwide"` | „Worldwide" heißt in der Praxis moderne Neuauflage |
| `released` / `year` | `"1959"` / `1959` | Pressjahr, **nicht** Erscheinungsjahr des Albums |

Belegbeispiele aus denselben drei Pressungen:

```
1959 US    Mono                     BN-LP-4001-A [ear] M9 RVG   ← Original: RVG + Plastylite-Ohr
2015 US    Reissue, Remastered      MASTERED BY CAPITOL
2023 Worldwide  Reissue             (kein Stempel)
```

> ⚠️ **Kostet nichts extra.** Der Nachschlag über die Top 50 läuft für S7 und S10/S11
> ohnehin – die Pressing-Felder kommen in derselben Antwort mit. Ein eigener Durchgang
> dafür wäre 50 Requests für Daten, die schon da waren.

---

### ❌ Der Endpunkt, den es nicht gibt

**Es gibt keine Möglichkeit, per API die Angebote zu einer Release-ID zu listen.**
„Wer verkauft Release X?" ist nicht beantwortbar.

- `GET /marketplace/listings?release_id=…` → **405**
- `GET /marketplace/search?release_id=…` → **401**, undokumentiert, nicht supported

**Deshalb scrapen alle Wantlist-×-alle-Händler-Tools die Website** – und deshalb sterben sie
regelmäßig. Unser händlerzentrierter Ansatz läuft auf dem **dokumentierten, ToS-sauberen
Pfad**. Das ist ein echter struktureller Vorteil.

---

## 6. Data Dumps (CC0)

`https://data.discogs.com/` · S3 `discogs-data-dumps` (us-west-2) · monatlich zum 1./2.

```
https://data.discogs.com/?download=data%2F2026%2Fdiscogs_20260801_releases.xml.gz
```

| Datei | Größe |
|---|---:|
| `releases.xml.gz` | **10,4 GB** (~100–120 GB entpackt) |
| `masters.xml.gz` | 593 MB |
| `artists.xml.gz` | 472 MB |
| `labels.xml.gz` | 86 MB |
| `CHECKSUM.txt` | SHA-256 aller vier |

**Lizenz, wörtlich von data.discogs.com:**

> „This data is made available under the **CC0 No Rights Reserved** license."

Das ist der wichtigste praktische Fakt des ganzen Projekts:
**keine 6-Stunden-Regel, keine Attributionspflicht, keine Speicherbegrenzung, keine
Beschränkung kommerzieller Nutzung** – für Katalogdaten.

⚠️ **CC0 gilt nur für die Dumps.** Nicht für Live-API-Antworten und ausdrücklich **nicht für
Marketplace-Daten** (= „Restricted Data" laut ToS). Die beiden Lizenzwelten niemals vermischen.

---

## 7. Bekannte Bugs & Fallen

| Falle | Verhalten |
|---|---|
| Doku veraltet | Inventory-Beispiel von 2014, `sort=location` wirft 422, Search ist entgegen Doku ohne Auth nutzbar |
| **Zwei Fehlerformate** | Legacy `{"message": …}` vs. migriert `{"detail":[{…}],"message":…}` – Discogs migriert gerade Backends. **Beide parsen.** |
| `status`-Filter | Bei fremden Händlern still wirkungslos |
| `pagination.pages` | Bei Inventory falsch |
| Bilder | Auth-Doku falsch; separates Cloudflare-Limit; URLs sind **signiert** – man kann die Release-ID im Pfad nicht ersetzen |
| Search `[1, 1]` | Fehlermeldung nennt falsche Obergrenze |
| `lowest_price` in `/releases/{id}` | Bekannt fehlerhaft, laut Discogs-Mitarbeiter *„won't get fixed any time soon"* → `/marketplace/stats/{id}` verwenden |

### Was Discogs seit Jahren nicht liefert

Kein Listings-by-Release, keine Inventarfilter, keine Verkaufshistorie per API, kein
Median/Durchschnitt pro Release, **keine Webhooks**, **kein `updated_since`/Delta-Parameter**,
kein Bulk-Release-Lookup, keine OAuth-Scopes.

> **Konsequenz für die Watchlist:** Ohne Delta-Parameter ist ein Rescan immer ein
> Vollscan. Bei 10.000 Listings sind das 100 Requests. Watchlist-Frequenz entsprechend
> konservativ ansetzen (1×/Tag pro Händler, gestaffelt).

---

## Quellen

- [Discogs API Docs](https://www.discogs.com/developers/) · [Marketplace](https://www.discogs.com/developers/resources/marketplace/index.html) · [Collection](https://www.discogs.com/developers/resources/user/collection.html)
- [API Terms of Use](https://support.discogs.com/hc/en-us/articles/360009334593-API-Terms-of-Use)
- [data.discogs.com (CC0)](https://data.discogs.com/)
- Forum: [Paginierungsgrenze #778418](https://www.discogs.com/forum/thread/778418) · [Rate Limits #1104957](https://www.discogs.com/forum/thread/1104957) · [Bild-429er #1080144](https://www.discogs.com/forum/thread/1080144) · [Listings-by-Release #1017522](https://www.discogs.com/forum/thread/1017522) · [lowest_price-Bug #1153606](https://www.discogs.com/forum/thread/1153606)
