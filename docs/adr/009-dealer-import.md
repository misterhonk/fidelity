# ADR-009 – Dealer import: one named exception to rule 5

**Status:** accepted · 2026-08-10
**Affects:** CLAUDE.md rule 5, `worker/dealers/discover.ts`, `docs/02-DISCOGS-API.md`

---

## Context

Shops had to be typed in by hand. Mistype one — `430am-studio` instead of `430AM_Studio` —
and you pay a request for a wrong answer.

Discogs knows who you trade with. Two sources come into question:

| Source | Endpoint | Documented? | What it says |
|---|---|---|---|
| Orders | `GET /marketplace/orders` | **yes** (Marketplace → Order → List Orders) | Where you actually bought |
| Friends | `GET /users/{username}/friends` | **no** | Who you bookmarked — often shops |

Checked live on 2026-08-10: `/users/{username}/friends` answers **200** with a token,
paginated, CORS open. The complete endpoint list in the Discogs documentation
(`discogs.com/developers`) does **not** contain the word "friends" — not under *User
Identity*, not anywhere.

**So the friends list collides directly with rule 5:** "documented API endpoints only."

## Decision

**Orders are the foundation. The friends list is an additional source, switched on per
device and off by default.**

The conditions under which the exception holds:

1. **No feature depends on it.** If the endpoint disappears, the import loses half its
   input and nothing else happens. The error is swallowed, not reported — the same pattern
   as the optional hub (ADR-008).
2. **Off by default.** `Preferences.importFriends` is `false`. Rule 5 remains the normal
   case; the exception is a visible decision in the settings.
3. **The origin is stated.** Every row found says "ordered" or "friend". Anyone asked to
   judge a list needs to know which half a row came from.
4. **Read only, one call, no loop.** One page, 100 entries, then one profile lookup per
   candidate to separate sellers from non-sellers.

## Why not simply leave it

The obvious alternative — orders only — is clean, but for a collector who *bookmarks*
their shops through Discogs rather than *ordering* through Discogs, it finds nothing. That
exact case was the reason for this.

## Why not lean on it

Because rule 5 has a good reason: undocumented endpoints disappear without notice.
`/marketplace/search` went missing from Discogs users in exactly that way. Building on it
is building on sand — hence an *addition*, never a foundation.

## Consequences

- `docs/02-DISCOGS-API.md` lists both endpoints, one of them explicitly marked as
  undocumented.
- CLAUDE.md rule 5 names this one exception. A second one needs a second ADR.
- If the endpoint disappears, there is nothing to do. That is the test of whether the
  conditions were kept.
