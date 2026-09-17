# 02 – Discogs API reference (as it concerns this project)

> Researched and **verified live against the production API on 2026-08-09**.
> The official documentation is demonstrably out of date in several places — differences
> are marked below. Base URL: `https://api.discogs.com`

---

## 1. Authentication

| Level | Identifies a user? | Limit | For us |
|---|---|---|---|
| None | no | 25/min | no |
| Key + secret | **no** | 60/min | no (does not read private collections) |
| **Personal Access Token** | only its owner | 60/min | ✅ **our route** – every user reads their own data |
| **OAuth 1.0a** | any consenting user | 60/min | ❌ blocked by CORS, see 1b |

### OAuth 1.0a with PLAINTEXT

Discogs **explicitly recommends PLAINTEXT over HTTPS rather than HMAC-SHA1**. That makes
the signature literal:

```
Step 1 (request_token):  oauth_signature = "{consumer_secret}&"
Step 3 (access_token):   oauth_signature = "{consumer_secret}&{request_token_secret}"
```

No base-string construction, no parameter sorting, no percent-encoding traps. That is by
far the most common source of errors in every forum thread — and avoidable here.

```http
Authorization: OAuth oauth_consumer_key="KEY",
                     oauth_nonce="RANDOM",
                     oauth_signature="SECRET&",
                     oauth_signature_method="PLAINTEXT",
                     oauth_timestamp="1786000000",
                     oauth_callback="https://fidelity.example.de/auth/callback"
```

The response is **form-encoded, not JSON**: `oauth_token`, `oauth_token_secret`,
`oauth_callback_confirmed=true`.

**Important:**
- Access tokens **do not expire** — until the user revokes them
- **There are no scopes.** A token gives full write access to collection, wantlist,
  inventory and orders. Read-only cannot be requested. → treat it accordingly
- **A user agent is mandatory**: `Fidelity/0.1.0 +https://fidelity.example.de`.
  Without one: an empty response or a 403 with no usable message. Never `curl` or
  `Mozilla/…`
- Auth **always as a header**, never in the query string (a historical bug: 25/min instead
  of 60/min)

---

## 1b. CORS – access straight from the browser

**Verified on 2026-08-09.** This is the foundation of the entire architecture (ADR-007).

```
access-control-allow-origin:   *
access-control-allow-headers:  Content-Type, authorization, User-Agent,
                               Private-Auth-Secret, Discogs-UID
access-control-allow-methods:  HEAD, OPTIONS, GET        (database/marketplace endpoints)
                               DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT  (user endpoints)
access-control-expose-headers: Location
```

| Test | Result |
|---|---|
| `GET /releases/{id}` with `Origin` | 200, `allow-origin: *` |
| Preflight with `authorization` | 204, header allowed |
| `/users/juno_records/inventory` with a **Safari user agent** | **200**, 43,223 listings |
| Preflight `POST /oauth/access_token` | **500**, only `HEAD, OPTIONS` |

### Three consequences

**1. The rate-limit headers are invisible to JavaScript.**
`access-control-expose-headers` lists only `Location`. `x-discogs-ratelimit-remaining` does
come over the wire, but `fetch()` will not hand the header out. An adaptive token bucket is
therefore **not buildable**.
Consequence: throttle blind and conservatively — **1 request/1,200 ms** (= 50/min, 10 under
the limit).

⚠️ **And the 429 status is invisible too.** Measured on 2026-08-10: the 200 carries
`access-control-allow-origin: *`, the **429 does not** — it comes from Cloudflare
(`server: cloudflare`, `cf-ray`), and there the header is missing. In the browser that is
not a `Response` but a rejected `fetch()`. **JavaScript never sees a 429 status**, only the
same `TypeError: Failed to fetch` as with an unplugged cable.

That makes every `if (response.status === 429)` dead code in the browser. What remains: an
opaque class of failure, two short retries for genuine blips, and after that — if the
browser says it is online — the long rate-limit backoff. See `worker/discogs/client.ts`.

**2. OAuth 1.0a is impossible.**
`POST /oauth/access_token` is blocked by CORS. Hence: a **Personal Access Token**, created
by the user themselves at `discogs.com/settings/developers`.

**3. `fetch()` cannot set a user agent.**
The browser sends its own. The docs say "avoid Mozilla" — but the live test shows Discogs
accepts browser user agents (200 on the inventory endpoint). This was noted as the project's
riskiest assumption; it was checked from a real browser in M1 and has been confirmed daily
in operation since.

**But with no user agent at all you get a 403.** Measured against `/users/{name}` on
2026-08-13:

