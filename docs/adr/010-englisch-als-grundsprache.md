# ADR-010: English as the base language, German as a translation

**Status:** **Accepted** · **Date:** 2026-08-11 · **Supersedes:** the language rule in
`CLAUDE.md` ("user-visible text and project documentation: German")

## Context

Since 2026-08-11 Fidelity is a public repository under AGPL-3.0. That shifts an assumption
which had been unremarkable until then: that the only person reading this source speaks
German.

The code was never the problem — identifiers, comments and commits have been English from
day one, and a sample across `worker/` finds zero German identifiers. Three other things
were German:

1. **The interface.** 36 files, around 1,300 pieces of text.
2. **The addresses.** 14 of 21 routes: `/korb`, `/regal`, `/haendler`, `/landkarte`,
   `/einstellungen/…`.
3. **The documents.** All of `docs/`, plus the README and CONTRIBUTING.

For someone who wants to contribute and does not speak German, that is not a hurdle but a
closed door. They can read the code and still not find out what a screen promises, where a
route belongs, or why a decision went the way it did.

A German-language interface was never a product decision either. It was the author's
mother tongue, and nobody ever decided it should stay that way.

## Decision

**English is the project's base language.** German is a translation.

- **Interface:** English is the default. German is offered and chosen automatically when
  the device asks for it (`navigator.language`). Further languages can be added without
  anything about the structure changing.
- **Addresses:** English. `/basket` instead of `/korb`, `/shelf` instead of `/regal`.
- **Documents and comments:** English, without exception. Including the comments written
  in German between 2026-08-10 and 2026-08-11 — that was a deviation from the existing
  rule and is being undone.

**No language prefixes in the addresses.** No `/de/basket`. The language is a setting of
the user's, not a property of the address. Prefixes would break every existing address,
double the service worker's precache, and turn every bookmark into a language commitment.

**No i18n package.** Message files as plain objects, one composable, and the active
language is loaded on demand. Reasoning below.

**Addendum of 2026-08-11: the texts are split by area.** There is a shell
(`app/i18n/en.ts`, `de.ts`) with what appears on every screen — navigation, times,
recurring sentences — and one file per area (`app/i18n/settings.ts` and others) for the
rest.

The reason is measured: after navigation and settings had been converted, the first paint
sat at 116.9 of 120 kB, and 4.9 kB of that was text — at an estimated quarter of the
interface. All of it in one file would have broken the budget, and rightly so: the wording
of the vault picker does not belong in the first screen.

**The area files carry both languages together**, unlike the shell. For the shell a
separate chunk pays off, because it sits on every screen. For an area it does not: the file
is fetched once, when somebody opens that area for the first time, and doubling two
kilobytes is cheaper than the machinery a second dynamic import per area would need — an
`await` in every page, a second loading path, and a flicker you can get wrong.

Result: first paint 113.8 kB — below where it was before the change.

## Reasoning

**Why not `@nuxtjs/i18n`.** The bundle budget for the first meaningful paint is 120 kB
gzip (rule 7, `docs/12-RESSOURCEN-BUDGET.md`), and the figure was 113.2 kB — 6.8 kB of
headroom. `@nuxtjs/i18n` brings vue-i18n along and blows that. What this app actually needs
from an i18n library is a lookup in an object and a plural form; that is a few dozen lines.

**Why loading on demand rather than embedding.** Both languages in the bundle would mean
every user downloads the language they do not read. Loaded on demand, the first paint costs
one language — and the second language costs nothing to anyone who does not choose it.

**Why the addresses follow.** An English interface at `/korb` is half a promise. Addresses
are what somebody sees in the browser, shares and bookmarks; they belong to the interface,
not to the internals.

## Consequences

**Old addresses have to redirect.** There are bookmarks, installed PWAs with
`start_url: '/'`, and a service worker whose precache knows the old paths. Every renamed
route gets a permanent redirect from its old name.

**The translation is not machine work.** The German texts are deliberately worded in many
places — "Side One, Track One", "Habe ich die schon?", the matching engine's reason
sentences. They are rewritten in English, not translated. That is why this change takes
sessions rather than hours.

**The engine's reason sentences are the trickiest part.** They are built at runtime from
signals and get a pull request of their own.

> **Addendum of 2026-08-11, because the prediction was wrong.** This used to say the
> golden-file test nails the sentences down and the snapshot would change completely. That
> is false: the snapshot pins scores and signals, never the prose — it did not move by a
> line. The risk was elsewhere, namely in the fixtures, and one of them was wrong:
> `db.spec` built a `CREDIT_GRAPH` signal with `evidence: { artist: … }` where the phrase
> reads `person`. The sentence could therefore never have produced anything but the
> fallback. What hid this was, of all things, the hand-written string sitting next to it.
>
> And the sentences did not become bilingual *inside* the worker but outside it.
> `worker/match/reason.ts` keeps only `byStrength` — which signal leads is a scoring
> decision and reads the same `WEIGHTS` table as the score. How it sounds lives in
> `app/i18n/reason.ts` and is built when it is read. That solves a second problem nobody
> here had foreseen: the sentence was frozen at the moment of the dig, so a language change
> would never have reached it anyway.

**`docs/` stays German for now.** The documents are the biggest chunk and the least
urgent: anyone who wants to contribute needs an English interface and English addresses
first. The translation of the documents follows, and until then the README says so openly.

> **Addendum of 2026-09-11: the documents are English.** All of `docs/` — fourteen
> numbered documents and thirteen ADRs, some 6,500 lines — was translated in one pass, and
> the German file names went with it: an English document at a German address is exactly
> the half measure this ADR argues against. The numbers stayed, because around 200
> references in the code cite a document by its number (`docs/02`, `docs/04`) and the
> number is the stable identifier; only the suffix moved.
>
> With that the rule holds everywhere, and this ADR's own sentence "the documents follow"
> is redeemed. What is left is German only where German is the subject: the German half of
> the message files, and the quoted user requests inside this repository's history.

## Rejected alternatives

**Keep German and offer an English translation.** That is the same work with the sign
flipped, and it leaves the base language where it serves nobody but the author. The default
decides who the project invites.

**Only the interface, leave the addresses German.** Cheaper, and it leaves a project that
stops halfway. `/haendler` is not even pronounceable for somebody without German.

**Language prefixes (`/de/…`, `/en/…`).** The usual route for server-side rendering and
wrong here: there is no server, every route exists twice in the precache, and a shared link
fixes the recipient's language instead of their own.
