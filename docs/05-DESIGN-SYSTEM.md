# 05 – Design system & UI/UX

> The target: **a good record shop in 2026.** Warm, dense, knowledgeable.
> Not retro kitsch, not neon cyberpunk, not an enterprise dashboard.

---

## 1. Attitude

| Principle | In practice |
|---|---|
| **Cover first** | Record covers are the interface. The UI is the frame, not the star. |
| **Dark first** | Record shops are dark, and cover art glows on a dark ground. Light mode exists but is the second choice. |
| **Density is a feature** | Collectors want to see a lot. A density switch rather than a compromise. |
| **Every number explains itself** | A score without a reason is an insult. |
| **Honesty over completeness** | "18,400 of 43,234 scanned (42 %)" rather than pretending it is all there. |
| **Waiting is searching** | Never a spinner. Always real numbers and matches flowing in. |

---

## 2. Design tokens

Format: **DTCG 2025.10** (the W3C standard has been stable since October 2025) →
Style Dictionary → CSS custom properties → Tailwind `@theme`.

```
tokens/
├── core.json        # Raw values: colour ramps, spacing, radii, type
├── semantic.json    # Roles: surface, text, border, accent, signal-*
└── component.json   # Component-specific
```

**All colours in OKLCH.** Perceptually even lightness means the signal colours all carry the
same weight — none looks more dominant than another.

### 2.1 The neutral ramp – "cardboard"

A warm neutral (hue 70, minimal chroma). Paper, card, inner sleeves.

```css
--fid-n-50:  oklch(0.980 0.004 70);
--fid-n-100: oklch(0.955 0.006 70);
--fid-n-200: oklch(0.900 0.008 70);
--fid-n-300: oklch(0.820 0.009 70);
--fid-n-400: oklch(0.680 0.010 70);
--fid-n-500: oklch(0.560 0.011 70);
--fid-n-600: oklch(0.450 0.012 70);
--fid-n-700: oklch(0.340 0.012 70);
--fid-n-800: oklch(0.245 0.011 70);
--fid-n-900: oklch(0.180 0.010 70);
--fid-n-950: oklch(0.135 0.009 70);
--fid-n-990: oklch(0.105 0.008 70);   /* the dark app background */
```

### 2.2 The accent – "shellac"

A warm amber orange. Label printing ink, a valve amplifier, a neon sign in a shop window.

```css
--fid-accent-400: oklch(0.800 0.140 62);
--fid-accent-500: oklch(0.740 0.165 58);   /* primary */
--fid-accent-600: oklch(0.660 0.170 54);
--fid-accent-700: oklch(0.560 0.150 52);
```

### 2.3 Signal colours – one per match type

Ten colours for eleven signals: S1 and S2 (wantlist exact / different pressing) share one.
All within a narrow lightness band (L 0.70–0.78) and at similar chroma (C 0.11–0.18) — so no
signal colour looks heavier than the others.

```css
--fid-sig-wantlist:  oklch(0.72 0.170 350);  /* magenta   – wantlist exact/pressing */
--fid-sig-gap:       oklch(0.78 0.150  85);  /* gold      – discography gap         */
--fid-sig-credit:    oklch(0.75 0.120 190);  /* turquoise – credit graph            */
--fid-sig-artist:    oklch(0.70 0.140 250);  /* blue      – artist known            */
--fid-sig-label:     oklch(0.70 0.160 300);  /* violet    – label affinity          */
--fid-sig-catalog:   oklch(0.74 0.150 150);  /* green     – catalogue run           */
--fid-sig-style:     oklch(0.76 0.110 210);  /* cyan      – style adjacency         */
--fid-sig-price:     oklch(0.78 0.160 130);  /* lime      – price signal            */
--fid-sig-scarcity:  oklch(0.70 0.180  28);  /* red-orange– scarcity                */
--fid-sig-upgrade:   oklch(0.74 0.130 170);  /* mint      – format upgrade          */
```

