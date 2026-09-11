# ADR-011: Fidelity writes back

**Status:** **Accepted** · **Date:** 2026-08-12

## Context

Until 2026-08-12 Fidelity only ever **read** the Discogs API. That was not a deliberate
decision but one that never had to be made: a buying advisor needs the collection in order
to compute, and nobody had asked whether it should be able to change it too.

Somebody asked on 2026-08-12. And on looking, it turned out that several things the app
already claims are half-truths without write access:

- **"Bought"** was a note to self. The record then stood at home on the shelf and, at the
  same time, on offer again in the next dig, because Discogs knew nothing about it.
- **The rating** of one of your own records was readable but not settable — even though
  the moment you give it is exactly the moment you are holding the record.
- **The condition** could not be noted anywhere. Take a VG+ instead of an NM in the shop
  and two weeks later you remember "it was okay, I think".

So the question was not whether write access is useful, but whether it is possible at all
from a **client-only app** — and what rules it breaks.

## The measurement the plan had to rest on

`POST /oauth/access_token` is blocked by CORS (ADR-007, `docs/02` §1b). If collection
writes were blocked in the same way, the plan would need a backend — and rule 1 forbids
one. So before a line of code there was a measurement, taken on 2026-08-11 from the
browser against `api.discogs.com`:

| Call | Result | `Response.type` |
|---|---|---|
| `POST …/instances/{i}` (rating) | **204** | `cors` |
| `DELETE …/instances/{i}` | **404** with readable text | `cors` |
| `PUT /users/{u}/wants/{r}` | **201** | `cors` |
| `GET …/collection/fields` | **200** | `cors` |
| `GET …/collection/value` | **200** | `cors` |

**The preflight is answered.** So the way is open without touching rule 1.

## Decision

Fidelity writes back — rating, condition fields, adding, weeding out, wantlist — under
five conditions.

### 1. Every write declares whether it may be repeated

The 429 comes through Cloudflare **without** CORS headers, and so does a 404 on some paths
(both measured). To JavaScript the two look identical: a rejected `fetch()` with no status.
**"It worked, the answer just did not get through" and "it never arrived" are the same
event.**

`WriteOptions.idempotent` is therefore a **required argument**, not an option with a
default. Rating, field value, `DELETE` and `PUT /wants` may be repeated.
`POST …/folders/{f}/releases/{r}` — adding a record — may not: Discogs creates a new
instance every time. There, from the second attempt onwards, we **look instead of send**
with `GET /users/{u}/collection/releases/{r}`, and an unreadable lookup leaves the job in
the queue rather than guessing.

### 2. Everything goes through the outbox, nothing directly

A write lands locally at once and as a job in `outbox`; the keeper works through it in the
background using the same pacer and the same web lock as every read (rule 3). Three
reasons:

- **Speed.** A slot is 1,200 ms. A star that lights up after that is no longer an answer
  to a touch.
- **Basements.** Record shops have no reception. A rating given there waits instead of
  being lost.
- **One place for retries** instead of five.

Jobs are named after their **target**, not their moment: tapping the stars three times
costs one request.

### 3. What is shown and never arrives gets taken back

After five attempts the outbox puts the old value back. A displayed change that never
arrives is worse than a rejected one: shelf and Discogs contradict each other, and nothing
on screen says so. That is why a delete job carries the **whole row** with it — Discogs
cannot give back what it never deleted.

### 4. Out before in

The outbox is drained **before** the collection sync. `syncCollection` writes Discogs'
answer over the mirrored row; if the sync ran first, a rating not yet sent would be
replaced by the old one.

### 5. Two things that never write

- **Demo mode.** Its records are built with `instanceId: 0`, and zero is exactly what the
  write path rejects. The rule sits in the data, not in a flag.
- **Deleting without asking.** Weeding a record out of the collection is the only
  destructive operation and always asks — with a second, different button, not with a
  `confirm()` that gets dismissed by reflex.

## Consequences

**The collection sync had to carry the entry ids along.** When writing, Discogs addresses
an *instance*, not a release. `instance_id` and `folder_id` arrived with every sync and
were thrown away. They are stored now; zero means "not writable", not "folder zero" —
folder 0 is Discogs' virtual "All" and invalid as a target.

**And that cost a migration.** The collection sync is a delta that stops at the first known
record — so existing rows would **never** have got their ids. Not "not yet writable", but
never. v5 clears the collection and forces a full pass, on the same bargain as v2 and v3:
every row comes back from the API, which costs one pass and nothing else.

**The condition fields live outside the collection row.** The sync rewrites that row
completely, and the field values come back in **no** listing from Discogs (neither folder 0
nor a real folder nor the single-item fetch — measured). In the collection row they would be
lost for good at the next sync.

**The collection value only rides along on a pass that saved something.** A delta over an
unchanged collection has to stay at exactly one request — that is what lets the keeper run
every half hour without anyone noticing.

## Alternatives that were rejected

**Write directly, without an outbox.** Simpler, and in a record shop with no reception it
loses precisely what you noted there.

**Optimistic with no rollback.** Saves half the machinery and produces silent divergence
between shelf and account — the worst kind of bug, because nobody notices it.

**Wait for the answer and only then display it.** Honest, and it makes every touch
1,200 ms long. The outbox is the compromise that has both: visible at once, and
demonstrably either arrived or taken back.
