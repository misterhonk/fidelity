# 03 – Data model (IndexedDB)

> No database, no server, no schema migration tool.
> Everything lives in **IndexedDB** in the user's browser, addressed through `idb` (~2 kB).
> Budget: **under 10 MB**, see `12-RESSOURCEN-BUDGET.md`.

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

**Why no relational database in the browser?** There are no joins to make. Everything is a
key lookup or a set test. SQLite-in-WASM would cost 1 MB of bundle for functionality we do
not need.

---

## 2. `meta` – configuration & state

```ts
type MetaValue =
  | { key: 'token';        value: string }              // Personal Access Token
  | { key: 'identity';     value: { userId: number; username: string; avatarUrl: string } }
  | { key: 'preferences';  value: Preferences }
  | { key: 'tasteProfile'; value: TasteProfile }
  | { key: 'syncState';    value: SyncState }

interface Preferences {
  // SOFT — below this it is damped, not discarded
  prefMediaCondition:  Condition        // default 'Very Good Plus (VG+)'
  targetPrice:         number | null    // the comfortable price
  // HARD — outside this it is discarded, or the dig does not start at all
  maxPrice:            number | null    // an absolute budget
  minSellerRating:     number           // default 98.0
  formatsAllow:        string[]         // default ['Vinyl']
  shipsFromBlock:      string[]
  excludeReissues:     boolean
  // Barry Score fine-tuning per user
  currency:            string           // 'EUR'
  shipsToCountry:      string           // 'Germany'
}

interface SyncState {
  collectionSyncedAt: number | null
  wantlistSyncedAt:   number | null
  horizonBuiltAt:     number | null
  horizonProgress:    { done: number; total: number } | null
  // For the delta instead of a full sync: the last date_added seen
  lastCollectionAdd:  string | null
}
```

> ⚠️ **The token is the only genuinely sensitive value.** Never log it, never put it in an
> error report, never in a URL. "Sign out" deletes the whole database
> (`indexedDB.deleteDatabase`), not just the token.

---

## 3. `collection` & `wantlist`

Straight out of `basic_information` — deliberately kept lean.

```ts
interface CollectionItem {
  releaseId:   number      // key
  masterId:    number      // 0 = none
  title:       string
  artistIds:   number[]
  artistNorms: string[]    // pre-normalised — saves ~40 ms per dig
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

**Size:** 2,412 entries ≈ 1.4 MB.

> **Normalisation happens once, at sync time**, not on every dig. That is the difference
> between 40 ms and 40 ms × the number of digs.

### A delta instead of a full sync

Discogs has no `updated_since` parameter. But:

```
GET /users/{u}/collection/folders/0/releases?sort=added&sort_order=desc&per_page=100
→ stop as soon as date_added <= syncState.lastCollectionAdd
```

With no new records the daily sync costs **a single request**.

---

## 4. `horizon` – the slice of the catalogue

This is the storage-critical part. Hence `Int32Array`, not lists of objects.

```ts
interface HorizonChunk {
  key:        string          // `artist:40135` | `label:1234` | `master:2598`
  kind:       'artist' | 'label' | 'master'
  entityId:   number
  name:       string
  fetchedAt:  number
  complete:   boolean         // false for labels with > 1,500 releases
  requests:   number

  // ── The payload: packed, SORTED release ids ──
  // Sorted so that binary search is possible, and because sorted
  // Int32Arrays compress considerably better.
  releaseIds: Int32Array      // ~4 bytes per id instead of ~45 as an object

  // Parallel arrays instead of a list of objects — same length, same index
  roles:      Uint8Array      // index into ROLE_TABLE: 0=main, 1=Producer, …
  years:      Int16Array
  // Catalogue numbers only for labels — that is where CATALOG_RUN is needed
  catnoNums?: Int32Array
  catnoPrefix?: string        // constant per chunk, e.g. 'BRAIN'
}

