# 03 – Datenmodell (IndexedDB)

> Keine Datenbank, kein Server, kein Schema-Migrationswerkzeug.
> Alles liegt in **IndexedDB** im Browser des Nutzers, angesprochen über `idb` (~2 KB).
> Budget: **unter 10 MB**, siehe `12-RESSOURCEN-BUDGET.md`.

---

## 1. Stores

```ts
// db/schema.ts
import type { DBSchema } from 'idb'

export const DB_NAME = 'fidelity'
export const DB_VERSION = 1

export interface FidelityDB extends DBSchema {
  meta:        { key: string; value: MetaValue }
  collection:  { key: number; value: CollectionItem;
                 indexes: { 'by-master': number } }
  wantlist:    { key: number; value: WantlistItem;
                 indexes: { 'by-master': number } }
  horizon:     { key: string; value: HorizonChunk }      // key = `${kind}:${entityId}`
  dealers:     { key: string; value: Dealer }            // key = username
  digs:        { key: string; value: Dig }               // key = ulid
  matches:     { key: [string, number]; value: Match;    // [digId, listingId]
                 indexes: { 'by-dig-score': [string, number] } }
  basket:      { key: number; value: BasketItem }        // key = listingId
  feedback:    { key: number; value: Feedback }          // key = listingId
}
```

**Warum keine relationale DB im Browser?** Es gibt keine Joins zu machen. Alles ist ein
Key-Lookup oder ein Set-Test. SQLite-in-WASM würde 1 MB Bundle kosten für Funktionalität,
die wir nicht brauchen.

---

## 2. `meta` – Konfiguration & Zustand

```ts
type MetaValue =
  | { key: 'token';        value: string }              // Personal Access Token
  | { key: 'identity';     value: { userId: number; username: string; avatarUrl: string } }
  | { key: 'preferences';  value: Preferences }
  | { key: 'tasteProfile'; value: TasteProfile }
  | { key: 'syncState';    value: SyncState }

interface Preferences {
  // WEICH — darunter wird gedämpft, nicht verworfen
  prefMediaCondition:  Condition        // Default 'Very Good Plus (VG+)'
  prefSleeveCondition: Condition
  targetPrice:         number | null    // Wohlfühlpreis
  // HART — darüber/darunter wird verworfen bzw. der Dig gar nicht gestartet
  maxPrice:            number | null    // absolutes Budget
  minSellerRating:     number           // Default 98.0
  formatsAllow:        string[]         // Default ['Vinyl']
  shipsFromBlock:      string[]
  excludeReissues:     boolean
  // Barry-Score-Feinjustierung pro Nutzer
  signalWeights:       Partial<Record<SignalType, number>>
  currency:            string           // 'EUR'
  shipsToCountry:      string           // 'Germany'
}

interface SyncState {
  collectionSyncedAt: number | null
  wantlistSyncedAt:   number | null
  horizonBuiltAt:     number | null
  horizonProgress:    { done: number; total: number } | null
  // Für das Delta statt Vollsync: das zuletzt gesehene date_added
  lastCollectionAdd:  string | null
}
```

> ⚠️ **Der Token ist der einzige wirklich sensible Wert.** Nie loggen, nie in einen
> Fehler-Report, nie in die URL. „Abmelden" löscht die gesamte Datenbank
> (`indexedDB.deleteDatabase`), nicht nur den Token.

---

## 3. `collection` & `wantlist`

Direkt aus `basic_information` – bewusst schlank gehalten.

```ts
interface CollectionItem {
  releaseId:   number      // key
  masterId:    number      // 0 = keiner
  title:       string
  artistIds:   number[]
  artistNorms: string[]    // vornormalisiert — spart pro Dig ~40 ms
  labelIds:    number[]
  labelNorms:  string[]
  catnos:      string[]
  genres:      string[]
  styles:      string[]
  formats:     string[]
  year:        number
  rating:      number
  addedAt:     string
}

type WantlistItem = Omit<CollectionItem, 'rating'>
```

**Größe:** 2.412 Einträge ≈ 1,4 MB.

> **Die Normalisierung passiert einmal beim Sync**, nicht bei jedem Dig. Das ist der
> Unterschied zwischen 40 ms und 40 ms × Anzahl Digs.

### Delta statt Vollsync

Discogs hat keinen `updated_since`-Parameter. Aber:

```
GET /users/{u}/collection/folders/0/releases?sort=added&sort_order=desc&per_page=100
→ abbrechen, sobald date_added <= syncState.lastCollectionAdd
```

Ohne neue Platten kostet der tägliche Sync **einen einzigen Request**.

---

## 4. `horizon` – der Katalogausschnitt

Das ist der Speicher-kritische Teil. Deshalb `Int32Array`, nicht Objektlisten.

