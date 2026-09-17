# 20 – The voice

> **Status:** in force · **As of:** 2026-09-17 · **Concept:** "Hinterm Tresen" (artifact, 2026-09-16)

Fidelity is the person behind the counter (`00-CONCEPT.md` §1). This document says how that
person talks, in English and in German, so that every string in `app/i18n/` sounds like the
same one. It came out of three requests in one evening (2026-09-16): the German read like an
office letter, and the English, being the template, carried the same habits.

---

## 1. The figure

The person behind the counter of a good record shop. They know your shelf because you come in
often. They have taste and say so without lecturing. They pull things out of the crate you would
not have found yourself and put them in front of you with one sentence. When they do not know
something, they say so in three words and move on.

Not a mascot, not a salesman with lines, not a manual. No jokes on demand, no exclamation, no
triple apology. The warmth is in the wording, not in punctuation.

**Who speaks, who is spoken to**

- **you / du**, always. Never "the user", never "Sie".
- **we / wir** wherever the app acts: "We keep the last five digs", "Wir holen die Preise neu".
  The "we" is the shop. Never "this app", never "Fidelity" in the third person outside settings,
  account and legal text.
- **Shops and sellers** are third parties with names: "fatplastics has another pressing of it",
  not "the dealer offers a further listing".
- **No "I".** An "I" claims to be a person. "We" is honest: people and computing time.

---

## 2. Seven rules

1. **Talk with, not about.** Every sentence has a you, a we or a record in it. A sentence in
   which only the app and its rules occur is rebuilt or cut.
2. **One thought, one sentence.** Main clauses, under fifteen words on average. A full stop is
   allowed. A dash only where it replaces a word, never as brackets around the second thought.
   German separates with commas, English with full stops.
3. **Say what happens, not which rule applies.** Not "The six-hour window has closed" but
   "Those prices are more than six hours old. Dig again and we fetch them fresh." Not "rule 8"
   but "works without a hub".
4. **Honest, not defensive.** What we do not know, we say in three words: "we don't know",
   "wissen wir nicht". No "does not claim", no "is not something this app can see".
5. **The shop's words stay, the machine's words go.** Dig, find, shelf, shop, record, pressing,
   wantlist, basket, postage: stay. Listing, scan, horizon, hub, token, sync, request, window:
   out of sentences; they live on in number lines and settings. See §3.
6. **Warmth without a punchline.** A smile sits in the choice of words ("Something in here for
   you"), not in jokes. No exclamation marks, no emoji, no "Great!", no "Oops".
7. **Both languages are originals.** German is written, not translated. English stays the
   template for structure and length (ADR-010); the German sentence may be built differently as
   long as it says the same.

---

## 3. The words

| English | German | In sentences | Why |
|---|---|---|---|
| dig, to dig | Dig, graben | yes | The image of crate-digging is Fidelity. "Dig" stays as the name of the thing in German; the verb is "graben" |
| find, finds | Fund, Funde | yes | What a dig brings. Not "Treffer" in sentences; "Trefferquote" stays as a number |
| shop | Laden | yes | Never "dealer" / "Händler" in sentences; that is the code |
| shelf | Regal | yes | Your collection, as a place. "Collection / Sammlung" stays as the name of the area |
| record | Platte | yes | Never "release", never "item" |
| pressing | Pressung | yes | Collectors' word, both languages |
| wantlist | Wantlist | yes | Discogs' word, everybody knows it |
| basket, parcel | Korb, Paket | yes | "Paket" for the shipment, "Korb" for the pick |
| postage | Porto | yes | Never "Versandkosten" in sentences; "Versand / Shipping" stays as a heading |
| listing | Angebot | numbers only | "2,871 listings" as a number; in a sentence "what the shop has". German: "Angebote", never "Listing" in a sentence |
| scan | Scan | no | Becomes "dig / graben" everywhere. One word for one thing |
| horizon | Horizont | no | Stays as a name in settings. In sentences: "what belongs to your artists" |
| hub | Hub | settings only | In sentences: "other collectors", "shared" |
| token, sync, request, window | Token, Abgleich, Anfrage, Fenster | no | Sentences say what happens |
| median, hit rate | Median, Trefferquote | as a number | Beside a figure, not inside an explanation |
| watch | beobachten | yes | Martin's decision, 2026-09-17: short, understood, on the button |
| hide → put away | weglegen | yes | "Hide / ausblenden" is software. In a shop you put something away. The way back: "Bring it back / Wieder hervorholen" |
| the round | die Runde | yes | "Rundgang" is a museum. A round through the shops you watch |

---

## 4. The patterns

**The line under the heading.** What the screen does for you, one sentence with a you or a we.
No dash, no colon. *Pick a shop. We go through the racks and pull what's for you.*

**The empty screen.** An invitation, not a finding. What happens first, pointing at the button.
*No shops yet. Dig through one, and it shows up here.*

**The button.** A verb that says what happens, two or three words. The filled button is the one
the screen exists for. *Dig now · Dig again · Watch this shop · Put it away · Bring it back.*

**The error.** What happened, what still works, what you can do. In that order, three short
sentences, no culprit. *Discogs asked us to slow down. Everything so far is saved. Give it a
minute or two, then dig on.*

**The "why" fold.** A friend explaining over a beer. Two or three sentences with we and you, no
rule numbers. Where something is missing: "we don't know".

**The reason on a find.** The best tone the app has. One sentence, record instead of listing,
shop by name. *That's on your wantlist, and one you want most.*

**The number line.** Stays as it is: mono, dots between, no verbs.
*7,680 ratings · 99.9 % · since 2010 · 2,871 listings.*

**The way back.** One line for what happened, one word back. *fatplastics put away. Undo.*

---

## 5. Where the voice goes quiet

- Number lines and plates stay mono and without verbs.
- Settings and account may say "token", "hub", "horizon". The line beneath still explains with
  you and we.
- Legal text stays as it is.
- Names for screen readers (`aria-label`) stay facts: "Parlophone, 90 records", "Dig fatplastics
  now". A screen reader wants the word, not warmth.
- The sixty-words rule (`tests/e2e/sixty.spec.ts`) holds. Looser does not mean longer; most new
  sentences are shorter than the old ones.
- No slang, no dialect. "Dein Ding" yes, "krass" no. The voice is grown up and lives in every city.

---

## 6. The counter test

Three questions for every sentence before it goes into a pack:

1. Would the person behind the counter say it like that, out loud, to you, with a record in hand?
2. Is there a you, a we or a record in it?
3. After the sentence, do I know what happens next?

And four checks a test takes over (`tests/unit/voice.spec.ts`), so the voice does not go stiff
again with the next commit. It runs over the packs that have been through the rewrite, listed in
the test, and names the line:

- no "this app", "diese App", "the user", "der Nutzer";
- no spaced dash inside a string;
- in German no "wurde", "erfolgt", "ermöglicht", "ist erforderlich";
- no exclamation mark, no "scan" in a sentence.

The test replaces no reader. It catches the relapse.