`contrast-color()` (Baseline 2026) for the chip text — so the contrast stays correct without
maintaining a foreground colour per colour.

### 2.4 Semantic roles with `light-dark()`

```css
:root {
  color-scheme: light dark;

  --fid-bg:            light-dark(var(--fid-n-50),  var(--fid-n-990));
  --fid-surface:       light-dark(#fff,             var(--fid-n-950));
  --fid-surface-raised:light-dark(var(--fid-n-50),  var(--fid-n-900));
  --fid-border:        light-dark(var(--fid-n-200), var(--fid-n-800));
  --fid-inset:         light-dark(var(--fid-n-200), var(--fid-n-800));
  --fid-text:          light-dark(var(--fid-n-900), var(--fid-n-100));
  --fid-text-muted:    light-dark(var(--fid-n-600), var(--fid-n-400));
  --fid-accent:        light-dark(var(--fid-accent-700), var(--fid-accent-500));
}
```

One declaration per token instead of a duplicate `.dark` block. The user's override lives in
`localStorage` and is **applied before the first paint** (an inline script in the `<head>`),
or it flashes.

**`--fid-inset`** is the recessed ground: progress bars, empty cover areas, unfilled grid
cells. It arrived late, because the markup had `--fid-n-800` hard-coded everywhere — right in
dark mode, black tiles on a white ground in light mode. It carries **no accent text**: 3.62:1
in light mode, which is not enough. A unit test reads the templates and does not let that
combination through.

**The switch** lives under Settings › Appearance and knows system, light and dark. `system`
is not a third palette but the absence of an override: then `color-scheme: light dark`
decides alone. `<meta name="theme-color">` follows the result at runtime — the manifest can
only name one value, and that would be wrong for half the users.

**Mobile fields are 16 px.** Below that, iOS Safari zooms the whole page on focus and does
not zoom back. The alternative would be `maximum-scale=1` — which takes pinch zoom with it
and breaches WCAG 2.2 SC 1.4.4. Double-tap zoom is off via `touch-action: manipulation`;
pinch zoom stays.

### 2.5 Typography

One set, **Presswerk**, self-hosted from `app/assets/fonts/` and declared in `fonts.css`.
No component names a typeface — everything goes through `--fid-font-sans`,
`--fid-font-mono`, `--fid-font-display`. All three come from Fontshare — the licence
allows the files in an AGPL repository, which the Swiss foundries' webfont licences would
not (the review of 2026-09-12 says why that is the decision, not the taste).

**Two faces changed on 2026-09-12 (M26.1).** Array became a dot matrix at the new display
size — a neon sign, not a type plate — and Chivo Mono was the one face not on Fontshare.
Four sets were tried on the shelf at 2× (Array · Switzer · Chivo, Cabinet · Switzer ·
JetBrains, Clash Display · General Sans · Azeret, Familjen · Satoshi · JetBrains); Martin
picked the second: the body stays, the display face gains the weights to carry an `h2`
too, and the mono is the quietest plate of the three.

| Body | Numbers | Headings |
|---|---|---|
| Switzer | JetBrains Mono | Cabinet Grotesk – a grotesk with weight, Fontshare's answer to GT America |

Until 2026-08-11 there were three sets (Kontor, Schweiz) and a switch under Settings ›
Appearance. Removed: the switch cost two font families in the bundle for a choice nobody
made twice, and the font module fetched from Google whenever a provider was left on
(`main.css` §1 has the details). This section said "three sets" for a month after that.

| Role | Class | Why |
|---|---|---|
| UI + body | (default) | Neutral, excellent legibility at small sizes |
| Catalogue numbers, matrix/runout, prices, scores | `.fid-num` | Codes, not prose — plus `tabular-nums` so columns line up |
| Headings, the wordmark | `.fid-display` | Twice per screen, otherwise it is no longer emphasis |
| Labels, tabs, definition terms, the line of facts under a title | `.fid-plate` | Mono, `xs`, spaced capitals — a type plate, not a sentence. "LAST FULL SYNC 5 H AGO" reads as a reading and takes a third of the room (M26.1) |