| Identification | Response |
|---|---|
| none at all (`-H 'User-Agent:'`) | **403** |
| `node` (Node's own default) | 200 |
| `FidelityHub/1.0 +https://github.com/…` | 200 |

In the browser this is a non-issue — it always sends one. **For the hub it is not**, since
that runs under Node and talks to the same API. So it sets one of its own (impossible on the
`worker` side, one line server-side): `node` gets through today and is exactly the kind of
meaningless identification a provider eventually blocks. The failure would be the quietest
imaginable — a response without `ok` is swallowed in the watcher, and every shop would look
unchanged forever.

**And the identification of a registered application lifts the limit.** A consumer key and
secret as `Authorization: Discogs key=…, secret=…` turn 25 requests a minute into 60 —
without signing in as a person. As a header, not as a query parameter: a secret in a URL
ends up in every log along the way. Built into the hub and optional; without it the watcher
paces at 2,400 ms instead of 1,200 ms.

---

## 2. Rate limits

```
X-Discogs-Ratelimit:            60
X-Discogs-Ratelimit-Used:        3
X-Discogs-Ratelimit-Remaining:  57
```

- **60/min authenticated, 25/min without**, in a sliding 60-second window
- **Per source IP.** Additional tokens do **not** raise throughput
- ⚠️ **A tab is not an IP.** Two open tabs are two workers with their own pacers, each
  keeping perfectly to 1,200 ms and together sending 100/min. So the slot is claimed under a
  **web lock** (`fidelity:discogs`) against a timestamp in IndexedDB
  (`meta.lastRequestAt`) — one gap for the whole browser, not one per tab. See
  `worker/discogs/pacer.ts`
- On exceeding it: **429**, body `{"message":"You are making requests too quickly."}`
- ⚠️ **No `Retry-After` header** — verified. A backoff of our own is needed
- ⚠️ `-Used` does **not** behave monotonically (0→1→2→0→3 observed within one burst).
  Steer by `-Remaining`, never by `-Used`
- ⚠️ **Images on `i.discogs.com` have a separate, undocumented Cloudflare limit**
  (~30–40/min). 429s on images while the API budget still says 50 are normal.
  → load images client-side only

- ⚠️ **The images are not readable, only displayable.** Checked at the server on
  2026-09-11: `i.discogs.com` sends **no CORS header** — neither on a GET nor on a
  preflight. In the browser that means: without `crossOrigin` the image loads and taints the
  canvas (`getImageData` throws a `SecurityError`), with `crossOrigin="anonymous"` it does
  not load at all, and `fetch` fails. **Every idea that wants to analyse cover pixels —
  similarity, a perceptual hash, colour analysis — is finished** before it starts.

- ⚠️ **600 on the long edge is the ceiling — and often it is less.**
  Measured on 2026-08-14: `images[0]` from `/releases/{id}` is the same version as
  `cover_image` from `basic_information`. There is no larger image through the documented
  API.

  **600 × 600 is the best case, not the rule.** The CDN fits into a 600 square without
  inflating: release 512 comes out as **313 × 238**, because the source is no bigger. Writing
  a blanket `600w` in a `srcset` makes a promise about actual width the image does not keep —
  and the browser's selection maths then works with a number that does not exist.

  The address carries the dimensions in the path (`…/rs:fit/g:sm/q:90/h:600/w:600/…`) and
  **looks** rewritable. It is not: changed to `h:1200/w:1200` the CDN answers **403** — the
  path is signed. Anyone planning "sharper covers" is planning something that does not
  exist; anyone showing them larger is upscaling.

**Practical figure:** 1 request per **1.1–1.2 s**, single-threaded. Concurrency > 1 is
counterproductive.

---

## 3. `GET /users/{username}/inventory` – the central endpoint

### Parameters

| Parameter | Values | Note |
|---|---|---|
| `status` | `For Sale`, `Draft`, `Expired`, `Sold`, `Violation`, `All` | ⚠️ **silently ignored for foreign dealers** — filter client-side |
| `sort` | `listed`, `price`, `item`, `artist`, `label`, `catno`, `audio`, `status` | ⚠️ the documented `location` throws **422** |
| `sort_order` | `asc`, `desc` | |
| `per_page` | 1–100 (default 50) | `250` is clamped to 100 |
| `page` | **1–100 for foreign dealers** | see below |
| `curr_abbr` | `USD GBP EUR CAD AUD JPY CHF MXN BRL NZD SEK ZAR` | |

### ⚠️⚠️ The hard pagination wall

```
page=100 → 200 OK
page=101 → 403 {"message":"Pagination above 100 disabled for inventories besides your own"}
```

The limit sits on the **page number**, not on the offset — `page=101&per_page=10` fails just
the same. **At most 10,000 listings per foreign dealer.**

`pagination.pages` is **unreliable**: it reports `433` for 43,234 items even though page 101
returns a 403. (For `/database/search` it is correctly clamped to 100 — for inventory it is
not.)

Has been the case since 2018 at the latest. Discogs: *"this is not a limitation we can lift
at this time."*

**Ways round it:**
- `sort_order=asc` + `desc` → two disjoint windows → **up to 20,000**
- Further `sort` keys (`price`, `artist`, `catno`, each asc/desc) → further samples,
  **without** a completeness guarantee
- No filters by price/condition/format are available to narrow the set
- Above 20,000: complete coverage is **impossible**. Only the dealer themselves can export
  in full via `/inventory/export`

#### What the sort keys actually give you

Measured against `juno_records` (42,873 offers) on 2026-08-10. Seven keys give seven
different first pages, and therefore seven different windows:

| `sort` | first item asc | | `sort` | first item asc |
|---|---|---|---|---|
| `listed` | 4073868451 | | `label` | 4074033010 |
| `price` | 4073875114 | | `catno` | 4249307469 |
| `item` | 4073919160 | | `audio` | 4115872920 |
| `artist` | 4074134563 | | `status` | (ignored for foreign dealers) |

Each key × `asc`/`desc` = 20,000 out of 42,873, so 46.6 %. The rest is combinatorics: if the
orderings were independent, a share of 0.534^k would remain after *k* keys.

| Keys | Requests | Time at 1.2 s | unseen (idealised) |
|---|---|---|---|
| 1 | 200 | 4 min | 53 % |
| 3 | 600 | 12 min | 15 % |
| 5 | 1,000 | 20 min | 4.3 % |
| 7 | 1,400 | 28 min | 1.2 % |

**The numbers are an upper bound, not a promise.** `artist`, `label` and `catno` correlate
strongly — the same records stand next to each other in all three. Genuinely independent are
only `price`, `listed` and `audio`. So realistically "very high" rather than "98.8 %".

**But coverage is exactly measurable.** Listing ids are unique, and `pagination.items` gives
the total. Collect the ids you have seen in a set and after every pass you know precisely
where you stand:

```
|listing ids seen| / pagination.items   →   "38,412 of 42,873 (89.6 %)"
```

That is the difference between estimating and knowing. What cannot be guaranteed is ever
**arriving** at 100 % — an offer that sits in the middle of every ordering appears in no
window. So the stopping criterion is not "finished" but "a pass brought nothing new", and
what is shown is always the number, never a tick.

**Authentication changes nothing here.** The 403 message says "besides your own" — it is
about ownership, not permissions. Measured **unauthenticated** on 2026-08-10: the same wall
at `page=101` as with a token. A registered consumer key buys nothing for pagination; it
unlocks OAuth, and OAuth is blocked by CORS anyway (see above). The only route that could
change anything is asking Discogs — and the answer to that is above already.

#### The route that really does lead to completeness: time

`sort=listed&sort_order=desc` returns the **newest 10,000**. Scan a shop regularly and you
collect, without gaps, everything added since the first scan — 100 requests per pass, two
minutes. After a few months the local record for that dealer is more complete than any single
scan could ever be, and the back catalogue fills in alongside through the deep scans.

That is why the watchlist (M6) and the local store are not a convenience but the actual
answer to the 10,000 wall.

#### No shopping cart in the API

Measured on 2026-08-10. An endpoint that exists and merely needs auth answers **401**; one
that does not exist, **404**:

```
GET /marketplace/orders    → 401  You must authenticate to access this resource.
GET /marketplace/cart      → 404  The requested resource was not found.
                                  (The cart page, copied and pasted, is read by label instead — worker/basket/parse-cart.ts.)
GET /users/{user}/cart     → 404  The requested resource was not found.
```

**The Discogs cart is not part of the API** — neither to read nor to fill. The marketplace
endpoints cover inventory, individual listings, orders (the seller side), fees and price
suggestions, and that is where it stops. What remains is the direct link to
`discogs.com/sell/item/{listing_id}`; that is where the "Add to Cart" button lives.

For Fidelity that means: the basket works out combined postage **beforehand** — precisely
the gap Discogs leaves open, because it only shows combined postage in its own cart. The
adding happens there, line by line.

#### What does **not** work

- **Turning `per_page` up.** 250 and 500 are both clamped to 100, measured.
- **Smaller pages.** `page=110&per_page=50` is offset 5,450 and still a 403 — the limit is
  the page number, not the position.
- **Scraping.** `discogs.com/sell/…` gives everything, but it is CLAUDE.md rule 5.
- **`/marketplace/search`.** Undocumented, rule 5 as well.
- **Undocumented filter parameters.** If any exist: a second exception needs a second ADR,
  the way ADR-009 did for the friends list.
- **Exporting foreign inventories.** `/inventory/export` applies to your own only. A dealer
  can hand over their CSV, though — for a regular shop the only method with a real
  completeness guarantee.

### The response structure (real, richer than the docs)

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
    "shipping_price": {},                 // ⚠️ often EMPTY – see below
    "shipping_is_blocked": true,
    "seller": {
      "id": 937252, "username": "Juno_Records",
      "stats": { "rating": "100.0", "stars": 5.0, "total": 58655 },
      "min_order_total": 0.0,
      "payment": "PayPal Commerce",
      "shipping": "See cart for shipping costs…"   // free text
    },
    "release": {
      "id": 40175,
      "title": "Deflect",
      "artist": "O.S.T.",                 // A STRING, no ids
      "description": "O.S.T. - Deflect (CD, Album)",
      "format": "CD, Album",              // A STRING, no formats[]
      "label": "Emanate Records",         // A STRING, the FIRST label only
      "catalog_number": "EMA005 CD",
      "year": 2000,
      "thumbnail": "",                    // ALWAYS empty, see below
      "stats": { "community": { "in_wantlist": 15, "in_collection": 48 } }
    }
  }]
}
```

### `thumbnail` is always empty — measured, not assumed

**1,200 of 1,200 inventory rows** across four shops (schoenwettermusik, 430AM_Studio,
spirax.records, fatplastics), measured on 2026-08-10, unauthenticated: `release.thumbnail`
is an empty string and `images` an empty array. The same releases fetched through
`GET /releases/{id}` had between 1 and 29 images.

Whether a token changes this is **unverified** — checking would mean the token leaving the
device (rule 6), so it stands here as an open question, not as a claim.

**Consequence:** `Match.thumbUrl` is `null` for every match this app has ever produced.
Covers therefore come from a store of their own (`db/covers.ts`):

- **free** from the collection and wantlist — `basic_information` carries `thumb` and
  `cover_image`, so a synced shelf supplies a few thousand covers without a single extra
  request;
- **one request each** to `/releases/{id}` for everything else, and only for tiles that
  actually scroll into view, capped at 120 per visit;
- **shared**, when a hub is configured (`13-HUB-ADDON.md`) — a cover is the same for
  everybody and never changes.

Even nothing is stored: "Discogs has no image for this release" is worth as much as an image
and costs the same request to find out.

### What is missing from the `release` object — and why it hurts

| Field | Present? | Consequence |
|---|---|---|
| `id` | ✅ | An exact wantlist match is **free** |
| `artist` | ✅ as a string | Fuzzy matching needed, no ids |
| `label` | ✅ as a string, **the first only** | Multi-label releases are underrated |
| `catalog_number` | ✅ | The basis for `CATALOG_RUN` |
| **`master_id`** | ❌ | **Critical.** "Different pressing" needs the catalogue DB |
| `genre` / `style` | ❌ | Style matching needs the catalogue DB |
| `country` | ❌ | Pressing origin only via the catalogue DB |

> ⚠️ **`shipping_price` is `{}` in the inventory** — for every row, with or without a
> token (six shops, 2026-09-16). Discogs computes postage for *one* listing to *your*
> address, and only on `GET /marketplace/listings/{id}` **with a token** — see §5. For a
> shop's whole table there is still only the seller's text and the profile (`00-CONCEPT.md` §7).

**Payload:** the complete `seller` object is **repeated in every listing** — so at
`per_page=100` that is 100 copies of the same ~800-byte blob. **250–400 kB per page.**
Deduplicate and discard immediately when parsing.

---

## 4. User data

### `GET /users/{u}/collection/folders/{id}/releases`

**No 100-page limit.** Sorting: `label`, `artist`, `title`, `catno`, `format`, `rating`,
`added`, `year`.

`basic_information` is considerably richer than the inventory `release` — **with ids**:

```jsonc
"basic_information": {
  "id": 1096227,
  "master_id": 0, "master_url": null,      // 0/null = no master
  "title": "Search And Destroy", "year": 2003,
  "formats": [{ "name": "CDr", "qty": "1", "descriptions": ["Compilation"] }],
  "labels":  [{ "name": "…", "catno": "DBCDR003", "id": 96948 }],   // ← ids!
  "artists": [{ "name": "Various", "anv": "", "id": 194 }],         // ← ids!
  "genres": ["Electronic"],
  "styles": ["Drum n Bass"],
  "thumb": "…", "cover_image": "…"
}
```

**Missing:** `country`, `tracklist`, `notes`, `barcode`, `community`.

**And explicitly missing too** (checked on 2026-08-12, because the opposite assumption once
made it into a plan): **`identifiers`** — that is matrix/runout number, barcode, mastering
SID — **and `released`** as a full date. Both are available **only** through
`GET /releases/{id}`, so they cost one request per record. `basic_information` knows only
`year` about the release date.

**What does come along, and was thrown away for a long time:**

| Field | Shape | For what |
|---|---|---|
| `formats[].qty` | a **string**, `"2"` – not `2` | How many discs. Sum across all blocks: a 2×LP with a bonus 7" is three in two blocks |
| `formats[].text` | the submitter's free text | "Blue Translucent", "Etched", "Numbered" |

That text does **not** belong in the format list the engine compares against — that would be
a pressing colour quietly turning into a matching signal
(`tests/unit/pressing-detail.spec.ts` holds that in place).

### `GET /users/{u}/wants`

⚠️ The path is **`/wants`**, not `/wantlist`. `basic_information` is **structurally
identical** to the collection — one parser does for both.

### Visibility (verified)

| Resource | Foreign, public | Foreign, private | Owner |
|---|---|---|---|
| Profile | most fields | most fields | + email, counters |
| Collection folders | **folder 0 only** | 403 | all |
| Collection releases | yes | 403 | + private notes |
| Collection value | 403 | 403 | ✅ (only as a **formatted string**, e.g. `"$2,000.00"`) |
| Wantlist | yes | 403 | + notes |
| Inventory | "For Sale" only, ≤100 pages | – | everything, unlimited |

> **Most collections and nearly all wantlists are private.** (Sample: 7 of 8 wantlists
> private.) → OAuth is not optional, not even for your own data.

---

### `ships_from` is an English country name, not a code

Measured on 2026-08-12 at two shops: `fatplastics` → `"Germany"`,
`juno_records` → `"United Kingdom"`. No ISO codes, no abbreviations, and **"United
Kingdom"**, not "UK" and not "Great Britain".

For a country filter that means: what is compared and stored is the **English spelling as
Discogs writes it**. An ISO list works as a source for the picker, but its codes must not be
what is finally checked against `ships_from` — otherwise the interface offers countries the
comparison will never recognise.

A sample of two. Whoever builds the list checks the spelling of the countries they include
against real inventory rows — above all the ones with several common names (USA/United
States, South Korea, Czechia).

### ⚠️⚠️ There is no modification date — anywhere

A collection row carries exactly this:

```
id · instance_id · date_added · rating · folder_id · basic_information
```

**No `date_modified`, no `last_changed`**, and the endpoint has no filter for it (measured
2026-08-12). That is the most consequential gap in the whole API, because it makes an
obvious design impossible:

A delta sync running by `date_added` descending and stopping at the first known record sees
**nothing but new additions**. Change a rating on discogs.com, enter a condition, or move a
record into another folder, and `date_added` is untouched — the pass turns round long
before, every time.

**Reading the whole list and comparing is not *one* way to notice this; it is the only
one.** It costs one request per 100 entries. Fidelity does it once daily, on "refresh
everything", and at the press of a button above the shelf; everyday use stays on the delta,
because for an unchanged collection that costs exactly one request.

The same applies to the wantlist, which is therefore always read in full anyway.

### Write access — measured on 2026-08-11, from the browser

Until then Fidelity had only read, and whether the API is **writable** at all from a
client-only app had never been checked. It is. Every value below comes from real calls from
`http://localhost:3000` against `api.discogs.com` with a Personal Access Token.