const ROLE_TABLE = ['main','Producer','Engineer','Mixed By','Mastered By','Remix','Co-producer'] as const
```

**Size comparison for 200,000 release ids:**

| Representation | Size |
|---|---:|
| `{ releaseId, role, year }[]` as JSON | ~9 MB |
| Parallel typed arrays | **~1.4 MB** |

### The lookup index

At app start **one** flat lookup is built from all the chunks:

```ts
// Once at start, ~30 ms for 200,000 ids
const horizonIndex = new Map<number, HorizonHit[]>()
// Alternatively, for very large horizons: a sorted Int32Array + binary search,
// which saves RAM and costs ~O(log n) instead of O(1). Measure and switch at
// around 500,000 ids.
```

A dig then tests exactly `horizonIndex.get(releaseId)` per listing — O(1), zero API
requests.

---

## 5. `digs` & `matches` – where the six-hour rule lives

```ts
interface Dig {
  id:              string      // ULID, time-sortable
  dealer:          string
  status:          'queued' | 'scanning' | 'done' | 'failed' | 'cancelled' | 'expired'
  startedAt:       number
  finishedAt:      number | null
  // ⚠️ ToS: marketplace data may be displayed for at most 6 h
  expiresAt:       number      // startedAt + 6h
  listingsTotal:   number      // what the dealer has according to the API
  listingsScanned: number
  coverage:        number      // scanned / total — the honesty metric
  truncated:       boolean     // did we hit the 10k wall?
  matchCount:      number
  apiRequests:     number
  // For resuming after a closed tab / dropped connection
  cursor:          { page: number; order: 'asc' | 'desc' } | null
}

interface Match {
  digId:        string
  listingId:    number
  releaseId:    number
  // ── our derivations (these may stay) ──
  score:        number
  signals:      Signal[]       // [{ type, confidence, evidence }]
  // The Barry sentence sat here as `reason` until 2026-08-11. It is now built
  // when read, from the signals (`app/i18n/reason.ts`), rather than at scan
  // time — stored, it was frozen in whatever language the dig ran in, and a
  // language change would never have reached it.
  // ── marketplace data (nulled after 6 h) ──
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
  marketLowestPrice:  number | null    // from /marketplace/stats/ — NOT a median
  marketNumForSale:   number | null    // the API does not give this
  expired:      boolean
}
```

### The expiry job

Runs at app start and hourly thereafter, for as long as the app is open:

```ts
// Everything that is marketplace data gets nulled.
// Score, signals and reasoning stay — those are our own derivations.
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

**Only the last 5 digs are kept**, FIFO after that. An expired dig keeps its scores and
reasoning — so you can still see *that* there were 47 matches there, just not at what price.

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
  shippingNote:  string       // free text from seller.shipping
  lastScannedAt: number | null
  affinity:      number | null      // a factor against chance
  // derived, not marketplace data → no 6 h expiry
  fingerprint:   {
    sampledItems: number
    totalItems:   number
    coverage:     number
    labelDist:    Record<string, number>
    styleDist:    Record<string, number>
    decadeDist:   Record<string, number>
    medianPrice:  number
  } | null
  // Shipping tiers: user input or from shipping-profiles.json
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

> **Shipping tiers without a server:** a `shipping-profiles.json` lives in the repository
> and ships with the app. Anyone adding a tier makes a pull request. For a circle of
> friends that is entirely sufficient — and it costs nothing.

---

## 7. `feedback` – the only way to calibrate Barry

```ts
interface Feedback {
  listingId: number
  releaseId: number
  title:     string | null   // catalogue, not marketplace
  artist:    string | null
  dealer:    string | null   // where it was
  soldAt:    number | null   // when a check found it gone
  verdict:   'interesting' | 'meh' | 'wrong' | 'bought'
  signals:   Signal[]     // a snapshot at the time of the verdict
  score:     number
  createdAt: number
}
```

Stays local. For analysis you export it as JSON and look at it offline — from around 200
verdicts it becomes worth asking which signals correlate with "interesting".

**Where the line runs.** What the six-hour rule deletes is the *offer*: price, condition,
sleeve condition, the dealer's note. None of that is here and none of it ever will be.

Who made the record, what it is called and which shop had it is not the offer. It is what
keeps a shortlist readable a year later — digs are cleared away after five, and two bare
integers are not a shortlist. The basket has held the title for the same reason since M4.

`soldAt` is a fact about the past, not a number off the marketplace — and it stops the same
request being spent twice: a listing id does not come back onto the market, and a
re-listing gets a new one.

**The screen for it** is `/saved`: grouped by shop (postage is per shipment, so four records
at one shop is a different proposition from four at four), fullest shop first. Fresh prices
come from "still there?" via `GET /marketplace/listings/{id}` — they appear in the result
and **never** land on disk.

---

## 8. Migrations

```ts
// db/open.ts
openDB<FidelityDB>(DB_NAME, DB_VERSION, {
  upgrade(db, oldVersion) {
    if (oldVersion < 1) { /* create every store */ }
    // Future versions go here. The rule: NEVER migrate destructively unless
    // the state can be restored from the API.
  },
  blocked()  { /* another tab holds the old version — tell the user */ },
  blocking() { /* this version is blocking an upgrade — close the connection */ },
})
```

**The emergency exit:** all data is reproducible from the API. In case of doubt, "delete the
database and re-sync" is a perfectly acceptable migration — it costs the user 13 minutes and
no data.

That is the quiet luxury of an app with no server.