```css
/* A fluid scale – clamp() with a rem term so browser zoom works (WCAG 1.4.4) */
--fid-text-xs:   clamp(0.75rem,  0.72rem + 0.15vw, 0.8125rem);
--fid-text-sm:   clamp(0.875rem, 0.84rem + 0.18vw, 0.9375rem);
--fid-text-base: clamp(1rem,     0.96rem + 0.20vw, 1.0625rem);
--fid-text-xl:   clamp(1.375rem, 1.24rem + 0.65vw, 1.75rem);
--fid-text-display: clamp(2.5rem, 2rem + 2.2vw, 4.5rem);   /* the one voice, PageHeader only */
```

**Four text steps and one voice since 2026-09-12.** The review of that day (M26 "Sleeve")
found nothing on any screen large enough to carry a stance: the largest step was 28 px, and
Array was spending its character on a heading the size of a paragraph. `display` is 40 to
72 px, in the display face, and `design-restraint.spec.ts` allows it in exactly one file —
`PageHeader.vue` — so the fifth step cannot become a fifth decision per screen.

**Four steps since 2026-08-10, instead of six.** `lg` sat between `base` and `xl` with
sixteen uses, not one of which needed the step — section headings now carry their hierarchy
through `font-medium` and spacing. `2xl` made page titles louder at 40 px than anything below
them; they now sit on `xl`, and `.fid-display` supplies the character. What has to stay large
because the size *is* the statement — the Barry Score, the numbers on the start page, the
targets in a shop — also sits on `xl`.

Bringing a step back is possible but must be justified: six steps mean six decisions per
screen, and the previous scale had two that nobody made.

> ⚠️ **Never `vw` alone for `font-size`.** It breaks browser zoom and violates WCAG 1.4.4.
> Always a `rem` term inside the `clamp()`.

**Tabular figures are mandatory** for prices, years, catalogue numbers and scores:

```css
.fid-num { font-variant-numeric: tabular-nums; }
/* Tailwind 4: font-features-["tnum"] */
```

### 2.6 Grid, radii, shadows

```css
--fid-space: 4px;                      /* everything is a multiple */
--fid-radius-sm: 6px;
--fid-radius-md: 10px;
--fid-radius-lg: 16px;
--fid-radius-cover: 2px;               /* covers are almost square – like real sleeves */

/* Elevation in dark mode through lightness, not through drop shadows */
--fid-elev-1: 0 1px 2px oklch(0 0 0 / 0.28);
--fid-elev-2: 0 4px 14px oklch(0 0 0 / 0.34);
```

---

## 3. The core components

> **Design names, not file names.** The sections below describe *behaviour* under the
> names the design was drawn with. In code, `ScanProgress` is the progress block in
> `pages/dig.vue`, `SignalChip` is `utils/signals.ts` rendered by `MatchCard`/`MatchRow`,
> `ShippingLadder` is the tier table in `BasketCard.vue`, and `CatalogRunGrid` is the one
> that kept its name. A component of its own is cut when a second screen needs it — the
> detail sheets got theirs (`SheetFrame`) on 2026-09-11, when the audit found the drawer
> chrome copied line for line and drifting.

### 3.1 `MatchCard` – the app's most important component

```
┌──────────────────────────────────────────────────────────────┐
│ ┌────────┐  Neu! – Neu! 2                          ╭──────╮  │
│ │        │  Brain · BRAIN 1028 · DE · 1973         │  91  │  │
│ │ Cover  │                                          │Side 1│  │
│ │ 96×96  │  ◆ Credit  ◆ Catalogue run  ◆ Price     ╰──────╯  │
│ │        │                                                    │
│ └────────┘  Conny Plank at the desk – you have 9 of his       │
│             productions, not this one. In the 1000 series     │
│             you are only missing 1051 and 1060.               │
│                                                                │
│  VG+/VG+   €24.00  (market from €41)    [+ basket] [Discogs ↗]│
└──────────────────────────────────────────────────────────────┘
```