| Call | Result | `Response.type` |
|---|---|---|
| `POST …/collection/folders/{f}/releases/{r}/instances/{i}` (rating) | **204** | `cors` |
| `DELETE …/collection/folders/{f}/releases/{r}/instances/{i}` | **404** for an unknown instance, with readable error text | `cors` |
| `PUT /users/{u}/wants/{r}` | **201**, with the entry in the body | `cors` |
| `GET /users/{u}/collection/fields` | **200** | `cors` |
| `GET /users/{u}/collection/value` | **200**, three formatted strings | `cors` |

**The preflight goes through.** `POST`, `PUT` and `DELETE` with
`content-type: application/json` and `authorization` trigger an `OPTIONS`, and Discogs
answers it. That is the basis for the app being able to write without breaking rule 1 (no
backend).

⚠️ **A 404 can still come without CORS headers.** A `PUT` to `/wants/999999999999` failed
with `No 'Access-Control-Allow-Origin' header is present` — the same signature as the 429
(§2). The same call against an **existing** release id returned a clean 201. For the code
that means: a rejected `fetch()` on a write does **not** necessarily mean "rate limit"; it
may mean "does not exist". From the outside the two are indistinguishable.

⚠️⚠️ **And so not every write may be blindly repeated.** On an opaque error, "it worked, the
answer just did not get through" cannot be separated from "it never arrived". Idempotent
calls (setting a rating, setting a field value, `DELETE`) may be repeated.
`POST …/folders/{f}/releases/{r}` — adding a record — is **not** idempotent and creates
another instance on every repeat. There we look with
`GET /users/{u}/collection/releases/{r}` instead of repeating.

