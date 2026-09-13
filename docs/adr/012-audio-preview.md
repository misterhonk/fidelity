# ADR-012 – Audio preview: one named exception to the privacy promise

**Status:** Accepted
**Date:** 2026-09-10

## Context

The stack (M15) is meant to offer an audio preview. The data for it is already there:
**measured on 2026-09-10**, `GET /releases/{id}` returns a `videos[]` field with `uri`,
`title` and `duration` — fourteen entries for release 1. The follow-up lookup over the top
matches fetches exactly this endpoint anyway (`worker/dig/enrich.ts`), so the addresses
would come along without an extra request, just like the pressing fields.

Sample over seven releases: five had videos (14, 17, 9, 1, 1), two had none. At seven that
is an indication, not a rate.

**Discogs has no other source of sound.** `videos[]` are YouTube addresses, and there is no
second route — no preview snippets, no audio files, nothing. If you want an audio preview,
you get it from Google or not at all.

And against that stands a sentence the app promises verbatim (`app/i18n/legal.ts`):

> "Fidelity has no server. There is no place where your data could be processed — all of it
> lives in your browser's database and does not leave this device."

**What an embed actually breaks about that, and what it does not.** It does not upload a
collection anywhere — shelf, wantlist, token and matches stay where they are. What Google
learns is the IP address and which video, and therefore which record, is being watched.
That is less than the sentence makes you fear, and more than nothing. Afterwards the
sentence is no longer true without a qualifier, and **a promise that is only nearly true is
broken.**

## Decision

**The audio preview is allowed, off by default, and makes no contact before it is asked.**

The conditions under which the exception holds — the same shape as ADR-009:

1. **No feature depends on it.** The stack works completely without sound. If YouTube goes
   away, one button changes and nothing else.
2. **Off by default.** One switch per device, in the settings, with a sentence that says
   what happens — not with the word "privacy" and a checkbox.
3. **Not a byte to Google before somebody wants it.** The `<iframe>` is created **only on
   the first deliberate tap**, not when a card is drawn. Anyone who never flips the switch
   has never opened a connection to Google either — that is the difference between an
   exception and a back door.
4. **After that, one player that travels along.** After the first tap a player instance
   stays put and gets a `loadVideoById()` per card. That also happens to be the only route
   that works at all: browsers require a gesture for sound, and this one gesture then
   carries through the stack. There is no autoplay on card one, in any browser, and no line
   of code changes that.
5. **`youtube-nocookie.com`**, together with the truth: that prevents cookies before
   playback, not the request itself. Google sees the IP either way.
6. **The privacy page gets a paragraph of its own.** The promise is changed, not quietly
   broken. The paragraph names who learns what.
7. **Its own chunk.** Anyone who never opens the stack pays nothing for it (rule 7).
8. **The sound belongs to the record, not to the track.** `videos[]` belongs to the release;
   on a compilation the first video is not necessarily what is on the cover. The screen
   names the title it is playing rather than pretending it is *the* record.

## Alternatives

**No sound at all.** Clean, and the promise stays untouched. Rejected, because for a record
you do not know an audio preview is the difference between "looks interesting" and "I want
that" — and because the data is already there at no extra cost. Drawing a line that helps
nobody is not caution.

**Only link out.** No embed, no Google on our page; the user goes there themselves. Honest,
and unusable in a swipe stack: somebody who leaves the app for every preview stops swiping.
Stays as what happens without the switch.

**Serve the audio ourselves.** Legally impossible and technically non-existent. Written
down only so that nobody considers it a second time.

## Consequences

**Easier:** The stack gets what distinguishes it from a picture gallery. Costs no extra
Discogs request, because the addresses come along with the follow-up lookup.

**Harder:** The privacy page can no longer be said in one sentence. That is the real price,
and it is paid deliberately.

**The way out:** switch off — and there is no contact with Google, not less but none.
Removing it entirely means: delete a chunk, strike a paragraph from the privacy page, take
`videos[]` out of the schema. None of that touches data anyone already has.

---

## Amendment, 2026-09-13 — the same exception, on more than one screen

M31 asked for a way to hear a suggestion. The preview built here answered that
already, and only on the stack: the screen where somebody actually weighs up a
find — the detail sheet — had a search link and no sound, although the `videos[]`
were sitting on the match it was drawing.

So the button now stands wherever a record does: the find's sheet, a shelf
record's sheet, and the stack. **Nothing about the decision above changes.** Same
one switch, same off by default, same nothing-before-a-tap, same
`youtube-nocookie.com`, same paragraph on the privacy page — no second third
party, no second transfer, no second consent to obtain.

Two things did have to change in the code, and both are conditions 3 and 4 being
kept rather than loosened:

- **One player for the whole app.** The state was per call site, which was
  harmless while the stack was the only caller. With two screens offering the
  same button it would have meant two frames, one of them unstoppable.
- **A screen gives the player back when it goes.** A sheet closes and takes the
  element with it; the frame goes too, and a player whose frame has gone plays
  nothing and stops nothing. `release()` tears it down at that moment, which also
  means leaving the screen is a way to stop the sound.

And one thing the wider reach made necessary on screen: **where the sound comes
from is named.** The service picker from M31 can say Deezer while the clip
underneath it is YouTube's. They are two different things, and a screen that puts
them under one heading owes the reader the difference.

The privacy page also now names the third country, which it should have from the
start: Google LLC is in the United States, and the transfer relies on the EU–US
Data Privacy Framework.