**Since M26.2 (2026-09-12) the sleeve carries the card.** The diagram above is the card as
it was drawn in M1; what ships is: the cover at forty per cent of the card from a tablet up
and the full width on a phone, the signals as one plate line above the title, the title in
the display face with the artist over it, the facts as a plate, the sentence at its own
width, the score and the price on the last line, the actions under the card. No frame — a
card separates itself from its neighbour by the cover and the gap, the way sleeves do in a
crate. The colours of the signals live in the sheet's list; the card names them.

The rules:

- **Container queries**, not viewport breakpoints. The same card works in a 3-column grid and
  in a 320 px drawer, without variant components.
- The number is set tabularly, the band beside it as a plate.
- The signals are named on the card and coloured in the sheet.
- The reason sentence is **never** truncated. It is the product.
- Covers: `loading="lazy"`, `decoding="async"`, a fixed 1:1 aspect ratio, a skeleton in
  neutral 800, **straight from `i.discogs.com` by the browser** (never server-side — a
  separate Cloudflare rate limit).

### 3.2 `ScanProgress`

No spinner. Ever.

```
┌───────────────────────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░  8,400 / 20,000    │
│ Page 84 · about 2:10 left · 47 matches so far             │
│ ⓘ The dealer has 43,234 listings – the API releases at    │
│   most 20,000.                       [What does that mean?]│
└───────────────────────────────────────────────────────────┘
```

Per NN/g: under 1 s nothing at all, 1–3 s a skeleton, over 3 s **determinate progress with
real numbers and the option to cancel**. A two-minute spinner is hostile.

The ⓘ note about the 10k wall is not small print but a signal of trustworthiness.

### 3.3 `SignalChip`

```html
<button class="fid-chip" data-signal="credit">
  <span class="fid-chip__dot"></span> Credit graph
  <span class="fid-chip__n fid-num">9</span>
</button>
```

The background: the signal colour at 12 % opacity, the border at 40 %, text via
`contrast-color()`. Minimum size 24×24 px (WCAG 2.2 SC 2.5.8).

### 3.4 `CatalogRunGrid`

The catalogue run as a grid. The dopamine loop.

```
Brain 1000 series                               9 of 12
┌────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┐
│1001│1002│1004│1005│1010│1021│1031│1042│1051│1055│1060│1071│
│ ●  │ ●  │ ●  │ ●  │ ●  │ ●  │ ★  │ ●  │ ○  │ ●  │ ○  │ ●  │
└────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┘
 ● owned      ★ buyable here      ○ missing
```

### 3.5 `ShippingLadder`

```
Postage to you (DE)             currently 2 records · €9.00 total · €4.50 each
 1 ▏ €6.00     €6.00 each
 2 ▓ €9.00     €4.50 each   ← you are here
 3 ▓ €9.00     €3.00 each   ← +1 record saves €1.50 each   [show candidates]
 4 ▓ €12.00    €3.00 each
```

### 3.6 The rest