### `GET /users/{u}/collection/fields`

Three fields, the same ids on every account:

| id | Name | Type | Options |
|---|---|---|---|
| 1 | Media Condition | `dropdown` | 8 |
| 2 | Sleeve Condition | `dropdown` | 10 |
| 3 | Notes | `textarea` | – |

The options come with the response. **Do not recreate them** — Discogs names them, and that
list is the only one the server accepts.

⚠️ **The field values appear in no listing.** Neither `…/folders/0/releases`, nor
`…/folders/1/releases`, nor `…/collection/releases/{r}` returned a `notes` field (measured on
an account where no field value has been set yet). Discogs presumably omits the field while
it is empty — **unconfirmed**. To be settled as soon as the first value is written: write,
read back, record it here.

### `GET /users/{u}/collection/value`

`{"maximum":"€1,458.87","median":"€668.62","minimum":"€240.16"}` — formatted strings, not
numbers, in the currency of the account settings. Meant for display, not for arithmetic.

---

## 5. Further endpoints

| Endpoint | Auth | Cost | Use to us |
|---|---|---|---|
| `GET /users/{u}` | no | 1 | `num_for_sale` as an **advance check on inventory size** |
| `GET /marketplace/stats/{release_id}` | **no** | 1/release | `num_for_sale`, `lowest_price` → signals 10 + 11 |
| `GET /marketplace/listings/{listing_id}` | no (better currency with a token) | 1/listing | **Refresh a single offer** – see below |
| `GET /marketplace/price_suggestions/{id}` | yes **+ seller settings** | 1/release | ❌ useless for a buyer's app |
| `GET /masters/{id}` | no | 1/master | `videos`, `tracklist`, `styles`, `main_release`. **Do not reach for it to fill in a record's clips: `videos[]` is a master-level fact that Discogs already prints on every release under it.** Measured 2026-09-14 — master 96559 and release 249504 hand back the *identical* set of 17 addresses, master 5542 and five of its pressings 12 each, and a release with none (14251612) has a master with none either. A lookup here returns what `/releases/{id}` already gave |
| `GET /masters/{id}/versions` | no | 1/100 | **The best source for "all pressings"**, undocumented facet filters `format`, `label`, `country`, `released`. `sort=released&sort_order=asc` puts the first pressings on page one (measured 2026-09-11 on master 5542: 160 versions, 1994 first); rows carry `label`, `catno`, `format`, `major_formats` |
| `GET /artists/{id}/releases` | no | 1/100 | No page limit; the basis for `ARTIST_GAP` |
| `GET /artists/{id}` | no | 1/artist | `namevariations`, `aliases`, `members`, `groups` — the lexicon behind `ARTIST_KNOWN` stage 0; fetched once per expanded artist with the discography (verified 2026-09-11: CORS open like the rest, `aliases`/`members`/`groups` are `{id, name}` lists, `namevariations` plain strings, each list absent when empty) |
| `GET /labels/{id}/releases` | no | 1/100 | No page limit; the basis for `CATALOG_RUN` |
| `GET /releases/{id}` | no | **1/release, ~16 kB → ~3 h for 10,000** | ⛔ **never in the scan loop**; supplies `styles`, `extraartists`, `identifiers` (see below) |
| `GET /database/search` | no (the docs say yes) | 1/100, max 100 pages | Dealer search, disambiguation via `barcode`. Release rows carry `label[]` (every company on the record, the label first), `catno`, `format[]`, `country`, `year` as a string (measured 2026-09-11) |