```ts
interface HorizonChunk {
  key:        string          // `artist:40135` | `label:1234` | `master:2598`
  kind:       'artist' | 'label' | 'master'
  entityId:   number
  name:       string
  fetchedAt:  number
  complete:   boolean         // false bei Labels > 1.500 Releases
  requests:   number

  // ── Die Nutzlast: gepackte, SORTIERTE Release-IDs ──
  // Sortiert, damit binäre Suche möglich ist, und weil sich sortierte
  // Int32Arrays deutlich besser komprimieren lassen.
  releaseIds: Int32Array      // ~4 Byte pro ID statt ~45 Byte als Objekt

  // Parallel-Arrays statt Objektliste — gleiche Länge, gleicher Index
  roles:      Uint8Array      // Index in ROLE_TABLE: 0=main, 1=Producer, …
  years:      Int16Array
  // Katalognummern nur für Labels — dort wird CATALOG_RUN gebraucht
  catnoNums?: Int32Array
  catnoPrefix?: string        // pro Chunk konstant, z.B. 'BRAIN'
}

const ROLE_TABLE = ['main','Producer','Engineer','Mixed By','Mastered By','Remix','Co-producer'] as const
```

**Größenvergleich für 200.000 Release-IDs:**

| Repräsentation | Größe |
|---|---:|
| `{ releaseId, role, year }[]` als JSON | ~9 MB |
| Parallele TypedArrays | **~1,4 MB** |

### Der Lookup-Index

Beim App-Start wird aus allen Chunks **ein** flaches Lookup gebaut:

```ts
// Einmal beim Start, ~30 ms für 200.000 IDs
const horizonIndex = new Map<number, HorizonHit[]>()
// Alternativ bei sehr großen Horizonten: sortiertes Int32Array + binäre Suche,
// spart RAM, kostet ~O(log n) statt O(1). Ab ~500.000 IDs messen und umstellen.
```

Ein Dig testet dann pro Listing genau `horizonIndex.get(releaseId)` – O(1),
null API-Requests.

---

## 5. `digs` & `matches` – hier lebt die 6-Stunden-Regel

```ts
interface Dig {
  id:              string      // ULID, zeitsortiert
  dealer:          string
  status:          'queued' | 'scanning' | 'done' | 'failed' | 'cancelled' | 'expired'
  startedAt:       number
  finishedAt:      number | null
  // ⚠️ ToS: Marktplatzdaten dürfen max. 6 h alt angezeigt werden
  expiresAt:       number      // startedAt + 6h
  listingsTotal:   number      // was der Händler laut API hat
  listingsScanned: number
  coverage:        number      // scanned / total — Ehrlichkeitsmetrik
  truncated:       boolean     // 10k-Wand getroffen?
  matchCount:      number
  apiRequests:     number
  // Für Resume nach Tab-Schließen / Netzabbruch
  cursor:          { page: number; order: 'asc' | 'desc' } | null
}

interface Match {
  digId:        string
  listingId:    number
  releaseId:    number
  // ── unsere Ableitungen (dürfen bleiben) ──
  score:        number
  signals:      Signal[]       // [{ type, confidence, evidence }]
  reason:       string         // der Barry-Satz
  // ── Marktplatzdaten (werden nach 6 h genullt) ──
  title:        string | null
  artist:       string | null
  label:        string | null
  catno:        string | null
  format:       string | null
  year:         number | null
  condition:    string | null
  sleeve:       string | null
  price:        number | null
  currency:     string | null
  comments:     string | null
  thumbUrl:     string | null
  marketLowestPrice:  number | null    // aus /marketplace/stats/ — KEIN Median
  marketNumForSale:   number | null    // den gibt die API nicht her
  expired:      boolean
}
```

### Der Verfalls-Job

Läuft beim App-Start und danach stündlich, solange die App offen ist:

```ts
// Alles, was Marktplatzdaten sind, wird genullt.
// Score, Signale und Begründung bleiben — das sind unsere eigenen Ableitungen.
async function expireDigs(db: IDBPDatabase<FidelityDB>) {
  const now = Date.now()
  for (const dig of await db.getAll('digs')) {
    if (dig.status !== 'done' || dig.expiresAt > now) continue
    const tx = db.transaction(['digs', 'matches'], 'readwrite')
    for (const m of await tx.objectStore('matches')
                            .index('by-dig-score')
                            .getAll(IDBKeyRange.bound([dig.id, 0], [dig.id, 100]))) {
      if (m.expired) continue
      Object.assign(m, {
        title: null, artist: null, label: null, catno: null, format: null, year: null,
        condition: null, sleeve: null, price: null, currency: null, comments: null,
        thumbUrl: null, marketLowestPrice: null, marketNumForSale: null, expired: true,
      })
      await tx.objectStore('matches').put(m)
    }
    dig.status = 'expired'
    await tx.objectStore('digs').put(dig)
    await tx.done
  }
}
```