| Component | Purpose | In code |
|---|---|---|
| `CommandPalette` (⌘K) | Searches **data**, not just navigation: artists, labels, shops, saved digs. | `CommandPalette.vue`, hand-rolled. `@nuxt/ui` is installed for its module scaffolding only — its stylesheet is dropped in `main.css` §0 and no `<U…>` component is rendered anywhere. |
| `DealerFingerprint` | Bars for the label/style/decade distribution + the hit rate | `FacetBars.vue` on `/dealers` and `/map` — the same bars serve both the shop and the collection |
| `FilterRail` | The filters over a find list | `DigFilters.vue`, inline above the list on every width. No sidebar, no bottom sheet, no drawer library. |
| `DensityToggle` | Three ways to look at one list | Built, in `DigFilters.vue`, and the choice is in the address (`dicht=`). **Detailed** is `MatchCard` and the default — it carries the sentence saying *why* a record is in the list, which is the app's whole product. **Crate** is `MatchTile`: sleeves two across on a phone, title, artist, price, and deliberately no score — a number is something you weigh, and weighing is the other two. **Compact** is `MatchRow` at 34 px (`--fid-row-compact`), a table with named columns that each sort. |
| `RecordMasthead` | What a record *is*, at the top of every sheet that shows one | `RecordMasthead.vue`. Three voices so the eye sorts without reading: artist in the text face, title in the display face (the largest step outside `PageHeader`), facts in mono. Long names are the design case — two lines for the artist, three for the title, balanced and hyphenated, the sleeve on the baseline so a long name grows upward. `SleeveWash.vue` puts a blurred copy of the cover behind the head with a plinth over it, because a bright sleeve takes the contrast out from under the type. |
| `EmptyState` | Not "no results" but a sentence with a way out | Inlined per screen: every empty state names the next step as a link (`/shelf`, `/wantlist`, `/basket`, `/saved`, `/watched`, `/stack`). The "but [name] has 12 matches" version needs a second scanned shop and is not built. |
| `SheetFrame` | The drawer every detail sheet slides in on | `SheetFrame.vue`: focus trap, focus returned to the opener, `@container` on the panel, Escape and scrim close, `view-transition-name` per sheet. Three slots beyond the body: `title` (dropped where a masthead carries the name — the same two words twice is a duplicate, not a heading), `tools` (what this sheet can do with itself, beside the ✕) and `wash` (the sleeve's colour, from the top edge, behind everything). |
| `useWalkKeys` | Stepping a list from inside the sheet that shows one of its rows | `app/composables/useWalkKeys.ts`. `←`/`→` because that is how a drawer from the right is walked, `k`/`j` because that is how a list is walked in every mail client. The guard is the whole of it: nothing while the focus is in a field, nothing with a modifier held. |

---

## 4. Interaction patterns

| Pattern | Implementation |
|---|---|
| **Virtualisation** | From ~200 rows, `@tanstack/vue-virtual`. Collections have 5,000+ entries. |
| **View transitions** | Same-document, for card → detail sheet. Cross-document not yet (an Interop 2026 building site). |
| **Optimistic UI** | Only for the basket, wantlist adds and feedback. **Not** for anything involving money or a real error rate. |
| **Worker progress** | `postMessage` from the web worker. No polling, no SSE — there is no server. |
| **The URL is the state** | Filters, sorting and density in query params. Digs live locally — for sharing there is JSON export. |
| **`scrollbar-gutter: stable`** | On every list pane. No layout jump when filtering. |
| **Skeletons** | Only with exactly the dimensions of the real content, or you swap a spinner for CLS. |
| **`content-visibility: auto`** | On the rows of the two long lists that are *not* virtualised — a dig under two hundred finds and the shelf — with `contain-intrinsic-size` so the scrollbar does not lie. Not above the virtualiser's threshold: there the nodes are gone anyway, and two mechanisms would argue about the same rows. One side effect worth knowing: a full-page screenshot captures the skipped rows blank. |
| **Three volumes, one hue** | Filled for the one action a screen is for, tonal (`.fid-tonal`, the accent at 16 %) for the reversible companions, outlined for the rest — including the destructive one, because red is a warning and not a button. A second accent colour would talk over the signal colours, which each mean one signal. |

---

## 3a. One measure

**Data may get wide, text may not — and the container is the same either way.**

Until 2026-09-11 that first sentence was implemented as a width *per page*: the shelf
110rem, the map 90rem, the dig and wantlist 80rem, basket and places 48rem, "what is new"
36rem — each centred. The reasoning was right and the level was wrong.

**What it did on screen**, reported with a stack of screenshots: clicking through the five
collection tabs moved the whole page sideways every time. Five tabs, four widths. And the
navigation bar sat at 48rem, so it lined up with the content on no page at all — six
different left edges across thirteen screens.

A width belongs to an **area**, not to a page. Two views of the same collection must not be
a house move. So:

> **One container, always.** `.fid-page` — 110rem, centred, `px-6`. What has to stay
> narrow gets its measure **inside**, and there is exactly **one** narrow measure: 48rem,
> **anchored left**.

Two measures, then, not six: the container that the navigation bar shares, and the column
that a basket or a legal page sits in. Measured at 1800 px: the wide screens share one left
edge, the narrow ones share another, and neither moves.

**The narrow half was the quieter half of the problem.** Even among the narrow screens there
were four widths — 48rem for the basket, places and the legal pages, 42rem for the setup,
36rem for "what is new" and for in-store. Centred, the width *is* the left edge; four widths
are four edges, only noticed more slowly.

| | |
|---|---|
| `.fid-page` | the measure plus the page padding — everything |
| `.fid-page-flush` | the same measure, no padding: the start page, whose cover rails deliberately run to the edge and carry their own `px-6` |
| no measure | `/stack` alone. There the card *is* the page; a frame around it would be a frame around something meant not to have one |

110rem because the shelf genuinely needs it: eight covers in a row are the screen this app
is built for. On a laptop it amounts to "window minus margin".

**Inside, text still stays narrow.** `max-w-prose` on every paragraph and every reason
sentence, even in a 1400 px card. Nobody reads a 200-character line twice.

**Anchored left, since 2026-09-12.** The first version centred the narrow column, and the
next stack of screenshots showed why that was not enough: the title of "On watch" stood
500 px to the right of the title of "Shelf", one tap apart. A centred column moves its left
edge with its width; a left-anchored one starts where every wide screen starts. The empty
right half on a monitor is the price, and it is the smaller one.

**One head, one distance.** The same stack of screenshots showed four distances from the
bar to the title — `py-4`, `py-6`, `py-10`, `py-16` — and on two collection views the tabs
above the title. Both now live in one place each: `AppPage.vue` is the frame (the measure,
the distance, `gap-8`, `narrow` for the reading column) and `PageHeader.vue` the head, in one
order everywhere — the area as the `h1`, the area's tabs, the view's own name as the `h2`
where it has one, the lead. Six views of the collection, six identical heads.

**The rhythm is 8 · 16 · 32 · 64 (M26.1).** The distance from the bar to the head is the
largest interval: 32 px on a phone, 64 on a desk (`py-8 md:py-16`, held by the guard). The
head's own gaps are 16, sections stand 32 apart. And two frames went: the tabs are a line
with the current one underlined in the accent, like the main bar; a field is a baseline
(`.fid-field`), not a box, so a button and a field no longer look the same.

`tests/unit/one-measure.spec.ts` holds all of it: every page uses the frame or the class,
no page sets a second width or a second distance beside it, the navigation bar, the footer
and the two frames are included, and no narrow block centres itself again.

---

## 4a. Text

**The number first, the reasoning one click away.**

This app explains itself — that is deliberate, because a number without its denominator is an
assertion, and docs/00 is built on making none. Only the explanation had landed *before* the
number: four lines about how the lift is computed, and then the lift.

`<WhyNote>` is the answer. The paragraph stays and moves behind a disclosure: somebody
reading the screen for the third time skips it; somebody wondering where a number comes from
is one click from the answer. Technically `<details>`/`<summary>` — keyboard-operable,
announced by screen readers, works without JavaScript.

**What stays inline, and why:**

| Stays | Reason |
|---|---|
| Warnings before destructive actions | A warning belongs in front of the button, not behind a disclosure |
| The privacy page | A legal page *is* body text |
| Explanations for **missing** data ("prices older than six hours") | Explains the gap exactly when it is there |
| Empty states | There is nothing else on screen anyway — but a sentence, not a paragraph |

**The measure:** body text of ≥ 70 characters visible at first glance is counted. During the
tidy-up in August 2026: 61 blocks / 8,276 characters → 55 / 6,916. What disappeared was not
the thought but its position.

---

## 5. Motion

- 150–250 ms for UI feedback, 300–400 ms for layout/page changes — as two tokens,
  `--fid-motion-feedback` (180 ms) and `--fid-motion-layout` (320 ms), and no other
  duration anywhere. `main.css` and every progress bar read them; a component that writes
  `duration-300` is writing a third value.
- Motion serves orientation and causality, not decoration
- No motion library. The detail sheets use a same-document View Transition, the cards
  CSS transitions, and that is the whole inventory. `motion-v` stood here until
  2026-09-11 and was never installed.

```css
@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) { animation: none !important; }
}
```

> ⚠️ `prefers-reduced-motion` means **reduce, not remove**. Opacity crossfades and instant
> state changes stay — parallax, large translations, scale and scroll-driven effects go.

---

## 6. Accessibility

**The target: WCAG 2.2 Level AA.** That is the operative standard — WCAG 3.0 is, per the W3C
draft of March 2026, "an incomplete draft" and years away.

> ⚠️ **The legal context in DE/EU:** the European Accessibility Act and the German **BFSG**
> have been in force since **2025-06-28** and cover the private sector, expressly including
> e-commerce services. The technical standard: **EN 301 549**, which incorporates WCAG 2.x
> AA.
> **The micro-enterprise exemption:** < 10 employees **and** ≤ €2m turnover → exempt from the
> BFSG service obligations. A private tool for friends clearly falls under it. **Build to AA
> from day one all the same** — getting accessibility into a dense filter/table UI afterwards
> is brutal.

> **`.fid-action` is mandatory** on every control that looks like a text link and behaves
> like a button — "still there?", "empty the basket", "remove", "back". A line of 14 px text
> is 21 px tall: it looks right and misses the limit by three. axe has **no rule** for target
> size, and the eye has no ruler — so `tests/e2e/smoke.spec.ts` measures every screen at
> 375 px.
>
> Links **in the middle of body text** are exempt under the criterion and do not get the
> class; `inline-flex` would shift the baseline there. A checkbox inside its own `<label>` is
> as large as the label — the label *is* the target.

> **Container queries need a container.** `@sm:`, `@md:` and relatives measure against the
> nearest ancestor with `@container` — if there is none, the rule **never** applies, with no
> error and no warning. That was exactly the case: apart from `MatchCard`, not one of these
> rules had a container, so the large screen went unused. Every page that is meant to be
> responsive sets `@container` on its `<main>`.

### The WCAG 2.2 criteria that hit this app specifically

| SC | Criterion | Where it bites |
|---|---|---|
| 2.4.11 | Focus Not Obscured | The **sticky filter bar** covers focused rows → `scroll-margin-top` |
| 2.5.8 | Target Size 24×24 | Signal chips, row actions in compact mode, **text links that are actions** |
| 2.5.7 | Dragging Movements | If basket sorting is by drag → a keyboard alternative is mandatory |
| 3.2.6 | Consistent Help | The entry point to help is the same everywhere |
| 3.3.7 | Redundant Entry | Do not make people type the dealer name twice |

### Implementation

- The score ring: `role="img"` + `aria-label="Barry Score 91 of 100 – Side One, Track One"`
- Signal colours are **never the sole carrier of meaning** — always with a label (SC 1.4.1)
- Scan progress in `aria-live="polite"`, throttled to at most 1 announcement per 10 s
- Virtualised lists: `aria-rowcount`/`aria-rowindex`, so screen readers know the total
- A focus trap in the detail sheets, `Escape` closes them, focus returns to whatever opened
  them — all three in `SheetFrame.vue`, since 2026-09-11; before that this line was a promise
- Contrast: every text-on-signal-colour pair via `contrast-color()` or checked by hand
- **Automated:** `@axe-core/playwright` in the E2E suite. **Manual:** one keyboard pass and
  one VoiceOver pass per release. Automation finds ~30–40 %.

---

## 7. PWA

| Aspect | As of August 2026 |
|---|---|
| **iOS installation** | Safari 26 has **dropped all installability requirements** — any website opens as a web app from the home screen. But: **no `beforeinstallprompt` on iOS.** A manual coach mark "Share → Add to Home Screen" is needed. |
| **Push** | **Does not exist.** Web Push needs an application server, which we deliberately do not have (ADR-007). The substitute: a check at app start, the Badging API, a banner with the news since the last visit. |
| **Background Sync** | ⚠️ **Chromium-only, not Baseline** (Safari: no). **Do not build a flow on it.** An IndexedDB outbox of our own, drained on `online`/`visibilitychange`. |
| **Storage eviction** | WebKit clears site data after ~7 days of inactivity — **installed home-screen apps are exempt.** Another reason to push for installation. |

**The offline strategy**

| Data | Strategy |
|---|---|
| App shell | Precache (`generateSW`) |
| Collection/wantlist | IndexedDB — the only place it lives anyway, offline is the normal case |
| Dig results | IndexedDB, **with a visible timestamp** ("as of 09:14") |
| Covers | CacheStorage, stale-while-revalidate, an LRU cap of ~200 MB |
| Prices | Network-first. Quietly ageing prices are worse than an honest label. |

**Is a PWA a substitute for a native app?** For this app specifically: yes, comfortably. It is
a networked, list-heavy data-browsing app — the archetype the web does best. The real
remaining gaps: a worse install funnel on iOS, no app store, no background sync, no NFC on
iOS. None of that is a blocker for Fidelity.

---

## 8. Screens (v1)

| # | Screen | The core |
|---|---|---|
| 1 | **Championship** (dashboard) | A snapshot of the collection, saved dealers with affinity, recent digs, watchlist news |
| 2 | **A new dig** | Dealer input + the advance check ("43,234 listings — we can manage 20,000") |
| 3 | **A dig running** | Progress with real numbers, the first matches flowing in |
| 4 | **Dig results** | Top Five at the top, then the full list, a filter bar, signal chips |
| 5 | **Release detail** (sheet) | Every signal, the catalogue run grid, a price comparison, pressing information |
| 6 | **The basket** | Shipping tiers, marginal costs, candidate suggestions, deep links to Discogs |
| 7 | **The Clerk's Take** | The dealer profile: fingerprint, affinity, price positioning |
| 8 | **Your map** | The collection profile: labels, decades, styles, gaps |
| 9a | **Your shelf** | A cover grid, 3 columns on a phone up to 8 on a monitor, search and sorting in the worker |
| 9 | **In-store** (mobile only) | Large touch targets, offline, the dig list by score, **collection + wantlist searchable** ("have I got this already?") |
| 10 | **Settings** | Account, collection, horizon, credits, hub, data export — everything you set up once |

### Navigation (added after M9)

Five areas, in the order you move through them:
**Start · Dig · Basket · Collection · Shops**, plus a gear for the settings. On the desktop a
bar at the top, on a phone a fixed bar at the bottom within thumb reach.

> **Why at all:** until M9 the jump-off points sat as buttons *inside* the sync panel, and the
> dashboard carried nine equally weighted panels — from "last dig" to "delete everything". A
> screen on which everything looks equally urgent does not answer the question "what now?".
>
> **In-store is deliberately not a tab.** That is a *mode* you enter with a record in your
> hand, not an area to browse — reachable from the start page and from the dig result, which
> is where that decision is made.