### `GET /marketplace/listings/{listing_id}` – the way around the six-hour rule

Verified live on 2026-08-09. Not to be confused with `/marketplace/listings?release_id=…`,
which returns **405** (see below): an offer is retrievable through **its own id**.

| | without a token | with a token |
|---|---|---|
| HTTP | 200 | 200 |
| `price` | in USD | in the account's currency, `curr_abbr` is honoured |

Back come `status`, `condition`, `sleeve_condition`, `comments`, `ships_from`, `posted`,
`price`, `original_price`.

**And with a token, the postage — measured on 2026-09-16** (a British shop, the account
in Germany, `curr_abbr=EUR`):

| Field | without a token | with a token |
|---|---|---|
| `shipping_price` | `{}` | `{ value: 14.108108…, currency: 'EUR' }` — postage for **this one listing to the account's address**, converted at Discogs' rate, as a float |
| `original_shipping_price` | — | `{ curr_abbr: 'GBP', value: 12, formatted: '£12.00', converted: { curr_abbr: 'USD', value: 16.22 } }` — the seller's own figure, **exact, in the seller's currency** |
| `shipping_is_blocked` | `true` | `null` — the seller ships to the account's country |
| `price` | in USD | `{ value: 5.8666…, currency: 'EUR' }` — converted, a float too |
| `seller.min_order_total` | present | `9.95` — in the seller's currency (the text says "£10 minimum") |
| `seller.payment` | present | `'PayPal Commerce'` |