**Nur die letzten 5 Digs werden behalten**, danach FIFO. Ein abgelaufener Dig behält seine
Scores und Begründungen – man sieht also weiterhin, *dass* dort 47 Treffer waren, nur
nicht mehr zu welchem Preis.

---

## 6. `dealers` & `basket`

```ts
interface Dealer {
  username:      string       // key
  displayName:   string
  shipsFrom:     string
  sellerRating:  number
  ratingCount:   number
  numForSale:    number
  minOrderTotal: number
  shippingNote:  string       // Freitext aus seller.shipping
  lastScannedAt: number | null
  affinity:      number | null      // Faktor gegenüber Zufall
  // abgeleitet, keine Marktplatzdaten → kein 6-h-Verfall
  fingerprint:   {
    sampledItems: number
    totalItems:   number
    coverage:     number
    labelDist:    Record<string, number>
    styleDist:    Record<string, number>
    decadeDist:   Record<string, number>
    medianPrice:  number
  } | null
  // Versandstaffel: Nutzereingabe oder aus shipping-profiles.json
  shippingTiers: { minItems: number; maxItems: number | null;
                   price: number; currency: string;
                   source: 'user' | 'bundled' | 'parsed' }[]
}

interface BasketItem {
  listingId: number
  dealer:    string
  releaseId: number
  title:     string
  price:     number
  currency:  string
  addedAt:   number
  note:      string | null
}
```

> **Versandstaffeln ohne Server:** Eine `shipping-profiles.json` liegt im Repo und wird
> mit der App ausgeliefert. Wer eine Staffel ergänzt, macht einen Pull Request. Für einen
> Freundeskreis ist das völlig ausreichend – und kostet nichts.

---

## 7. `feedback` – die einzige Möglichkeit, Barry zu kalibrieren

```ts
interface Feedback {
  listingId: number
  releaseId: number
  title:     string | null   // Katalog, kein Marktplatz
  artist:    string | null
  dealer:    string | null   // wo sie stand
  soldAt:    number | null   // wann eine Prüfung sie als weg vorfand
  verdict:   'interesting' | 'meh' | 'wrong' | 'bought'
  signals:   Signal[]     // Snapshot zum Zeitpunkt des Urteils
  score:     number
  createdAt: number
}
```

Bleibt lokal. Für die Auswertung exportiert man es als JSON und wertet es offline aus –
ab ~200 Urteilen lohnt sich der Blick, welche Signale mit „interessant" korrelieren.

**Wo die Grenze läuft.** Was die Sechs-Stunden-Regel löscht, ist das *Angebot*: Preis,
Zustand, Hüllenzustand, Händlernotiz. Nichts davon steht hier und wird nie hier stehen.

Wer die Platte gemacht hat, wie sie heißt und welcher Laden sie hatte, ist nicht das
Angebot. Das ist, was eine Merkliste ein Jahr später noch lesbar macht – Digs werden nach
fünf weggeräumt, und zwei nackte Ganzzahlen sind keine Merkliste. Der Korb hält den Titel
aus demselben Grund seit M4.

`soldAt` ist eine Tatsache über die Vergangenheit, keine Zahl vom Marktplatz – und sie
verhindert, dass derselbe Request zweimal ausgegeben wird: eine Listing-ID kommt nicht
zurück auf den Markt, eine Neueinstellung bekommt eine neue.

**Der Screen dazu** ist `/gemerkt`: gruppiert nach Laden (Porto ist pro Sendung, also ist
vier Platten bei einem Laden etwas anderes als vier bei vieren), voller Laden zuerst.
Frische Preise holt „Noch da?" über `GET /marketplace/listings/{id}` – sie stehen im
Ergebnis und landen **nie** auf der Platte.

---

## 8. Migrationen

```ts
// db/open.ts
openDB<FidelityDB>(DB_NAME, DB_VERSION, {
  upgrade(db, oldVersion) {
    if (oldVersion < 1) { /* alle Stores anlegen */ }
    // Künftige Versionen hier ergänzen. Regel: NIEMALS destruktiv migrieren,
    // ohne dass sich der Zustand aus der API wiederherstellen lässt.
  },
  blocked()  { /* anderer Tab hält die alte Version — Nutzer informieren */ },
  blocking() { /* diese Version blockiert ein Upgrade — Verbindung schließen */ },
})
```

**Der Notausgang:** Alle Daten sind aus der API reproduzierbar. Im Zweifelsfall ist
„Datenbank löschen und neu synchronisieren" eine völlig akzeptable Migration – sie kostet
den Nutzer 13 Minuten, keine Daten.

Das ist der stille Luxus einer App ohne Server.