So the figure Discogs shows in its own cart for a single record **is readable, one request
per listing, before anything is in the cart**. What it does not answer: the postage for
two or seven records from the same shop — that is still the seller's tier text ("1st LP
£12.00 + £1.50 per additional LP"). The rate between `shipping_price` and
`original_shipping_price` (14.108 / 12 = 1.1757) is the same one `price` was converted
with, so a basket can carry the seller's exact figure and convert once, itself.

> Store `original_shipping_price` (integer cents, seller currency), never the float. And
> it is marketplace data: it lives six hours like the price beside it.

**Why this is worth a lot:** after six hours, prices and conditions have to be deleted
(`docs/09` §1.1). Until now "I want to see yesterday's price again" meant a complete rescan
— at 20,000 listings, 200 requests and four minutes. Through this endpoint it costs **one
request per hit**: 19 hits are 23 seconds.

**And `status` answers the other question:** if it no longer says `For Sale`, the record has
sold. For the basket that is the difference between "waiting for you" and "gone".

> ⚠️ Refreshing is **no** substitute for a dig. It only looks again at offers a dig has
> already found — new stock at a dealer is found by scanning and nothing else.

---

### What `/releases/{id}` gives for pressing advice

Verified on real releases on 2026-08-09 (Blue Note "Newk's Time", three pressings):

| Field | Shape | For what |
|---|---|---|
| `identifiers[]` | `{ type, value, description? }` | `type` is, among others, `Matrix / Runout`, `Pressing Plant ID`, `Rights Society`, `Barcode` |
| `formats[].descriptions[]` | `["LP","Album","Reissue","Remastered","Stereo"]` | **"Reissue" stands here as a fact** – that is not a heuristic |
| `formats[].text` | `"Plastylite Pressing"`, `"180g"` | The submitter's free text |
| `country` | `"US"`, `"Japan"`, `"Worldwide"` | "Worldwide" in practice means a modern reissue |
| `released` / `year` | `"1959"` / `1959` | The pressing year, **not** the album's release year |

Evidence from those same three pressings:

```
1959 US    Mono                     BN-LP-4001-A [ear] M9 RVG   ← original: RVG + Plastylite ear
2015 US    Reissue, Remastered      MASTERED BY CAPITOL
2023 Worldwide  Reissue             (no stamp)
```

> ⚠️ **Costs nothing extra.** The follow-up over the top 50 runs for S7 and S10/S11 anyway —
> the pressing fields come in the same response. A pass of its own would be 50 requests for
> data that was already there.

---

### ❌ The endpoint that does not exist

**There is no way to list the offers for a release id through the API.**
"Who sells release X?" is not answerable.

- `GET /marketplace/listings?release_id=…` → **405**
- `GET /marketplace/search?release_id=…` → **401**, undocumented, not supported

**That is why every wantlist-×-all-dealers tool scrapes the website** — and why they die
regularly. Our dealer-centric approach runs on the **documented, ToS-clean path**. That is a
real structural advantage.

---

## 6. Data dumps (CC0)

`https://data.discogs.com/` · S3 `discogs-data-dumps` (us-west-2) · monthly on the 1st/2nd

```
https://data.discogs.com/?download=data%2F2026%2Fdiscogs_20260801_releases.xml.gz
```

| File | Size |
|---|---:|
| `releases.xml.gz` | **10.4 GB** (~100–120 GB unpacked) |
| `masters.xml.gz` | 593 MB |
| `artists.xml.gz` | 472 MB |
| `labels.xml.gz` | 86 MB |
| `CHECKSUM.txt` | SHA-256 of all four |

**The licence, verbatim from data.discogs.com:**

> "This data is made available under the **CC0 No Rights Reserved** license."

That is the most important practical fact of the whole project:
**no six-hour rule, no attribution requirement, no storage limit, no restriction on
commercial use** — for catalogue data.

⚠️ **CC0 applies only to the dumps.** Not to live API responses and explicitly **not to
marketplace data** (= "Restricted Data" under the ToS). Never mix the two licence worlds.

---

## 7. Known bugs & traps

| Trap | Behaviour |
|---|---|
| Docs out of date | The inventory example is from 2014, `sort=location` throws 422, search is usable without auth contrary to the docs |
| **Two error shapes** | Legacy `{"message": …}` vs. migrated `{"detail":[{…}],"message":…}` – Discogs is migrating backends. **Parse both.** |
| The `status` filter | Silently ineffective for foreign dealers |
| `pagination.pages` | Wrong for inventory |
| Images | The auth documentation is wrong; a separate Cloudflare limit; URLs are **signed** — you cannot swap the release id in the path |
| Search `[1, 1]` | The error message names the wrong upper bound |
| `lowest_price` in `/releases/{id}` | Known to be wrong; according to a Discogs employee it *"won't get fixed any time soon"* → use `/marketplace/stats/{id}` |

### What Discogs has not supplied for years

No listings-by-release, no inventory filters, no sales history through the API, no
median/average per release, **no webhooks**, **no `updated_since`/delta parameter**, no bulk
release lookup, no OAuth scopes.

> **Consequence for the watchlist:** without a delta parameter, a rescan is always a full
> scan. At 10,000 listings that is 100 requests. Set the watchlist frequency conservatively
> (1×/day per dealer, staggered).

---

## Sources

- [Discogs API Docs](https://www.discogs.com/developers/) · [Marketplace](https://www.discogs.com/developers/resources/marketplace/index.html) · [Collection](https://www.discogs.com/developers/resources/user/collection.html)
- [API Terms of Use](https://support.discogs.com/hc/en-us/articles/360009334593-API-Terms-of-Use)
- [data.discogs.com (CC0)](https://data.discogs.com/)
- Forum: [the pagination wall #778418](https://www.discogs.com/forum/thread/778418) · [rate limits #1104957](https://www.discogs.com/forum/thread/1104957) · [image 429s #1080144](https://www.discogs.com/forum/thread/1080144) · [listings-by-release #1017522](https://www.discogs.com/forum/thread/1017522) · [the lowest_price bug #1153606](https://www.discogs.com/forum/thread/1153606)


---

## `GET /marketplace/orders` – the shops you really bought from

Documented (Marketplace → Order → List Orders). Needs a token with marketplace access;
without one it answers 401, which the import swallows.

```
GET /marketplace/orders?status=All&per_page=100
→ { pagination, orders: [ { id, status, seller: { id, username, … }, … } ] }
```

**Cost:** one request. **Checked on 2026-08-10:** 200 with a Personal Access Token, and
`items: 0` on an account with no orders. The field names come from the documentation, not
from real data — which is why the schema is deliberately lenient (`seller` optional).

> ⚠️ **Settled on 2026-09-11, and the answer is: this is the seller side.**
>
> Measured twice, once minutes after a real purchase and once ten hours later, in four
> filter variants each — no filter at all, `status=All`, `archived=false`,
> `status=Payment Pending`, plus `sort=created&sort_order=desc`. Every one 200, every one
> `items: 0`, while the same token answered `GET /oauth/identity` with 200 in the same
> pass. The purchase is plainly visible on the web at `discogs.com/sell/purchases`.
>
> Time was the other candidate explanation and it is now ruled out: the order was ten
> hours old on the second measurement and the endpoint still reports nothing.
>
> **The web interface makes the same split.** `/sell/orders` is what you received as a
> seller, `/sell/purchases` is what you bought. `GET /marketplace/orders` maps to the
> first. An account that sells nothing sees `items: 0` for ever.
>
> **What depends on this:** `worker/dealers/discover.ts` used this endpoint as the
> *strongest* source for "shops you have actually bought from". For a pure buyer that
> source finds nothing at all, and it never will. Three user-visible sentences said
> otherwise and were corrected on 2026-09-11 — the orders source is now described as what
> it is: the shops that have bought **from you**.

---

## `GET /marketplace/orders/{order_id}` – a purchase, through its own id

**Measured on 2026-09-11 with a real order.** This is the counterpart to the wall above:
the list is the seller side, but a **single** order is readable by its buyer.

```
GET /marketplace/orders/259022-32308     → 200
```

| | |
|---|---|
| Top level | `id`, `resource_url`, `uri`, `messages_url`, `buyer`, `seller`, `feedback`, `created`, `last_activity`, `status`, `next_status`, `tax`, `total`, `shipping`, `shipping_address`, `archived`, `additional_instructions`, `fee`, `items`, `tracking`, `buyer_fee`, `tax_on_buyer_fee` |
| `items[]` | `id`, `price`, **`media_condition`**, **`sleeve_condition`**, `condition_comments`, `release` |
| `items[].release` | `id`, `resource_url`, `description`, `thumbnail`, `title`, `artist`, `format` |
| `seller` | `id`, `username`, `resource_url`, **`email`** |

**Two things follow, and they point in opposite directions.**

**The good one:** the graded condition per line item *is* available — `media_condition` and
`sleeve_condition`, the exact fields the M14 brief asked about (`docs/06`). Note the names:
not `condition`, which is what an inventory listing calls it.

**The limiting one: the id cannot be discovered.** The list endpoint is the seller side, so
there is no API route from "I am a buyer" to "here are my order numbers". The number is
visible on the web at `/sell/purchases` and nowhere in the API. Anything built on this has
to have the number typed or pasted in.

> ⚠️ **`seller.email` is in this response.** A third party's email address, for an order in
> which the app has no business holding one. It is not stored, not displayed and not logged
> anywhere — and anybody who parses this endpoint keeps it that way.

⚠️ **And the condition still may not be stored.** It is marketplace data like any other
(`docs/09` §1.3) and falls under the six-hour rule. That is why M14 keeps only the
*comparison* — "as described / better / worse" — and never the grade that was promised. The
measurement changes what is *available*, not what is allowed.

---

## `GET /users/{username}/friends` – **undocumented**

> ⚠️ **Not in the Discogs documentation.** The complete endpoint list on
> `discogs.com/developers` does not contain the word "friends". It breaks rule 5 and is
> permitted only under the conditions of **ADR-009**: off by default, switchable per device,
> no feature depending on it.

```
GET /users/{username}/friends?per_page=100
→ { pagination: { items, pages, … }, friends: [ { user: { id, username, … } } ] }
```

**Checked live on 2026-08-10:** 200 with a token, paginated, CORS open (reachable from
`http://127.0.0.1`). Four entries on the test account, one of them a dealer.

**Cost:** one request for the list, then **one profile lookup per candidate**
(`GET /users/{username}` → `num_for_sale`) to separate sellers from acquaintances. A friend
is not a shop; only stock makes one.

**If it disappears:** nothing to do. The call fails, the import loses its second source,
everything else stays.
