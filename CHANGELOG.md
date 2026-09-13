# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
dieses Projekt folgt [Semantic Versioning](https://semver.org/lang/de/).

Für eine App bedeutet SemVer:
**MAJOR** = Breaking Change am IndexedDB-Schema ohne automatische Migration ·
**MINOR** = Features · **PATCH** = Fixes.

## [0.67.0](https://github.com/misterhonk/fidelity/compare/v0.66.0...v0.67.0) (2026-09-13)

**Three small things a first quarter of an hour asked for.**

In a compartment's "Fill", "All" now means all: every record the list holds, not just the
rows on screen, and the button says the true number. A record's sheet says why the rule
proposes a compartment — "A2 · C–D, by artist" — not just the coordinate. And if you have
not built the horizon yet, the wantlist tells you what that would do for you and where to do
it, instead of a sentence about it in the app's own words.

**What to do:** Nothing.


### Added

* **collection:** "All" means all, the divider on the sheet, the horizon explained once (M28 [#4](https://github.com/misterhonk/fidelity/issues/4) [#5](https://github.com/misterhonk/fidelity/issues/5) [#6](https://github.com/misterhonk/fidelity/issues/6)) ([6ac368b](https://github.com/misterhonk/fidelity/commit/6ac368b53fcaa3e242bc2f39c1979c84bf3abcdf))

## [0.66.0](https://github.com/misterhonk/fidelity/compare/v0.65.1...v0.66.0) (2026-09-13)

**From the shelf straight into a compartment, and keys on the wall.**

On the shelf, tap "Select": the sleeves become things to tick. "Put n in …" opens the wall
small — every piece of furniture as a little grid, a button per compartment — and one tap
puts the ticked records there. The line at the bottom has "Undo", and it puts each record
back exactly where it was, in a compartment or in no place at all.

On the wall, the keyboard does more: `M` opens the focused compartment on "move all", a
letter jumps to the compartment whose divider covers it — press W and you are in W — and
Home and End go to the corners.

And there is a demo account now: a second Discogs collection that testers can look at without
showing their own, synced every night against the live app.

**What to do:** Nothing. On the shelf, try "Select".


### Added

* **collection:** keys on the wall, and "put n in …" from the shelf (M27.5) ([76d2d8d](https://github.com/misterhonk/fidelity/commit/76d2d8df178e65f1a77dfd1cd54d8c892c18bdaa))
* **demo:** the demo account — a script that fills it, and the smoke run that syncs it ([297f9ec](https://github.com/misterhonk/fidelity/commit/297f9ec1f92f1530ede2a48effbefbf8c079b2c5))

## [0.65.1](https://github.com/misterhonk/fidelity/compare/v0.65.0...v0.65.1) (2026-09-13)

**A shop's profile opens at once, even when Discogs is slow.**

Opening a shop for the first time fetched its logo from Discogs — and the whole profile
waited for that one request. When Discogs was rate-limiting, that wait could be a minute
on a screen that has everything else on your device already. The logo is still fetched, but
in the background: the profile opens immediately, and the shop's picture appears in the list
a moment later.

Under the hood, the browser tests no longer talk to Discogs at all; that was the cause of
most of the red runs on CI.

**What to do:** Nothing.


### Fixed

* **dealers:** a shop's profile no longer waits for its logo ([2b103a1](https://github.com/misterhonk/fidelity/commit/2b103a1a0a9fc896b50d62b02e742209bcbdf590))

## [0.65.0](https://github.com/misterhonk/fidelity/compare/v0.64.0...v0.65.0) (2026-09-12)

**Drag on the wall: a sleeve onto a compartment, a compartment onto another, furniture into a room.**

With a mouse, a sleeve lifts after a few pixels. With a finger, hold it for a moment — the
phone buzzes once — and then drag; until then a finger is scrolling, and scrolling wins. A
sleeve from the open compartment lands on any cube of the wall behind it, and if you had
ticked several, they all go together. Drag a whole compartment onto another and everything in
it moves. Drag a piece of furniture by its name onto a room, or onto "Furniture without a
room". Every drop leaves a line at the bottom of the window with "Undo".

**What to do:** Nothing. Open Collection › Places and try it.


### Added

* **collection:** drag on the wall — sleeves, compartments, furniture (M27.4) ([9a64ebf](https://github.com/misterhonk/fidelity/commit/9a64ebff6a620027d83e8d3c19bfa2472cb85d3f))

## [0.64.0](https://github.com/misterhonk/fidelity/compare/v0.63.0...v0.64.0) (2026-09-12)

**Re-sort a compartment: tick, move, take out — and undo.**

Open a compartment and tap "Select": the sleeves become things to tick. "Move n to …"
opens the wall small — every piece of furniture as a little grid, a button per
compartment with its coordinate and its divider, the rooms underneath — and one tap moves
the ticked records there. "Take n out" empties them onto the pile of the unplaced. Every
move leaves a line with "Undo" that puts the records back where they were.

**What to do:** Nothing. Open Collection › Places, tap a compartment, then "Select".


### Added

* **collection:** select in a compartment, move to the wall, take out, undo (M27.3) ([a4980c1](https://github.com/misterhonk/fidelity/commit/a4980c1e6fed7cbf06c18b1b992521dc184b2106))

## [0.63.0](https://github.com/misterhonk/fidelity/compare/v0.62.0...v0.63.0) (2026-09-12)

**A shelf sorts itself — when you say so — and a compartment opens beside the wall.**

Every piece of furniture has an order now: by artist, by label, by year, by arrival, or by
hand. Tap "Sort in" and Fidelity shows what it would do — how many records would move, how
many would come in from the pile of the unplaced — and nothing happens until you tap
"Apply". Then the records are dealt evenly across the compartments in reading order, and the
dividers appear on the wall the way you would pencil them: A–B, M–O, and where two
neighbours would read the same, a letter more. A record's own sheet reads the dividers and
suggests the compartment it belongs in, one tap away.

And a compartment no longer opens under the wall: it slides in from the right, like a
record's sheet, with its address, "Fill", "Move all" and its sleeves. Escape closes it even
when a button inside has just disabled itself.

**What to do:** Nothing. To try the rule, open Collection › Places, pick an order under a
piece of furniture and tap "Sort in".


### Added

* **collection:** a compartment opens off the canvas (M27.1d) ([4f1f674](https://github.com/misterhonk/fidelity/commit/4f1f6743dc82a1bb05585b1d39a0626f24274b8c))
* **collection:** the rule — sort a shelf by artist, label or year (M27.2) ([ba6ec8d](https://github.com/misterhonk/fidelity/commit/ba6ec8d9b28cd46f467bdb3fcf2018afdd89acf9))


### Fixed

* **ui:** Escape closes a sheet even when the focus has fallen out of it ([403b41d](https://github.com/misterhonk/fidelity/commit/403b41d65794ec7fc3d7774d928dfd5612d6e8d4))

## [0.62.0](https://github.com/misterhonk/fidelity/compare/v0.61.0...v0.62.0) (2026-09-12)

**Sorting records in, from the wall.**

Open a compartment and tap "Fill": your collection appears as a list, filtered to what has
no place yet — the pile still to sort in — with a search field and a tick per record. One
button puts the armful into the compartment, and the list shows what is left, so the next
armful follows without leaving the wall. Above the rooms, a line says how many records have
a place and how many are still waiting.

**What to do:** Nothing. To sort in, open Collection › Places, tap a compartment, then
"Fill".


### Added

* **collection:** filling a compartment from the wall (M27.1c) ([d6f1076](https://github.com/misterhonk/fidelity/commit/d6f107691fb3a68e8bf48f02b086eb52e55612e4))

## [0.61.0](https://github.com/misterhonk/fidelity/compare/v0.60.0...v0.61.0) (2026-09-12)

**Your furniture, in its own finish.**

A piece of furniture on the places screen now looks like what it is: walls of white,
black, birch, oak, walnut, steel or cardboard, thin or thick, and a colour where the
furniture has one. The presets bring their own — a Kallax comes white and thick, a Billy in
birch, a USM Haller in steel with ruby red panels, a Tylko, a stocubo, the HHV record box in
cardboard — and every one can be changed, before saving and after. Nothing is loaded for
it; the walls are drawn. And the compartments list as A1, A2, A3, B1 now, the way a list
reads.

**What to do:** Nothing. Tap "Finish" on a piece of furniture if you want it to look like
yours.


### Added

* **collection:** the look of the furniture — material, thickness, colour (M27.1b) ([47a8191](https://github.com/misterhonk/fidelity/commit/47a81918bc0bba87c5427c3197eed797334dfeae))

## [0.60.0](https://github.com/misterhonk/fidelity/compare/v0.59.0...v0.60.0) (2026-09-12)

**The wall: where a record stands, in three words.**

A place used to be a name in a list. Now a room holds furniture, furniture holds
compartments, and the places screen draws it as the wall it is. Add a Kallax 2×2 to 5×5, a
crate, a 7" box, a pile or a grid of your own, and its compartments appear at once, named
by their coordinate read from the front — A1 top left, like a spreadsheet. Each shows how
full it is, and the first sleeves in it; tap one and its records appear as covers. A record's
own sheet lists the compartments and reads the address back: living room · Kallax · B2.
Everything you had stays: your places are rooms now, and a record with a place keeps it.
Nothing leaves the device.

And a bug that only Safari could see: every request to the app's worker ran twice there,
which idempotent work had hidden for months. It runs once now.

**What to do:** Nothing. If you want the wall, open Collection › Places and add furniture
to a room.


### Added

* **collection:** the wall — places with furniture and compartments (M27.1) ([a80312e](https://github.com/misterhonk/fidelity/commit/a80312e52a6a7542f376a41a8e6d634bca48e392))


### Fixed

* **pwa:** the worker listens once, even where WebKit runs its entry twice ([9e9270b](https://github.com/misterhonk/fidelity/commit/9e9270b772dd7ef27af72530e6bd6092af331d51))

## [0.59.0](https://github.com/misterhonk/fidelity/compare/v0.58.0...v0.59.0) (2026-09-12)

**Sixty words, one door, and a find that keeps its name.**

Every screen now says what it has to say in sixty words above the fold, and a browser
test holds it there: leads got shorter, explanations moved behind "Why?", and the wantlist's
plan is a line instead of a box. The hub screen has one field for the way in — an access
key or the shared secret of your own hub — and the app reads which one you typed: a key
starts with "fk1." and opens a hosted hub and catalogue, anything else is a secret. The
Access screen is folded in; its old address leads to the hub.

And a bug from the first month: seven hours after a dig, a find on the start screen read
"Release 3189681" and its sheet had no title. The six-hour rule stripped the record's
name with the price. The name is a catalogue fact, not marketplace data, and it stays now —
condition, price, seller comments and the market statistics still go on time.

**What to do:** Nothing. If you had an access key under Settings › Access, it is on the hub
screen now, unchanged.


### Added

* **ui:** sixty words above the fold, and one door — M26.3 ([6176d97](https://github.com/misterhonk/fidelity/commit/6176d97583bf9cb1fc6acdd3888a71e8a07b13cc))


### Fixed

* **dig:** a find keeps its name past the six hours ([06bd87e](https://github.com/misterhonk/fidelity/commit/06bd87ed0f75472728d30028ed16d0c0f8c97ff4))

## [0.58.0](https://github.com/misterhonk/fidelity/compare/v0.57.0...v0.58.0) (2026-09-12)

**The sleeve carries the card.**

A find used to be a thumbnail on a form: seventy-two pixels of cover beside eight lines
of text. Now the cover takes forty per cent of the card on a tablet or a desk and the full
width on a phone, the signals are one small line above the title, the title stands in the
display face with the artist over it, the facts are set like a type plate, and the sentence
— the reason, which is the product — keeps its width. The score and the price close the
card; the actions sit under it. No frame around any of it: sleeves in a crate separate
themselves.

The shelf shows six across by default, with "Larger" and "More" to choose between the
sleeve size and the crate, remembered per device. The rails on the start screen grew, the
wantlist card carries a proper sleeve, and the record sheet takes its colour from the cover
behind it. Nothing is fetched that was not fetched before, and no score moves.

**What to do:** Nothing. If you liked eight across, tap "More" on the shelf once.


### Added

* **ui:** the sleeve carries the card — M26.2 ([beadf69](https://github.com/misterhonk/fidelity/commit/beadf69676099676a37627c24e6889e53fc28395))

## [0.57.0](https://github.com/misterhonk/fidelity/compare/v0.56.1...v0.57.0) (2026-09-12)

**One voice, plates instead of boxes, and two new faces.**

The head of every screen now speaks once, and loudly: the area's name in the display face
at forty to seventy-two pixels, the one size that exists nowhere else. Under it, what a
field is — the tabs, the terms, the line of facts — is set like the type plate on the back
of an amplifier: mono, small, spaced capitals. The tabs lost their box and became a line
with the current one underlined, like the main bar; a field sits on a baseline instead of
in a frame, so a button and a field no longer look the same. The distance from the bar to
the head is one number, and the rhythm below it is 8, 16, 32, 64.

Two faces changed with it, both from Fontshare and self-hosted as before: Cabinet Grotesk
carries the head, JetBrains Mono the plates and figures; Switzer stays for everything you
read. Four sets were tried on the shelf before this one was picked.

**What to do:** Nothing. The fonts arrive with the update.


### Added

* **ui:** one voice, plates instead of boxes — M26.1 ([1480ac4](https://github.com/misterhonk/fidelity/commit/1480ac436d923764526bd23038994acd1cc5dd86))
* **ui:** the Plate set — Cabinet Grotesk and JetBrains Mono, from Fontshare ([f0fe57d](https://github.com/misterhonk/fidelity/commit/f0fe57d9a5022e12a4e2f941aa819018a642c05a))

## [0.56.1](https://github.com/misterhonk/fidelity/compare/v0.56.0...v0.56.1) (2026-09-12)

**Every screen starts in the same place, and the Support screen waits for a way to pay.**

Tap through the collection — shelf, map, wantlist, on watch, places, year — and the
heading used to jump: four different distances from the bar, two widths, and on two of the
views the tabs above the title instead of under it. Every screen now stands in one frame,
at one distance from the top, with its title at the same left edge, and every head reads
the same way down: the area, its tabs, the view's own name, the lead.

Settings › Support listed plans and tips with nothing behind them. A price list nobody can
pay is a promise the app cannot keep, so the screen is out until there is a way to pay; the
access key and the beta are unchanged.

**What to do:** Nothing.


### Fixed

* **ui:** one frame and one head for every screen ([9055d58](https://github.com/misterhonk/fidelity/commit/9055d58dd489dbb36a4282f1df1aa3fffeee670e))
* **ui:** the Support screen goes until there is a way to pay ([de865b3](https://github.com/misterhonk/fidelity/commit/de865b3350ac9fd5cd9359d691f02a462631ec8f))

## [0.56.0](https://github.com/misterhonk/fidelity/compare/v0.55.0...v0.56.0) (2026-09-12)

**A page that says what this is beside the others, and a privacy notice that names every door.**

Every app in this niche publishes a "best vinyl apps" post and lists the others, and this
one appeared in none — there was no page to link to. Now there is: "Compared", in the
footer, in both languages, open to somebody who does not have the app yet. Seller Matches,
discdogs, WaxTracker, Groovv, Enhancer, the cover scanners, Vizcogs — what each does, and
what Fidelity does instead, one app at a time so it reads on a phone.

The privacy notice has two more headings it should have had for a while: a catalogue you
enter sees the ids and the barcode or run-out it is asked about, and an access key travels
with every hub and catalogue call — standing for a plan, never for a Discogs account. The
test that holds the notice against the code now watches the catalogue client as well, so the
next door gets its heading before anybody reads through it. And the README says the one
thing the licence does not give away: the name.

**What to do:** Nothing. If you run a catalogue or use an access key, the notice now says
what that means.


### Added

* **ui:** the page beside the others, and two more places the notice names ([faad359](https://github.com/misterhonk/fidelity/commit/faad35915df9424dc424fe19337958af14db7dc5))

## [0.55.0](https://github.com/misterhonk/fidelity/compare/v0.54.1...v0.55.0) (2026-09-12)

**A backup can be read back in, the update is quiet, and a stranger's afternoon is tested.**

"Read a backup back in" on the data screen brings the shelf, the wantlist, the shops, the
basket, the ratings and the places back from the file "Export everything" wrote — merged
into what is there, not over it. The digs stay out: the file never had their prices, and a
dig without them is a heading over nothing. The file now says which database version wrote
it, and a very old one asks for a sync instead of guessing at its rows.

A new version no longer waits behind a banner: it loads by itself the next time the app
moves between two screens, unless a dig is running — then it waits, and only after a quarter
of an hour asks. What's-new may carry one "What to do:" line, drawn so it is not lost. And
the promise this app makes to a stranger — token, collection, first dig, no document read —
is now a browser test that starts from an empty device.

**What to do:** Nothing. The next update after this one arrives on its own.


### Added

* **pwa:** the way back, the quiet update, the stranger's afternoon ([97b2e7f](https://github.com/misterhonk/fidelity/commit/97b2e7f9b0a3f769a890c38ee6882b643e46d5da))

## [0.54.1](https://github.com/misterhonk/fidelity/compare/v0.54.0...v0.54.1) (2026-09-12)

**The hub's backup works behind a read-only mount — by not using one.**

The first nightly copy on the home lab failed: SQLite in WAL mode needs to write its
shared-memory file even to read, and the hub's volume was mounted read-only for the copy.
Both compose files mount it writable now, a failed copy no longer leaves an empty file for
the drill to trip on, and the drill says when a copy is not a hub.


### Fixed

* **hub:** the backup mounts the hub writable — WAL needs the shm file even to read ([0bed122](https://github.com/misterhonk/fidelity/commit/0bed1224292b67a2cba103279baa659bc09c1625))

## [0.54.0](https://github.com/misterhonk/fidelity/compare/v0.53.0...v0.54.0) (2026-09-12)

**The staging ring: a nightly smoke run, a load test, backups, release channels.**

Nothing in the app changes with this release. Around it: a smoke suite asks the home lab's
public name every night what a person would every morning — the app loads, the hub names
its doors, the catalogue answers with a build that is not stale and knows a family, the
shop identifies a barcode. A load test measured the catalogue on the real build at about
1,750 requests a second past the proxy, eight times the target. The hub's file is copied
once a day and a drill proves the copies are worth something. The catalogue's health says
`stale` after forty days without a build, for a monitor to read. A `Promote` workflow points
a `stable` channel at a release, and a compose file with Caddy runs the whole stack on one
cloud box, walked through in ten steps in the deployment doc. The Support screen's prices
stand in their own column.


### Added

* **deploy:** the staging ring — smoke run, load test, backups, channels, the cloud compose ([524920d](https://github.com/misterhonk/fidelity/commit/524920ddf60984bbc66cffdd0ebc43e6d90bc044))


### Fixed

* **deploy:** the smoke suite stays out of the ordinary browser run ([d579d39](https://github.com/misterhonk/fidelity/commit/d579d398e1677f6404f8a6f9931973495087cae0))
* **ui:** the Support screen's price stands in its own column ([c6d64ea](https://github.com/misterhonk/fidelity/commit/c6d64ea2725868005b3046bde78a62f6e2bb6389))

## [0.53.0](https://github.com/misterhonk/fidelity/compare/v0.52.0...v0.53.0) (2026-09-12)

**The hub's second door — and three things a phone showed.**

A hosted hub needs to tell its members apart without knowing who anybody is on Discogs.
From this release it takes access keys: signed statements with a tier and an end date,
verified with a public key and nothing else, one per payer, expiring on their own and
revocable by a short list. A key opens the member routes and owns its own rows — the vault
and the push registration answer only for it. A self-hoster's hub keeps its shared secret
and never sees a key; both doors may be open at once. In the app, Settings › Access takes
the key and reads its tier and end date, Settings › Support shows the plans and tips —
nothing is charged while Fidelity is in beta, and every key handed out now is a free beta
key. A script issues them by hand.

On the phone: the stack's six buttons no longer push the page sideways — two rows below
640 px; the bottom bar is taller; and the "Start the dig" box goes when a dig is through,
so a finished list no longer reads as "it did not run". "One at a time" and "Share this
list" carry an icon and the weight of what they are.


### Added

* **hub:** the second door — access keys, personal rows, the Access and Support screens ([00d495f](https://github.com/misterhonk/fidelity/commit/00d495f3d9a8b9f0df0e2932a23ab3dd3bf74be9))

## [0.52.0](https://github.com/misterhonk/fidelity/compare/v0.51.0...v0.52.0) (2026-09-12)

**The shop and the map through the catalogue — and the first full build.**

A barcode or a run-out is now answered from the catalogue's index over every identifier in
the dump, with no search request; what the build does not carry falls through to the
search that always was, because a record newer than the dump is not a miss to stop at. The
map shows, behind every decade, style and genre bar the catalogue has a denominator for,
your share divided by the catalogue's — the lift its bars carried a slot for since the
first milestone — and one sentence under the bars names the build. Without a catalogue
nothing changes.

And the catalogue exists now: the first full build ran on the home lab in ninety minutes —
19.4 million releases, 250 million rows, 17.5 GB — and the service picked it up within a
minute of the swap, without a restart. A pressing family answers in a quarter of a second.


### Added

* **collection:** the shop and the map through the catalogue — identify, release, stats ([2573e61](https://github.com/misterhonk/fidelity/commit/2573e611f1c78d3a45c31bc8e8235dfc5adcee78))

## [0.51.0](https://github.com/misterhonk/fidelity/compare/v0.50.0...v0.51.0) (2026-09-12)

**Hand the basket over to Discogs, one listing at a time.**

The Discogs cart is not in the API — neither to read nor to fill, measured — and the
website's form is not ours to post to. What can be made short is the way there: "Put these
in at Discogs" on a shop's basket card opens a panel with the next listing as a link; the
tap opens its page with the "Add to Cart" button and the next one moves up. Which lines are
done is remembered on the item itself, so a closed tab or a reload loses nothing, and at the
end stands the link to the cart. "Still there?" is recommended before it, not forced.


### Added

* **basket:** hand the basket over to Discogs, one listing at a time ([c100b6d](https://github.com/misterhonk/fidelity/commit/c100b6d08db9284b0506be69b71ce16a4bb46125))

## [0.50.0](https://github.com/misterhonk/fidelity/compare/v0.49.0...v0.50.0) (2026-09-12)

**The signals through the catalogue: a label of any size, a person's whole credits.**

The horizon build now asks the catalogue before the hub and the API, per candidate. A label
comes whole instead of cut off at 1,500 releases — Blue Note's 4000s, Impulse!, Verve — a
person's whole credit list comes with the names they go by, and a master's versions come
with their years, all for zero requests and dated by the monthly build. The catalogue hands
over rows and the app packs them with its own packer, so a run computed from the dump and
one computed from the API are the same bytes for the same rows. A second golden test runs
the golden dig with every chunk arriving through the catalogue and pins the ranking
identical to the API-built one, score for score: the catalogue may add hits, never move a
score. With the address empty, which it is on every device, nothing changes.


### Added

* **horizon:** the signals through the catalogue — a label of any size, a person's whole credits ([a52b9cf](https://github.com/misterhonk/fidelity/commit/a52b9cf733bf5eec218115f07d7e8465560ead93))

## [0.49.0](https://github.com/misterhonk/fidelity/compare/v0.48.0...v0.49.0) (2026-09-12)

**The catalogue answers: a master's family and a person's names.**

The service is the hub's shape without the door — read-only on the current build, no
secret, the build date on every answer as its ETag — and it follows the monthly swap
without a restart. Two routes to begin with, the two the app already asked the API for:
every pressing of an album, oldest first, and every other name a person goes by. The shop
screen's pressing family and the horizon's lexicon ask the catalogue first and spend the
request only when it does not know; with the address empty, which it is on every device,
nothing changes. The worker's size ceiling goes from 35 to 40 kB, and docs/12 says why.


### Added

* **hub:** the catalogue's first two routes — a master's family, a person's names ([5e4b5b0](https://github.com/misterhonk/fidelity/commit/5e4b5b002f0bee3c142b5acd2954edafcd1320da))

## [0.48.0](https://github.com/misterhonk/fidelity/compare/v0.47.0...v0.48.0) (2026-09-12)

**Renew the token without losing the shelf — and the dig page says which shop is scanning.**

Two things a phone taught on the same day. Discogs stopped accepting a token, and the only
way to enter a new one was to sign out, which deletes the database: thirteen minutes of
horizon, every dig and every rating for a key that takes ten seconds to make. Now the
account screen has "Renew the token": it checks the new key the way sign-in does, and if it
belongs to the same account it replaces the old one and nothing else moves. A key for
another account is refused and the old one stays.

And "A scan is already running" was the whole message, most often after leaving the dig
page mid-scan and coming back — the scan had carried on in the background, and the page
knew nothing of it. It attaches now: the shop's name stands over the bar, the numbers keep
moving, the buttons wait, and the result appears when it is through. The refusal, where it
is still one, names the shop.

The catalogue build's first full run on the home lab died 90 seconds in on a label without
an id; it skips those now and survives a single entity the database refuses.


### Added

* **auth:** renew the token without losing the shelf ([bc5cbde](https://github.com/misterhonk/fidelity/commit/bc5cbde6ec92904dad3c481ac145e3fc4b44d2a4))
* **dig:** the page says which shop is scanning, and attaches to a scan it did not start ([6af2dd8](https://github.com/misterhonk/fidelity/commit/6af2dd841dde02c01ade2a8b585c9e2ead9e5e6e))


### Fixed

* **hub:** the catalogue build survives a label without an id ([19a3649](https://github.com/misterhonk/fidelity/commit/19a3649e7d84617a4627497e9edc2b17fc1476b8))

## [0.47.0](https://github.com/misterhonk/fidelity/compare/v0.46.0...v0.47.0) (2026-09-12)

**The catalogue's monthly job, in one image.**

Again nothing in the app changes. `fidelity-catalogue` is a new image beside the app's and
the hub's: once a day it looks at data.discogs.com, and a new month is fetched with every
file hashed against the checksum file, built beside the old one, checked against its row
counts, and made current by an atomic symlink swap — a reader opens the old build or the
new, never half of either. Two builds stay; each dump file is deleted the moment its rows
are in, because the home lab's disk is the tight resource. `status.json` says what the last
run did. Self-hosters find the service in `deploy/compose.homelab.yml`; it needs the open
internet and real disk, and leaving it out changes nothing else.


### Added

* **hub:** the catalogue's monthly job — fetch, build, check, swap, in one image ([125c8a2](https://github.com/misterhonk/fidelity/commit/125c8a2d922720ebb1ad7293962b491bc4b8d941))

## [0.46.0](https://github.com/misterhonk/fidelity/compare/v0.45.0...v0.46.0) (2026-09-12)

**The catalogue's build, proven on a cut of the real dump.**

Nothing in the app changes with this release — the work is beside it. `catalogue/` is the
second service next to the hub: a reader that streams a Discogs dump one entity at a time
whatever its size, a shaping from entity to the tables of docs/16, and a build that puts the
four monthly files into one SQLite file, checking the row counts against last month's. The
fixture is four hundred real releases and exactly the masters, labels and artists they name,
cut from the dump of 2026-09-01; nineteen tests build it in a third of a second, and golden
files freeze every catalogue number, identifier, credit string and name in it. A twin test
holds the copied `parseCatno` and `norm` to the app's own, so a label run computed on the
server can never disagree with one computed in the browser. The hub's and the catalogue's
test suites now run in CI — the hub's never had.


### Added

* **hub:** the mini-dump — the catalogue's ETL, proven on a cut of the real dump ([b42ccb5](https://github.com/misterhonk/fidelity/commit/b42ccb56d58a6d0bda69bedd4b4055652b6e6c42))

## [0.45.0](https://github.com/misterhonk/fidelity/compare/v0.44.1...v0.45.0) (2026-09-12)

**The seam for the catalogue — nothing runs behind it yet.**

Discogs publishes its whole database once a month under CC0. A catalogue service that has
read it can answer what the API answers slowly or not at all: every pressing of an album at
once, every record a producer touched, a barcode without a single request. This release
is the first phase of ADR-013: the port the app talks to, a catalogue address under the hub
settings with "Test the connection" and "Look here", and one consumer wired — the pressing
family in the shop asks the catalogue before the hub. With the address empty, which it is on
every device, nothing changes: every shape of absence — never set up, dead, slow, lying,
not knowing — falls through to today's path, and eleven tests hold it there.


### Added

* **hub:** the seam for the catalogue — port, preference, discovery, settings ([c6954f3](https://github.com/misterhonk/fidelity/commit/c6954f3d4d32e55833d25de62ee4a9e3a9b00a63))

## [0.44.1](https://github.com/misterhonk/fidelity/compare/v0.44.0...v0.44.1) (2026-09-12)

**Country names in your language.**

"Aus Germany" on the new origin chip and "aus Germany" on a shop: Discogs writes English,
and the German screens showed it. The same table the country picker uses now translates the
name on the way out — "Aus Deutschland", "aus Großbritannien" — and a name it does not know
stays as written. And the deploy workflow for the retired webspace hub refuses to revive it
by accident.


### Fixed

* **i18n:** country names in the language of the app ([f7f55ed](https://github.com/misterhonk/fidelity/commit/f7f55eda53f33902896506533f89287d6653e2ae))

## [0.44.0](https://github.com/misterhonk/fidelity/compare/v0.43.0...v0.44.0) (2026-09-12)

**The hub check tries the secret — and the secret can be shown.**

"Test the connection" only ever asked the hub's health, which is open on purpose, so it
said "reachable · secured with a secret" to a wrong word just the same; a phone with the
wrong secret read fine while every real request came back 401. The check knocks at a locked
door now and says whether the word opens it. An eye beside the field shows the secret on
request. And the web manifest goes out with its proper type from both nginx and Apache.


### Added

* **hub:** the connection test tries the secret, and the secret can be shown ([8f451cf](https://github.com/misterhonk/fidelity/commit/8f451cf20b139a631d2987e9e7b11d7840284df5))


### Fixed

* **deploy:** serve the web manifest as application/manifest+json ([097a726](https://github.com/misterhonk/fidelity/commit/097a726776581fd8ca11445cd990d9021774d420))

## [0.43.0](https://github.com/misterhonk/fidelity/compare/v0.42.0...v0.43.0) (2026-09-11)

**Rare per the catalogue, and the pressing family through the hub.**

A find now says "Only 3 pressings of this album exist" from five down — the horizon knows
how many pressings a wanted album has, and the scan writes it onto the match. Catalogue, so
it does not expire; a hint under the sentence, never in the score. And the pressing
family the shop screen reads — how many pressings, which came first, on what — is cached on
the hub now, one master at a time: whoever fetched it first saves everybody else the
request, for thirty days. Without a hub everything stays as it was.


### Added

* **dig:** rare per the catalogue — how many pressings an album has, on the find ([7318b46](https://github.com/misterhonk/fidelity/commit/7318b4661ade4e420551dd0e663d4850523dbbac))
* **hub:** pressing families through the hub ([3f5374d](https://github.com/misterhonk/fidelity/commit/3f5374d9dee6c91573478f403cc5907340db23b8))

## [0.42.0](https://github.com/misterhonk/fidelity/compare/v0.41.0...v0.42.0) (2026-09-11)

**The plan box says how it fills.**

Before the first dig the wantlist showed no box at all — and a feature nobody has seen is a
feature nobody uses. Now it is there once there is a wantlist, and without a shop scanned
in the last six hours it says what would fill it, with the way to the dig screen.


### Added

* **collection:** the plan box says how it fills before the first dig ([105f044](https://github.com/misterhonk/fidelity/commit/105f0443408493953e290d15533579ce0bfa9f7f))

## [0.41.0](https://github.com/misterhonk/fidelity/compare/v0.40.0...v0.41.0) (2026-09-11)

**In the shop, the album counts — not only the pressing.**

Type a barcode or a run-out and the answer used to know two things: you have this pressing,
or it is on your wantlist. Measured with a real wantlist, it said "not on your wantlist"
about a record whose album stood on it three lines below, in a different pressing. Every
search row carries the album's master, so the answer has four steps now: you have this
pressing, you have the album in another pressing, this pressing is on your wantlist,
another pressing of the album is. No request — both stores already knew their masters.


### Added

* **dig:** in the shop, the album in another pressing counts ([fa82688](https://github.com/misterhonk/fidelity/commit/fa8268839c292da685e76e6d3671b89d6b401175))

## [0.40.0](https://github.com/misterhonk/fidelity/compare/v0.39.0...v0.40.0) (2026-09-11)

**Only from Germany, or from the EU.**

A ships-from filter has been asked for since 2014, and Discogs has none. Fidelity has three
chips now, on the wantlist's plan and on the shops screen: anywhere, from your country, from
the EU — the customs union of twenty-seven, because customs and postage are what the
question is about. A shop with no origin on record is left out under both and counted, never
hidden. It is a view, in the address; the block list in the preferences stays the rule. Not
on the find list: a dig is one shop, and there is nothing to filter inside it.


### Added

* **dealers:** "only from Germany / the EU" on the plan and the shops screen ([887b1ed](https://github.com/misterhonk/fidelity/commit/887b1edf02fed588d25391a517c99b3581bf9f91))

## [0.39.0](https://github.com/misterhonk/fidelity/compare/v0.38.0...v0.39.0) (2026-09-11)

**How much you want it.**

Discogs keeps a 0–5 per want, and the sync has carried it all along without showing it.
Five stars on every wantlist row now, tapped like the shelf's rating and written back with
the note. "Wanted most" from four up: on the row, on the plan's items — which list the
important ones first — and in the sentence of a find: "Exactly this is on your wantlist —
one of the ones you want most." And "Wanted most" as the second order of the wantlist. The
score did not move: how much you want a record is a fact about you, not about the match.


### Added

* **collection:** how much you want it — the wantlist's priority, shown at last ([13dde62](https://github.com/misterhonk/fidelity/commit/13dde62bbfab4903e1065e099f547c0286e2804d))

## [0.38.0](https://github.com/misterhonk/fidelity/compare/v0.37.0...v0.38.0) (2026-09-11)

**Your wants, across the shops you scanned — with the postage.**

A box at the top of the wantlist: which of your wants the shops scanned in the last six
hours have, the cheapest set of shops that covers them once postage is counted, and the
plan it beats — each where it is cheapest, with its extra parcels. "2 of your 3 wants are at
these shops. Cheapest: 1 shop, €55.50 for the records plus €4.50 postage — €60.00. Each
where it is cheapest would be 2 shops and €10.50 postage — €4.50 more." Labelled as the
subset it is: nobody outside Discogs can search all sellers by record, so this is over the
shops you scanned and nothing else. Exact pressings first, one currency, shops without a
postage table named and left out. With it the nine candidates from the September research
are all in.


### Added

* **collection:** your wants across the shops you scanned, with the postage ([cf14afb](https://github.com/misterhonk/fidelity/commit/cf14afb9461eb2f3cb01cd4834a072afcbf476f4))

## [0.37.0](https://github.com/misterhonk/fidelity/compare/v0.36.0...v0.37.0) (2026-09-11)

**A year on the shelf.**

A sixth collection tab, one year at a time, with the year in the address. What arrived,
by month and against the year before; the artists new to the shelf — their first record
ever; the map's bars over that year's additions: artists, labels, styles, the pressing
decades, the media; the oldest and the newest pressing to arrive; the stars; the digs,
shops, finds and purchases of that year; and who shaped the additions, from the horizon's
credits. All of it read off the device — no request, and nothing from the marketplace.


### Added

* **collection:** a year on the shelf — what arrived, and what it says ([4263d8e](https://github.com/misterhonk/fidelity/commit/4263d8edbcc555c97fb53876b00f4bb66d58c6fd))


### Fixed

* **collection:** say how many new artists the review leaves unnamed ([e08a53e](https://github.com/misterhonk/fidelity/commit/e08a53edb9eec2230fd86061389cfd6a33c2cc65))


### Changed

* **dig:** one medium reader for the pressing family ([51226e8](https://github.com/misterhonk/fidelity/commit/51226e8872ffe9265a228f5fc52083ebc33c29e3))

## [0.36.0](https://github.com/misterhonk/fidelity/compare/v0.35.0...v0.36.0) (2026-09-11)

**Which pressing is this? The record in your hand, among all of them.**

The in-store screen now lists the pressings that share a barcode or run-out — year,
country, label and catalogue number, which one is yours — instead of only saying how many
there are. Pick the one you are holding and it is read against the album's whole family:
"Europe reissue from 2017, not the 1994 original. One of 160 pressings. The first are from
1994:" with the first pressings on the same medium, the marks in the run-out, and the
number etched there for you to compare. A run-out that returns one candidate needs no tap.
Two requests, for one record, nothing stored, no marketplace data — and no hub: the
album's own versions list, sorted by release date, is what pressing advice lacked beyond
the horizon.


### Added

* **dig:** which pressing is this — the record in your hand, among all of them ([50a527e](https://github.com/misterhonk/fidelity/commit/50a527e329d0c3fab2ae54239dcbf58cb92860a8))

## [0.35.0](https://github.com/misterhonk/fidelity/compare/v0.34.0...v0.35.0) (2026-09-11)

**The lexicon: "Miss Dinky" is Dinky.**

The inventory hands over one string per listing and no id, and the string is often not
the name on the shelf. The horizon now fetches, with each artist's discography, every
other name they go by — name variations, aliases, members and groups, one request per
artist — and the matching cascade reads the listing against all of them. An alias counts
as the artist; a member or a group is a related act and never more certain than a
containment match. The sentence says under which name a record was found: "Holger Czukay
is part of Can — you have 5 records by Can, not this one." Artists expanded before today
pick up their names through the daily revalidation slice, a few a day.


### Added

* **match:** the lexicon — aliases, members and groups in the artist cascade ([4623d69](https://github.com/misterhonk/fidelity/commit/4623d699421afbf8851359d5c7cd3bec0c870f76))

## [0.34.0](https://github.com/misterhonk/fidelity/compare/v0.33.0...v0.34.0) (2026-09-11)

**The collection and the wantlist as CSV.**

Discogs' own export leaves out genres, styles, release ids and the master — the four
columns people write scripts to put back. Two files under Settings › Your data now carry
them, plus what is yours alone and what Discogs has no export for: rating, folder, the
three condition fields, and the place a record sits in. No prices and no estimate: read
against the terms they are marketplace data, and a file is passing them on — the same
reason the JSON backup strips them. Every cell quoted, a byte-order mark in front, so a
spreadsheet reads the umlauts.


### Added

* **collection:** the collection and the wantlist as CSV ([70c7ae3](https://github.com/misterhonk/fidelity/commit/70c7ae3f9d2990a3e9bda0adb4c0262ede2abb25))

## [0.33.0](https://github.com/misterhonk/fidelity/compare/v0.32.0...v0.33.0) (2026-09-11)

**A record fair: every stand you scanned today, on the shop screen.**

The scans happen at home in the morning; the fair is several stands in one afternoon. The
in-store screen now offers every shop scanned in the last day — a chip per stand and one
for all of them. All at once is one list by score with the stand named on each row; a
stand whose scan stopped halfway is named too. The stand you picked is in the address, so a
reload in a basement with no signal lands where you were.

A morning's scan is usually past its six hours by the afternoon. It still counts as a
stand: the finds and their reasons stay while the prices go, which the screen already
said. Every basket was its own parcel before and stays so — that is what makes "all at
once" safe. No request anywhere; with one shop scanned nothing on the screen changes.

Phase 4 of the original concept, and the fourth of the M19 candidates.

### Added

* **dig:** a record fair — every stand scanned today, in the shop screen ([f7b04f6](https://github.com/misterhonk/fidelity/commit/f7b04f6c3849949290928237399b456bf1ee0881))

## [0.32.0](https://github.com/misterhonk/fidelity/compare/v0.31.0...v0.32.0) (2026-09-11)

**What the shelf is worth, day by day.**

Discogs shows an estimate of your collection and keeps no history of it. Fidelity now
keeps one: a row per day, written by the same fetch that fills the number on the map, and
from the second day on the map draws it — the middle estimate as a line, the lowest and
highest as a band around it, because a single figure reads as an appraisal and the spread
reads as what it is. Days sit where they fall on the calendar, so a fortnight without a
sync shows as a fortnight, not as one step.

The sync used to ask for the estimate only when the shelf had changed. It now also asks
once a day when nothing changed, one request more per day, because a line that only moves
when you add a record is not a line about the market. The attempt is what is rationed,
not the answer: an endpoint that refuses is not asked again every half hour.

It is Discogs' estimate, labelled as such, kept on this device and in your JSON backup —
never per record, never anybody else's. The third of the M19 candidates.

### Added

* **collection:** what the shelf is worth, day by day ([b40505e](https://github.com/misterhonk/fidelity/commit/b40505edf9323e99eff9d182e7ec060968daefce))

## [0.31.0](https://github.com/misterhonk/fidelity/compare/v0.30.0...v0.31.0) (2026-09-11)

**A shop can be hidden — and shown again.**

"Never show this one again" has been asked for on Discogs since 2015, and it is the one
thing the Enhancer extension puts behind its paywall. Here it is a button on the shop's
profile and a small "never suggest" on every suggestion. A hidden shop is gone from the
shops screen, the start page, the chips under the dig field, the ⌘K palette and the
suggestions, and it is no longer watched — a notification about a shop you asked never to
see would be the app contradicting itself.

It is not gone from a dig you start by name: typing a shop is asking for it, and a finished
scan brings the shop back onto the lists. The hidden ones are listed at the foot of the
shops screen with "Show again", outside the part that empties with the last shop — so
hiding the last one cannot take the way back with it.

The second of the M19 candidates.

### Added

* **dealers:** hide a shop, and show it again ([050ec3a](https://github.com/misterhonk/fidelity/commit/050ec3a5e9b2629ec684d8c36ae62422cf70fe95))

## [0.30.0](https://github.com/misterhonk/fidelity/compare/v0.29.1...v0.30.0) (2026-09-11)

**Every find now says what it costs once it is in the parcel.**

Discogs shows postage only in its cart. So a €4 record from a shop that charges €9 to
ship sorted ahead of a €7 one that would have ridden in a parcel already paid for, and
nothing on the list said so. Beside the price there is now a second number: the price plus
the postage this record *adds* — the whole first tier for the first record, often nothing
for the third — from the same table the basket uses, whether you typed it in, a hub shared
it, the repository carries it, or the shop's own text gave it away. A record already in the
basket is taken out of the count first, or it would pay twice.

The list sorts by it ("With postage ↑") and takes a ceiling ("Up to", postage included);
both live in the address like every other view setting, so a reload and a pasted link keep
them. It is in the shop's currency, not yours — nothing in this app converts one, and the
basket refuses for the same reason. A shop whose postage nobody knows gets neither, and one
line saying why.

This is the first of the candidates under M19 in the roadmap: the wishes Discogs users
have voiced for years, checked against what a browser app may and can do.

### Added

* **dig:** what a record costs with its postage, on the find list ([b55b4c0](https://github.com/misterhonk/fidelity/commit/b55b4c0642cea8cafa437174c9f347599b9a7ebc))

## [0.29.1](https://github.com/misterhonk/fidelity/compare/v0.29.0...v0.29.1) (2026-09-11)

**The whole front end was read against its own design document, and photographed.** Ten
findings, ranked by what a person sees, all fixed in this release.

The in-store screen — the one built for a basement with no signal — read "7 7 finds", and
under seven finished finds it said "No dig yet". Two German fragments were still rendered
inside the English interface: "4 Platten" in the basket, "– hast du" to a screen reader. The
two detail sheets carried the same drawer twice, line for line, and had drifted: neither kept
the keyboard focus inside or gave it back on close, though the design document promised
both, and the shelf sheet's slide was dead because it named a style that lived in the other
file. Nine design tokens were emitted and read by nothing. The start page was blank for the
seconds it took the stores to answer; four pages showed nothing when the worker failed;
five empty states were a sentence with no way out. And the words: shop, dealer and seller
mixed within six lines, "Shops" in the bar, "Dealers" in the palette.

One word now — *shop* in English, *Laden* in German. One drawer for both sheets, with the
focus trap. Every token read or removed. A loading line, an error note, a link out of every
empty state. And a new guard in the test suite that reads string literals, which is where
the German had been hiding: it found fourteen more lines in the worker, now English.

The map says "37 different releases" where the shelf says "40 records", because it counts
taste and the shelf counts copies — before, the two numbers stood under one heading with
nothing to explain them.

### Fixed

* **i18n:** one word for a shop, and no German left outside the packs ([e0b3cd3](https://github.com/misterhonk/fidelity/commit/e0b3cd3badfcc063277192188a2b127ffccee099))
* **ui:** an expired dig is not an interrupted one ([b0e3ba1](https://github.com/misterhonk/fidelity/commit/b0e3ba134f7f9900dd3e7f89e5f60a0b8d6a95e5))
* **ui:** in-store counted twice, four pages without an error state, empty states without a way out ([0611a0f](https://github.com/misterhonk/fidelity/commit/0611a0f211002e5ae550b0aef8a52c2a03bb3430))
* **ui:** one frame for both sheets, tokens that are read, a measure that holds ([7727420](https://github.com/misterhonk/fidelity/commit/7727420832ac770668c50d953d9945b64dcdc8c4))

## [0.29.0](https://github.com/misterhonk/fidelity/compare/v0.28.0...v0.29.0) (2026-09-11)

**When something goes wrong, the app now says what to do about it — in your language.**

Until this release, a failure that came out of the part of Fidelity that does the actual
work arrived on screen as whatever sentence happened to be written in the code. Ten of them
were German, in an English interface. And they were not small print: the red headline at the
top of an error *is* that sentence, so "Der Sechs-Stunden-Rahmen ist abgelaufen – bitte neu
scannen." is what an English reader got, and an English one is what a German reader got
after the last attempt to fix it.

Now each of those eighteen failures has a name rather than a sentence, and the words are
written where the app knows which language you read. So "a scan is already running" comes
with *only one at a time — that is the rate limit, not a preference*; an expired dig comes
with *prices may not be shown once they are that old, a new scan takes a minute*; a backup
from a newer version comes with *update the app first, an older one would read it wrong
rather than not at all*. The original technical line is still one tap away, because somebody
chasing a genuinely new failure needs the words the machine used.

**Why it could not simply be translated.** The half of the app that scans, matches and
scores runs in a separate thread that deliberately knows nothing about language — that is
what keeps it fast and what keeps the rate limit honest. A sentence written there can never
follow the language switch, whichever language it is written in. Naming the failure and
leaving the wording to the side that *does* know is the only arrangement where both readers
get a sentence meant for them.

### Added

* **i18n:** der Worker wirft Codes statt Sätze ([d50b45c](https://github.com/misterhonk/fidelity/commit/d50b45c3ee14901cff33cdb4549069f625715c72))

## [0.28.0](https://github.com/misterhonk/fidelity/compare/v0.27.1...v0.28.0) (2026-09-11)

**The privacy notice was out of date, and it was the kind of out of date that matters.** It
opened with "Fidelity has no server. There is nowhere your data could be processed" — three
releases after sharing a find list had begun sending a sealed dig to a hub. The sentence had
been true when it was written, and nothing made anybody go back to it.

The hub now has a section of its own, beside the one the audio preview already had, and it
separates what the hub can read from what it cannot: your backup and a shared find list go
there sealed; the dealers you are watching, the push address your browser hands out, and the
release ids it is asked for covers of do not. Your Discogs token is in neither half. The web
host has a section too — like every web server it logs the requests it answers, and that
belongs said rather than assumed. None of this is new behaviour; it is behaviour that was
not written down.

**And the app now says when it is newer than last time.** These notes have been reachable
since 0.27.0, but only through the version number in the footer — which is to say, only to
somebody who already knew that number was a link. Now a line on the start page says so once,
after an update, and never again for that release. On a first visit it says nothing: you
have not updated from anything, and the first sentence an app tells you should not be a
false one.

**A note on the last one in the list.** This project has a test that fails if a German
comment appears anywhere in the source. It reported none while 130 sat in 74 files — a
regex literal containing a quote derailed its scan, two comment lines counted as two
comments instead of one paragraph, `.mjs` was outside its search, and eight of its German
words are also English words, which had forced its threshold so high that most short
comments slipped under it. All four are fixed and all 130 are translated. Nothing you can
see changed; a guarantee that was being reported as kept now is.

### Added

* **ui:** sagen, dass die App neuer ist als beim letzten Mal ([6c7a256](https://github.com/misterhonk/fidelity/commit/6c7a256ee6d7d52d0677326ffc8893d55ecfeef7))


### Fixed

* **i18n:** die Wache war grün und hat 130 deutsche Kommentare übersehen ([8a12784](https://github.com/misterhonk/fidelity/commit/8a12784fba41e1617799f79ee8c859a26c39cab7))
* **ui:** [@container](https://github.com/container) gehört auf den Kasten, dessen Breite der Inhalt hat ([c7ebfcc](https://github.com/misterhonk/fidelity/commit/c7ebfcca21f7207e669f3a337b40720d086cd8e8))
* **ui:** den Hub im Datenschutzhinweis benennen ([2e4f3a5](https://github.com/misterhonk/fidelity/commit/2e4f3a5e7e2706411e7b47440e3047d6132fbe7b))

## [0.27.1](https://github.com/misterhonk/fidelity/compare/v0.27.0...v0.27.1) (2026-09-11)

The narrow screens — basket, places, the legal pages, this one — sit in the middle again.

0.27.0 anchored them to the left, which held the edge still and stuck a 48rem column to the
left third of a wide monitor. Centring them brings back the objection they were moved for:
when a block is centred, its **width is its left edge**. So they are centred *and* all the
same width now, which the previous release had not fixed — among the narrow screens alone
there were four: 48rem for the basket and the legal pages, 42rem for the setup, 36rem for
these notes and for in-store. Four widths are four edges, only noticed more slowly.

Two edges left in the whole app, then: the wide container that the navigation bar shares,
and the one narrow column. Neither moves.

### Fixed

* **ui:** schmale Seiten wieder zentriert — aber alle gleich breit ([276b036](https://github.com/misterhonk/fidelity/commit/276b0360c6ffde924802f0aa3e55d15783a0619f))

## [0.27.0](https://github.com/misterhonk/fidelity/compare/v0.26.0...v0.27.0) (2026-09-11)

The release where the app stops moving under you — and where these notes start being
readable from inside it.

**One measure, everywhere.** Clicking through the five collection tabs used to shift the
whole page sideways every time: five tabs, four widths (110, 90, 80 and 48rem), all of them
centred. The navigation bar sat at 48rem and so lined up with the content on no screen at
all — six different left edges across thirteen screens. A width belongs to an *area*, not to
a page; two views of the same collection should not be a house move. Measured at 1800 px
afterwards: thirteen screens, one left edge.

What has to stay narrow — a basket, a privacy page — now keeps its measure **inside** the
shared container and sits against the left edge instead of floating in the middle. That is
the visible trade: a receipt no longer centres itself, so the edge holds still.

**And the version number in the footer is a link now.** It leads to what changed in the
build you are running — this paragraph, in fact. The commit lists below stay in the
repository, where they were written for.

> From this release the notes are written in English. Up to 0.26.0 they came from this
> project's own commits and are German; they are shown as they were written rather than
> rewritten after the fact.

### Added

* **ui:** was in dieser Ausgabe neu ist, in der App nachlesbar ([760a11e](https://github.com/misterhonk/fidelity/commit/760a11e290493ff315cf3cf946df1e10bccf25d4))


### Fixed

* **ui:** ein Maß für die ganze App, statt eines je Seite ([28a4ef8](https://github.com/misterhonk/fidelity/commit/28a4ef8e2fbe28054772974a09ea1f748ec79411))

## [0.26.0](https://github.com/misterhonk/fidelity/compare/v0.25.1...v0.26.0) (2026-09-11)

Die Ausgabe, in der die App **sagt, was sie tut** — und zugibt, was sie nicht tun kann.

Der Keeper frischt Sammlung, Wantlist, beobachtete Läden und den Horizont seit je beim
Öffnen auf, beim Zurückkehren in den Tab und alle zwanzig Minuten. Nur stand davon nichts
auf dem Schirm. Jetzt nennt die Zeile den Schritt beim Namen, und daneben steht, was sich
**nicht** von selbst auffrischt: ein Dig, weil er zwei bis vier Minuten und hundert
Abfragen kostet, und Bestellungen, weil Discogs sie nicht herausgibt.

**Drei Korrekturen, die alle an echten Daten aufgefallen sind:**

- **Was bei Discogs verschwindet, verschwindet auch hier.** 26 Wantlist-Einträge lokal,
  24 bei Discogs — der Abgleich schrieb jede gelesene Zeile und nahm nie eine weg. In der
  Sammlung war das mehr als kosmetisch: „besitze ich schon" ist ein harter Filter, eine
  verkaufte Platte hätte sich in jedem künftigen Dig selbst ausgeblendet.
- **Drei Läufe desselben Ladens sahen identisch aus.** Jetzt stehen Uhrzeit und Art dabei
  — eine Null bei „nur das Neue" heißt etwas anderes als eine Null nach einem
  vollständigen Durchgang.
- **Die Händler-Erkennung behauptete etwas Unmögliches.** `GET /marketplace/orders` ist
  die Verkäuferseite; für jemanden, der nur kauft, findet diese Quelle nie etwas.

**Und eine Bestellung lässt sich jetzt einlesen.** Eine Nummer von
`discogs.com/sell/purchases`, eine Anfrage, und alle Platten der Bestellung stehen auf
der Kaufliste — mit der Ankunftsfrage aus 0.25.0. Gespeichert wird dabei weder der Preis
noch die versprochene Note noch die Adresse des Verkäufers; das Schema an der Grenze
nennt diese Felder gar nicht erst.

### Added

* **dealers:** eine Bestellung einlesen — eine Nummer statt drei Haken ([b85dc39](https://github.com/misterhonk/fidelity/commit/b85dc3965590b2b263a73957577d7fcc1ff3a2e1))
* **ui:** sagen, dass gerade aktualisiert wird — und was nicht ([0b4b73d](https://github.com/misterhonk/fidelity/commit/0b4b73d44313814227a1f2fea71429c50c7a175c))


### Fixed

* **dealers:** die Händler-Erkennung behauptete etwas, das nicht eintreten kann ([cc0c9e5](https://github.com/misterhonk/fidelity/commit/cc0c9e54fc7273beace12cbda086c69a267f72a1))
* **dig:** drei Läufe desselben Ladens sahen identisch aus ([69716dd](https://github.com/misterhonk/fidelity/commit/69716dda756306686b75023d9b4e25b115fb59d7))
* **sync:** was bei Discogs verschwindet, verschwindet auch hier ([2b9fae5](https://github.com/misterhonk/fidelity/commit/2b9fae553ebb133550da98587189552bcfb89d28))

## [0.25.1](https://github.com/misterhonk/fidelity/compare/v0.25.0...v0.25.1) (2026-09-11)

**`docs/` ist englisch.** Vierzehn nummerierte Dokumente und dreizehn ADRs, rund 6.500
Zeilen — die letzte offene Zeile aus [ADR-010](docs/adr/010-english-base-language.md),
und damit gilt die Sprachregel überall. Die deutschen Dateinamen sind mitgegangen:
`00-KONZEPT.md` heißt `00-CONCEPT.md`, `012-hoerprobe.md` heißt `012-audio-preview.md`.
Ein englischer Text unter einer deutschen Adresse ist genau die halbe Sache, gegen die
jene ADR argumentiert.

**Die Nummern sind geblieben.** Rund zweihundert Stellen im Code zitieren ein Dokument
über seine Nummer — `docs/02`, `docs/09 §1.1` —, und die ist der stabile Teil. Wer
Lesezeichen auf die alten Dateinamen hat, findet sie über die Nummer wieder.

Am Code hat sich nichts geändert; der einzige Eintrag unten betrifft einen Ablauf, der
grün meldete, ohne etwas geprüft zu haben.

### Fixed

* **deploy:** die Hub-Prüfung hat nichts geprüft und grün gemeldet ([9ecb222](https://github.com/misterhonk/fidelity/commit/9ecb222abca9875e4aa78746a9c888448d6c625c))

## [0.25.0](https://github.com/misterhonk/fidelity/compare/v0.24.0...v0.25.0) (2026-09-11)

Die Ausgabe, in der die App drei Fragen beantwortet, die Discogs nicht beantwortet:
**wo steht die Platte**, **ist meine gerade mehr wert** und **gradet dieser Laden
ehrlich**. Alles davon bleibt auf dem Gerät, und das teuerste Feature der Liste — die
Lagerorte — kostet null Anfragen.

Zwei Dinge, die man beim Aktualisieren wissen sollte:

- **Das IndexedDB-Schema geht von 8 auf 10** (`watched`, `places`, `placements`). Rein
  additiv, die Migration läuft beim ersten Start von selbst, und nichts Vorhandenes wird
  angefasst. Kein MAJOR, weil nichts von Hand nachzuziehen ist.
- **Lagerorte kennen kein Löschen mehr.** Ein aufgelöstes Regal bleibt als Markierung
  liegen, eine heruntergenommene Platte wird als „liegt nirgendwo" geschrieben. Sichtbar
  ist das nirgends — es ist die Bedingung dafür, dass zwei Geräte über den Tresor nicht
  gegenseitig Gelöschtes wiederbeleben.

Verworfen wurde ebenfalls etwas, und das steht in `docs/06`: den Runout vorzulesen statt
abzutippen. `SpeechRecognition` ist verfügbar und sogar geräteintern möglich, aber auf
Wörter trainiert — und `BN-LP-4001-A [ear] M9 RVG` ist keines.

### Added

* **collection:** beobachtete Platten — wenn die eigene im Wert springt ([6e329af](https://github.com/misterhonk/fidelity/commit/6e329affcbb70159ce3ef60bcc5a8e1ee45d4a12))
* **collection:** die Auslaufrille lesen — weil das Cover nicht geht ([ec0d8d0](https://github.com/misterhonk/fidelity/commit/ec0d8d0af0759fac92b1a9393a52c5ffa266b25d))
* **collection:** einen Barcode lesen — und sagen, dass er nicht eindeutig ist ([666f9e1](https://github.com/misterhonk/fidelity/commit/666f9e1b370dcdeaf0f10c4db12b6c344dc59945))
* **collection:** Lagerorte reisen mit — und Löschungen reisen mit ihnen ([0f8d63f](https://github.com/misterhonk/fidelity/commit/0f8d63fcce2d83490338141c114b34579bdcc00e))
* **collection:** wo die Platte steht — Orte, Regale, Kisten ([199c099](https://github.com/misterhonk/fidelity/commit/199c099529f4840d21e7c636f181148a596807df))
* **dealers:** gradet dieser Laden ehrlich — aus den eigenen Käufen ([fc917ce](https://github.com/misterhonk/fidelity/commit/fc917ce65345560d088a1eb9fc3184e096374a54))
* **watch:** nicht nur "ein Angebot weniger", sondern welches ([4e71608](https://github.com/misterhonk/fidelity/commit/4e716080907dbd3db34f977d1afd97070fc435cc))

## [0.24.0](https://github.com/misterhonk/fidelity/compare/v0.23.0...v0.24.0) (2026-09-11)


### Added

* **ui:** der Stapel — dieselben Funde, einer nach dem anderen ([c0ec07e](https://github.com/misterhonk/fidelity/commit/c0ec07e1843e20647e19be13459e95218e1b817b))
* **ui:** die Hörprobe im Stapel — nach ADR-012 ([912ad40](https://github.com/misterhonk/fidelity/commit/912ad4049034ff42b96a44b5b8b8281e3717540f))


### Fixed

* **ui:** einen Weg in den Stapel, den man nicht kennen muss ([55109db](https://github.com/misterhonk/fidelity/commit/55109db258e9df919378ab980a31c68515e46d1b))
* **ui:** Symbole auf die Knöpfe des Stapels — und zwei Fehler, die dabei auffielen ([e45eb48](https://github.com/misterhonk/fidelity/commit/e45eb48fcf0e9ac2a7223f2e3bf192372f4327b3))

## [0.23.0](https://github.com/misterhonk/fidelity/compare/v0.22.0...v0.23.0) (2026-09-10)


### Added

* **hub:** eine Fundliste teilen, die der Hub nicht lesen kann ([7dc489d](https://github.com/misterhonk/fidelity/commit/7dc489d894a15ee04a674eff6dc4efc367518039))
* **hub:** eine Fundliste verschicken, und einen Link öffnen, ohne die App zu haben ([f88657e](https://github.com/misterhonk/fidelity/commit/f88657e0585b3abd223e6763249d569129d8c776))


### Fixed

* **i18n:** fünfzehn deutsche Fehlermeldungen aus dem Tresor holen ([920c9bf](https://github.com/misterhonk/fidelity/commit/920c9bf3dda907d67d40b374f4d12b9e08ad5224))
* **i18n:** zwölf deutsche Sätze, die aus dem Skript auf den Schirm kamen ([e5232b4](https://github.com/misterhonk/fidelity/commit/e5232b4049d39dfd68dd5cfc684f935acdeac5c0))

## [0.22.0](https://github.com/misterhonk/fidelity/compare/v0.21.0...v0.22.0) (2026-08-14)


### Added

* **ui:** das Cover so groß zeigen, wie es überhaupt zu haben ist ([3a841b2](https://github.com/misterhonk/fidelity/commit/3a841b24570a4d84d9b633a6e27df7be8eac0c03))
* **ui:** einen Weg nach oben, und die Wantlist zeichnet nicht mehr alles ([b5c580f](https://github.com/misterhonk/fidelity/commit/b5c580f740e0ab38c07d0cd57b82ef9d8e5ebc6c))


### Fixed

* **auth:** ohne Token führt jeder Weg zur Einrichtung, nicht ins Leere ([5a08e27](https://github.com/misterhonk/fidelity/commit/5a08e2727c272f4bf476ae2a2d2caee6794652e3))

## [0.21.0](https://github.com/misterhonk/fidelity/compare/v0.20.0...v0.21.0) (2026-08-14)


### Added

* **dealers:** einen Balken anklickbar machen und zeigen, was dahintersteckt ([0063481](https://github.com/misterhonk/fidelity/commit/0063481694475793677601de7f0703bbf974c33c))


### Fixed

* **dig:** keinen Freispruch aussprechen, für den die Grundlage fehlt ([d9c3a98](https://github.com/misterhonk/fidelity/commit/d9c3a98de31ef325dd4face49e7793e1bb418551))
* **ui:** dem Release-Sheet auf breiten Schirmen Platz geben ([58506ed](https://github.com/misterhonk/fidelity/commit/58506ed0301c3908222ce4f51a4fb063466a60ce))


### Changed

* **hub:** einen Knopf mit vier Stellungen statt zweier Haken ([9662261](https://github.com/misterhonk/fidelity/commit/9662261765c689ff9a81cdce0bf4b41b0eb455ee))

## [0.20.0](https://github.com/misterhonk/fidelity/compare/v0.19.1...v0.20.0) (2026-08-13)


### Added

* **watch:** dem Service Worker eine Stimme geben ([80382a5](https://github.com/misterhonk/fidelity/commit/80382a52089b95f2e40cf8334d32c9abac760b88))
* **watch:** sagen, wer angemeldet ist, bevor es klingelt ([1e58ab7](https://github.com/misterhonk/fidelity/commit/1e58ab799eaa78df31d0536480f547d64c5cca2f))


### Fixed

* **watch:** eine gescheiterte Zustellung zählen und benennen ([b23316d](https://github.com/misterhonk/fidelity/commit/b23316df7190664d6e796379b04db8c274db6a57))

## [0.19.1](https://github.com/misterhonk/fidelity/compare/v0.19.0...v0.19.1) (2026-08-13)


### Fixed

* **horizon:** was schon lokal liegt, dem Hub nachreichen ([5333793](https://github.com/misterhonk/fidelity/commit/5333793e44c8e42a285030a9723f5bd3d0b40e28))

## [0.19.0](https://github.com/misterhonk/fidelity/compare/v0.18.1...v0.19.0) (2026-08-13)


### Added

* **hub:** einmal klingeln lassen, statt auf einen Händler zu warten ([5c55f15](https://github.com/misterhonk/fidelity/commit/5c55f1515a0340114d0deac7dfec43b050855338))
* **sync:** den Ablageort des Vaults aus der Passphrase ableiten ([9bf11eb](https://github.com/misterhonk/fidelity/commit/9bf11eb0387791f74cd5857c9843fd7e2f22d844))

## [0.18.1](https://github.com/misterhonk/fidelity/compare/v0.18.0...v0.18.1) (2026-08-13)


### Fixed

* **hub:** POST durch den Vorabflug lassen, sonst meldet sich kein Gerät je an ([2060278](https://github.com/misterhonk/fidelity/commit/2060278583c9034bd4aec98854b874cdeeb96dbf))
* **i18n:** der Fundmeldung das "hier" nehmen, das in der Hälfte der Fälle falsch ist ([d1f0ec0](https://github.com/misterhonk/fidelity/commit/d1f0ec07fe1d1166dd6772c48b28934602f5e18c))

## [0.18.0](https://github.com/misterhonk/fidelity/compare/v0.17.0...v0.18.0) (2026-08-13)


### Added

* **hub:** den Hub neben die App stellen, statt neben den Schreibtisch ([6cd5357](https://github.com/misterhonk/fidelity/commit/6cd53574b7d41b3968e4fd275938121acfea5174))


### Fixed

* **hub:** auf node 22 umstellen, statt an node 18 zu scheitern ([6a853e4](https://github.com/misterhonk/fidelity/commit/6a853e413167cf4d0ba569c64628cdf7751f7c18))

## [0.17.0](https://github.com/misterhonk/fidelity/compare/v0.16.0...v0.17.0) (2026-08-13)


### Added

* **dealers:** the friends question, where the shop list is empty ([7637fa6](https://github.com/misterhonk/fidelity/commit/7637fa62080628c9a9806aae644dd6d3d3b5e3b2))
* **ui:** a link that leaves says so before it is clicked ([14d9173](https://github.com/misterhonk/fidelity/commit/14d9173793c71d9477f17f53cc496feb0a98bd3d))


### Fixed

* **deploy:** ship a release because it exists, not because an action said so ([8a1c138](https://github.com/misterhonk/fidelity/commit/8a1c138cba3d29c0cb74c222b2655839dc79a9fb))
* **ui:** a cover you want leads to your own row, not to Discogs ([0fc4e5c](https://github.com/misterhonk/fidelity/commit/0fc4e5c68726e796e82012d68775d2d90027f8f9))

## [0.16.0](https://github.com/misterhonk/fidelity/compare/v0.15.0...v0.16.0) (2026-08-12)


### Added

* **collection:** fetch what a record actually is, once per record ([c28d561](https://github.com/misterhonk/fidelity/commit/c28d56160a45a0685fa9c5afd8fe6a0c617a67d4))
* **collection:** open your own record from the start screen, and follow a name ([97c68dc](https://github.com/misterhonk/fidelity/commit/97c68dcd45009571e411652f89afb3268cf21425))
* **collection:** show the pressing detail the sync already paid for ([5157a2a](https://github.com/misterhonk/fidelity/commit/5157a2a781d972a09f808dd27e188a30c230abc1))
* **collection:** what it goes for, and what the cataloguers wrote down ([ef2dd6e](https://github.com/misterhonk/fidelity/commit/ef2dd6ef6f426f81277f99df2251f9e8fd8dc5e3))

## [0.15.0](https://github.com/misterhonk/fidelity/compare/v0.14.0...v0.15.0) (2026-08-12)


### Added

* **watch:** let a hub say when a shop got records, with the app closed ([f2a5a33](https://github.com/misterhonk/fidelity/commit/f2a5a3348510351dfa7601b1d40a8c3ee0f6d46b))

## [0.14.0](https://github.com/misterhonk/fidelity/compare/v0.13.0...v0.14.0) (2026-08-12)


### Added

* **pwa:** write the service worker, instead of having it written ([10492f9](https://github.com/misterhonk/fidelity/commit/10492f931a4c0899d9b96b9c5b9bae131920c0cd))
* **ui:** pick the countries a dig should skip, instead of spelling them ([b244329](https://github.com/misterhonk/fidelity/commit/b244329bcb6a5886ed8d5b461eef28182c681bb1))


### Fixed

* **deps:** serve the fonts from this repository, not from Google ([438d735](https://github.com/misterhonk/fidelity/commit/438d735c674da95ddd3cbf77ccc9a4f2206744b1))
* **i18n:** the home screen counted records in German on the English build ([c73237e](https://github.com/misterhonk/fidelity/commit/c73237e73b70f8df90d7fcc84065debd3019ff10))
* **pwa:** register the cover cache, which the worker never reached ([d55d6a1](https://github.com/misterhonk/fidelity/commit/d55d6a19bbcf56f95a45f14ffeab38338c6a4a40))

## [0.13.0](https://github.com/misterhonk/fidelity/compare/v0.12.0...v0.13.0) (2026-08-12)


### Added

* **collection:** carry the wantlist note, all the way into the shop ([9de2a0b](https://github.com/misterhonk/fidelity/commit/9de2a0be94da952117f946ec1865d0feac7e77c8))
* **collection:** give the wantlist its sleeves, and its language back ([f2f1d7d](https://github.com/misterhonk/fidelity/commit/f2f1d7d2ff2b6c42587b3c231e3c64032ea060c3))
* **collection:** show which shelf a record sits on, and let it move ([908206c](https://github.com/misterhonk/fidelity/commit/908206ceebd01c79c1e84f748f09d1d69ebe136f))
* **sync:** look again the moment somebody comes back to the app ([7799809](https://github.com/misterhonk/fidelity/commit/779980999551e90ce3b6b7a3e862c47308dbb96c))
* **sync:** read the whole collection, so a changed rating can arrive at all ([242e02f](https://github.com/misterhonk/fidelity/commit/242e02f67190961848b5153762d061bee63f379a))
* **ui:** put the shelf's own state on one line and its controls on another ([260ce58](https://github.com/misterhonk/fidelity/commit/260ce58a5aab9049365b645c26e96f3a9e0f2925))
* **ui:** send a change at once, say what became of it, and warn before deleting ([3d2d41a](https://github.com/misterhonk/fidelity/commit/3d2d41a2c17bf2cc02b30ca8e942509e134dc27e))


### Fixed

* **collection:** a record owned twice was quietly one record ([88d1f24](https://github.com/misterhonk/fidelity/commit/88d1f24787a97c1634e5ae875bc0ee0e2f3be6e0))
* **ui:** a comma could not be typed into the blocked-countries field ([42c0f39](https://github.com/misterhonk/fidelity/commit/42c0f39a8535c5063c7fa656573837d0c2172fd8))

## [0.12.0](https://github.com/misterhonk/fidelity/compare/v0.11.0...v0.12.0) (2026-08-12)


### Added

* **collection:** note the condition of your own copy, in Discogs' own words ([70e99fc](https://github.com/misterhonk/fidelity/commit/70e99fc9f1b9b9c29283a03b5bf4756d1b18c413))
* **collection:** put a bought record on the shelf, and take one off it ([f178bdb](https://github.com/misterhonk/fidelity/commit/f178bdb88d76e881fa56481b18061f3da1a51d49))
* **collection:** rate a record you own, and get it to Discogs afterwards ([3914f68](https://github.com/misterhonk/fidelity/commit/3914f688c4432f5283903399639a520f86ed0c9c))
* **collection:** show what the shelf is worth, and write down why any of this writes ([f248b4d](https://github.com/misterhonk/fidelity/commit/f248b4de846645244b89e8cad19d807d23239ead))
* **collection:** want a record without leaving, and stop wanting it ([1481a49](https://github.com/misterhonk/fidelity/commit/1481a498becfba366f0cdebb1e19e23d9c577c7c))
* **discogs:** let the client write, and refuse to repeat what it must not ([b01029a](https://github.com/misterhonk/fidelity/commit/b01029af06c6d83eb3bc996df4758050e9231e1d))
* **ui:** give a record of your own a page, instead of sending it to Discogs ([4ea81fc](https://github.com/misterhonk/fidelity/commit/4ea81fc833958945b280ae05857a6f98bef2adee))
* **ui:** one typeface set, and three families instead of seven ([6c6139b](https://github.com/misterhonk/fidelity/commit/6c6139b083559b6f9c254d6f9ea31b8e5ad479ae))
* **ui:** say what the sheet's buttons do, and give the cover the room it earns ([227a59b](https://github.com/misterhonk/fidelity/commit/227a59b4c7c091d918ab098bce8f5e05d3c88618))


### Fixed

* **ui:** the app set its numbers in two different monospace faces ([626eaa6](https://github.com/misterhonk/fidelity/commit/626eaa66310889269e4aae2a12920f4d308adf92))

## [0.11.0](https://github.com/misterhonk/fidelity/compare/v0.10.0...v0.11.0) (2026-08-11)


### Added

* **deploy:** a dry run that writes nothing, and a base path that is not the root ([e125ae2](https://github.com/misterhonk/fidelity/commit/e125ae2a48a386d9b398b8ae8a466ae0c204ce35))
* **ui:** sort the shelf in both directions ([f691833](https://github.com/misterhonk/fidelity/commit/f6918331740691fc48524f9e1b0454c751dc0cba))


### Fixed

* **deploy:** keep the last three releases, not three arbitrary ones ([1d83d5d](https://github.com/misterhonk/fidelity/commit/1d83d5d45c5fc8fcfe3323b8d1383812d222548c))
* **deploy:** name the environment, or the secrets stay invisible ([fd5f152](https://github.com/misterhonk/fidelity/commit/fd5f1521253a19afd85f2e5dfb9f5474b253a2d7))
* **deploy:** RewriteBase, or Apache puts the filesystem in the address bar ([d07e7fb](https://github.com/misterhonk/fidelity/commit/d07e7fbd8b2324f39ab4cfbed17ef8f0a5019d90))
* **deploy:** say 'delivered but unreachable' instead of just failing ([4dea143](https://github.com/misterhonk/fidelity/commit/4dea1439eac9a89ca4a7b8ca0d66e31c917d99ca))
* **deploy:** take the base path from a variable or a secret ([0c584ce](https://github.com/misterhonk/fidelity/commit/0c584ce837fe171d57230a50960589db2addf801))
* **pwa:** the built page had no title element at all ([498a0e8](https://github.com/misterhonk/fidelity/commit/498a0e801cdc6315eb1ec8fc7c191fe17d307576))
* **pwa:** the install sheet never saw the manifest, so it drew a W ([54f50e3](https://github.com/misterhonk/fidelity/commit/54f50e39c1405adc4d481c199ffc5b402d611aaa))

## [0.10.0](https://github.com/misterhonk/fidelity/compare/v0.9.0...v0.10.0) (2026-08-11)


### Added

* **i18n:** account, collection and search speak English ([5081b71](https://github.com/misterhonk/fidelity/commit/5081b714fef47bfe9f457ea099012eaf10fd8a06))
* **i18n:** all five sections speak English — dig, basket, collection, shops, start ([fda311f](https://github.com/misterhonk/fidelity/commit/fda311fd862bc931d0c3ee8ba503bd6ec02019b2))
* **i18n:** English addresses, and the old ones keep working ([63aec42](https://github.com/misterhonk/fidelity/commit/63aec4264209d8d31c27c4ee23a7f49564b02e3b))
* **i18n:** the app speaks English, and picks German when the device asks ([00c6175](https://github.com/misterhonk/fidelity/commit/00c6175ef5cd4888219c5ce340be4ea848f5cae5))
* **i18n:** the Barry sentence is written where it is read, in both languages ([a5a33ca](https://github.com/misterhonk/fidelity/commit/a5a33cad176fde681bfcb367cf65ba24614e98d1))
* **i18n:** the last screens — onboarding, demo, in-store, privacy, legal ([46ceb8d](https://github.com/misterhonk/fidelity/commit/46ceb8d1a3451f59c95f4e287dfb5c2a472c7e68))
* **i18n:** the pressing warnings, the hub failures, and the last German comment ([109bd0e](https://github.com/misterhonk/fidelity/commit/109bd0ee1223a89ff76f9d166e5605a8ff60e058))
* **i18n:** the rest of the settings, the shared notices and the manual ([186aa37](https://github.com/misterhonk/fidelity/commit/186aa37f3783374d0eba36f02b8aa31cfb30eb59))
* **i18n:** the settings speak English, index and chrome first ([af329af](https://github.com/misterhonk/fidelity/commit/af329af7111526d1fa74be895e121408db3daac6))
* **ui:** make the dark side legible, and give the app a surface ([d025877](https://github.com/misterhonk/fidelity/commit/d025877a0b03869d559f9468f02dcb7babe7760f))


### Fixed

* **deploy:** a release-please tag triggers nothing, so call the workflows ([d497d2f](https://github.com/misterhonk/fidelity/commit/d497d2fd4ccffcaab0e89111f476ad5677589028))
* **i18n:** finish the translation, and stop trusting word lists ([63fee5f](https://github.com/misterhonk/fidelity/commit/63fee5fb623272ee6601c0e3b5e8c212ae4984b2))
* **i18n:** the record's own page was never translated ([f31f2c8](https://github.com/misterhonk/fidelity/commit/f31f2c80780ba8a5aec92ce4fc7d17ac2e2de185))
* **i18n:** translate what only a screen reader could hear ([7f415af](https://github.com/misterhonk/fidelity/commit/7f415afd3b0eae66fcc2cc82552cc28e09c73df6))
* **pwa:** one key in the config silently disabled the service worker plugin ([7d668ca](https://github.com/misterhonk/fidelity/commit/7d668ca77ca0e59aa06386cbe55192a67566f529))
* **ui:** the setup had two roots in one transition, so it would not load in dev ([e819941](https://github.com/misterhonk/fidelity/commit/e819941d884df8333e54c2d31b0343b58d91aea6))


### Changed

* drop two settings nothing ever read, and correct the record ([bace338](https://github.com/misterhonk/fidelity/commit/bace338bd2f230af68159c3dbdaeb1e971fae1e5))
* **i18n:** split the words by area, so a screen's text rides in its own chunk ([c157b75](https://github.com/misterhonk/fidelity/commit/c157b75d59a5cf44ef3f061ca107312c442e7f7e))

## [0.9.0](https://github.com/misterhonk/fidelity/compare/v0.8.0...v0.9.0) (2026-08-11)


### Added

* **deploy:** a release anybody can use without a toolchain ([6e731c3](https://github.com/misterhonk/fidelity/commit/6e731c30cb49837865ed4f0727258b2aa2976e22))
* **deploy:** switch releases with a symlink, so nobody sees half a build ([40a2bd4](https://github.com/misterhonk/fidelity/commit/40a2bd43f17d3a4307df3c1dfc9f96123f1a462a))
* **deploy:** three ways in, one for each kind of person ([b2c6ecb](https://github.com/misterhonk/fidelity/commit/b2c6ecb760cdb24453ecd99830f4cbb50256544d))
* **watch:** the one job that justifies running a hub at all ([bf82b12](https://github.com/misterhonk/fidelity/commit/bf82b12cc150058043ae71c394fff6b2dd5def3e))


### Fixed

* **demo:** the paste field is visible, and above the records ([db42141](https://github.com/misterhonk/fidelity/commit/db4214162997a7f4bec2a383a61274b6ebf05e2f))
* **deploy:** build the site once, not once per architecture ([2552268](https://github.com/misterhonk/fidelity/commit/2552268f7c270c7982cbbe5a84cee8539b3d1e2a))
* **deploy:** the manual image run could never have pushed anything ([918de50](https://github.com/misterhonk/fidelity/commit/918de508f6ef9e828ef4d450d676a95109ecc843))

## [0.8.0](https://github.com/misterhonk/fidelity/compare/v0.7.0...v0.8.0) (2026-08-11)


### Added

* **dig:** take a Discogs link where the field asked for a username ([f9f732b](https://github.com/misterhonk/fidelity/commit/f9f732b05c836c3919241600f81f52fc8a5761a8))
* **hub:** look for one on this machine, and say when the browser forbids it ([afa4ad9](https://github.com/misterhonk/fidelity/commit/afa4ad9085466ddf31f74cd13f9996c49202487f))
* **hub:** share the covers, since the marketplace will not hand them over ([10ae0f7](https://github.com/misterhonk/fidelity/commit/10ae0f73ebb206ad8589cfbe5dca273fb67d8014))
* **sync:** keep the data current instead of hiding the buttons that do it ([b9b5e60](https://github.com/misterhonk/fidelity/commit/b9b5e60eee0754926e7264bdfce3739e39bb4b6c))
* **ui:** the horizon and the credits belong in the setup, in plain words ([970e286](https://github.com/misterhonk/fidelity/commit/970e286d2e4391b8a1ba937223bdd3ce14ebf527))


### Fixed

* **hub:** say what a hub gives you, not what it does not ([eb5df94](https://github.com/misterhonk/fidelity/commit/eb5df94fb2a060dc7210564ab59b402682cf2107))

## [0.7.0](https://github.com/misterhonk/fidelity/compare/v0.6.0...v0.7.0) (2026-08-10)


### Added

* **auth:** show what the app produces before asking for the key ([b32fe59](https://github.com/misterhonk/fidelity/commit/b32fe59ed652803c678440b970745f7edc2fcafc))
* **dealers:** fetch a shop's logo once for shops scanned before it existed ([7c6f3fb](https://github.com/misterhonk/fidelity/commit/7c6f3fbe29c83fd62037d8af5b5897ba344088bc))
* **demo:** a landing page that shows before it asks ([e8f692b](https://github.com/misterhonk/fidelity/commit/e8f692be589f921ca4be8353d1f640b38a4b5511))
* **demo:** Fidelity without a token, from one or two records ([fc26955](https://github.com/misterhonk/fidelity/commit/fc2695595349c904a94d4d3855ee922704d09454))
* **ui:** put the sleeve first, and fetch the ones the marketplace withholds ([623eb7e](https://github.com/misterhonk/fidelity/commit/623eb7e07930be9a68e56579000d36003dbbf77f))
* **ui:** say what a record physically is ([63deffb](https://github.com/misterhonk/fidelity/commit/63deffbbf76535b9e482f0f609ceba6d16eb2e6d))


### Fixed

* **auth:** answer the first question somebody has about a token ([895d065](https://github.com/misterhonk/fidelity/commit/895d065a36bf5fea997b69204c23302ed6ba1555))
* **ui:** the two screens the cover sweep missed ([8c44437](https://github.com/misterhonk/fidelity/commit/8c444373dd8eea0c451206c3710d1d723c8c676d))
* **ui:** white on the accent in light mode, which is what is readable ([964a7bb](https://github.com/misterhonk/fidelity/commit/964a7bb0680b4438d5da475d641515f5e0c6fdc1))


### Changed

* **ui:** one place to write a price, and a country you can set ([260efd1](https://github.com/misterhonk/fidelity/commit/260efd1814a172386a921ebfecece08abd112850))

## [0.6.0](https://github.com/misterhonk/fidelity/compare/v0.5.0...v0.6.0) (2026-08-10)


### Added

* **basket:** make the dealer's minimum order a number you can act on ([8ee2d16](https://github.com/misterhonk/fidelity/commit/8ee2d16622fb632a04c222a9cc70f454fd82bdb8))
* **basket:** say why there is nothing to suggest, and offer the way out ([4c8c765](https://github.com/misterhonk/fidelity/commit/4c8c7655ff73574a98d64359670c23f6aa2019d3))


### Fixed

* **basket:** read the shipping table for the destination country ([7e72e3d](https://github.com/misterhonk/fidelity/commit/7e72e3d7ceea5110a2b8967777330bf855398ab5))
* **dig:** stop an incremental visit from passing judgement on a whole shop ([ae0fd2a](https://github.com/misterhonk/fidelity/commit/ae0fd2a5e65307433004e73d444372baa0590348))
* **discogs:** pace the whole browser, and stop mistaking a 429 for a cable ([7895acf](https://github.com/misterhonk/fidelity/commit/7895acf3460c57c06eaee00500ad36da469145fb))
* **ui:** hang the basket count on the basket, not beside it ([a1d710b](https://github.com/misterhonk/fidelity/commit/a1d710bd9b01ee9c575e1c6c4f921b027843faab))
* **ui:** put the settings gear on the line the other icons stand on ([b4c0571](https://github.com/misterhonk/fidelity/commit/b4c0571846684dffb421e249abcf571ba2c54006))
* **ui:** the twelve things a walk through the app turned up ([291dea0](https://github.com/misterhonk/fidelity/commit/291dea063ca52f8bc69964b378709e1ca3c8637e))

## [0.5.0](https://github.com/misterhonk/fidelity/compare/v0.4.2...v0.5.0) (2026-08-10)


### Added

* **basket:** take the records already picked out on Discogs ([9f453cf](https://github.com/misterhonk/fidelity/commit/9f453cfbe6a2505934838b3935974ffe391bc9af))

## [0.4.2](https://github.com/misterhonk/fidelity/compare/v0.4.1...v0.4.2) (2026-08-10)


### Fixed

* **ui:** stop three rows running off the right edge of a phone ([30b522a](https://github.com/misterhonk/fidelity/commit/30b522a0873529f028f15be5be622c0de4c8d21f))

## [0.4.1](https://github.com/misterhonk/fidelity/compare/v0.4.0...v0.4.1) (2026-08-10)


### Fixed

* **basket:** keep a basket per shop instead of deleting the last one ([dc55fb0](https://github.com/misterhonk/fidelity/commit/dc55fb0c46be1d172dce3b18dcbb49f80dbdec48))

## [0.4.0](https://github.com/misterhonk/fidelity/compare/v0.3.1...v0.4.0) (2026-08-10)


### Added

* **dig:** fetch only what a shop has listed since the last visit ([fd94338](https://github.com/misterhonk/fidelity/commit/fd9433800e93ec97dfea4b002b01ec3bae648a19))

## [0.3.1](https://github.com/misterhonk/fidelity/compare/v0.3.0...v0.3.1) (2026-08-10)


### Fixed

* **ui:** stop the setup saying the same thing twice ([7dbf2c2](https://github.com/misterhonk/fidelity/commit/7dbf2c2e063b4a4a060fbf8654aa10828da2b7e5))

## [0.3.0](https://github.com/misterhonk/fidelity/compare/v0.2.1...v0.3.0) (2026-08-10)


### Added

* **ui:** a setup that runs from the token to the first dig ([6872b24](https://github.com/misterhonk/fidelity/commit/6872b24292dfeeff07fa58f7fe5f39a62db3b7d6))

## [0.2.1](https://github.com/misterhonk/fidelity/compare/v0.2.0...v0.2.1) (2026-08-10)


### Changed

* **ui:** four type sizes, one accent, one grid ([163b0e0](https://github.com/misterhonk/fidelity/commit/163b0e0304fb8f27eeef1beec5b211e29be98059))

## [0.2.0](https://github.com/misterhonk/fidelity/compare/v0.1.0...v0.2.0) (2026-08-10)


### Added

* **auth:** add token entry, identity check and sign-out ([694ea04](https://github.com/misterhonk/fidelity/commit/694ea04fc31275e81b53e3e52601da2b38a29aff))
* **basket:** add the basket, shipping tiers and the optimiser ([5db12ae](https://github.com/misterhonk/fidelity/commit/5db12aeedcbe791cf8a9b1d5e33aa2b6dee9364d))
* **basket:** ask whether the basket is still there ([29d20b2](https://github.com/misterhonk/fidelity/commit/29d20b2988cec333d337dc517acf6f109090da8f))
* **basket:** fill the basket from the shortlist ([b59eef8](https://github.com/misterhonk/fidelity/commit/b59eef8a68d574a6ee72de3a85bb3d1a60361d4e))
* **db:** Dropbox and Drive, with your registration rather than mine ([00cfa81](https://github.com/misterhonk/fidelity/commit/00cfa8160c6f62f78a6adff110fa6a94db42e4a0))
* **db:** the vault — what travels between devices, and what never does ([6b3e9d5](https://github.com/misterhonk/fidelity/commit/6b3e9d5c71d21f29561b566dc79749a4d70afc47))
* **db:** the vault in a file somebody else's client syncs ([d06a8bf](https://github.com/misterhonk/fidelity/commit/d06a8bf58a93967807cd41b053301f8ed88570ad))
* **dealers:** find the shops Discogs already knows you deal with ([1e727c0](https://github.com/misterhonk/fidelity/commit/1e727c01194fc419caf70735c9d3d25ab33190e6))
* **deploy:** app and hub as two Docker services that ignore each other ([874c1a8](https://github.com/misterhonk/fidelity/commit/874c1a8273928cdf8bf605e6325dd704b28cfcdd))
* **dig:** add the credit-graph explorer ([50efe9e](https://github.com/misterhonk/fidelity/commit/50efe9e0b99873f605e065203644334e7c4fe733))
* **dig:** add the style pass and the dealer fingerprint ([94f8533](https://github.com/misterhonk/fidelity/commit/94f8533b3a2680e4fd4ec4cc35534f00bef804aa))
* **dig:** add the Top Five and fold duplicate copies ([d9e5b9c](https://github.com/misterhonk/fidelity/commit/d9e5b9c037b332706c2764b757cc6684f41cddc7))
* **dig:** refresh an expired dig for one request per match ([8e6dc85](https://github.com/misterhonk/fidelity/commit/8e6dc858fed924f8aa39554e84f3a9f1b83ef021))
* **dig:** resume an interrupted scan instead of restarting it ([4a3cfc8](https://github.com/misterhonk/fidelity/commit/4a3cfc86c150b8186a475d9b46ecdb97d5607dba))
* **dig:** scan a dealer and score what comes back ([9871ee0](https://github.com/misterhonk/fidelity/commit/9871ee0e49de91dff35a010540bdce1745c5c8f8))
* **dig:** walk a big shop in thirteen orderings instead of one ([8686481](https://github.com/misterhonk/fidelity/commit/86864817811e0c4134468912cf5b276beb0babff))
* **discogs:** add the paced api client ([3ee88c7](https://github.com/misterhonk/fidelity/commit/3ee88c72dfe173ac6bda18361c7db6fbb1671d90))
* **discogs:** sync collection and wantlist as a delta ([d92c6af](https://github.com/misterhonk/fidelity/commit/d92c6afeb2c92ca10694c1f6170b1125d193850d))
* **horizon:** add staggered revalidation and on-demand master expansion ([0aaf412](https://github.com/misterhonk/fidelity/commit/0aaf412c1fb7582ea53a3243a7ff1db23eb0cd56))
* **horizon:** expand the collection into release-id sets ([8b4b4da](https://github.com/misterhonk/fidelity/commit/8b4b4da510094b0ba5928497dea8f60cd21a790c))
* **horizon:** harvest credits off the favourite records ([5914d6d](https://github.com/misterhonk/fidelity/commit/5914d6d9ef4dd602e56c029b02e4fea4a1897717))
* **hub:** add the optional hub — horizon cache and shipping ladders ([9ecee9f](https://github.com/misterhonk/fidelity/commit/9ecee9f10118496fa3e2ca2a82a837c05e177a8e))
* **hub:** the vault — one block per person, unreadable to the hub ([f51b31e](https://github.com/misterhonk/fidelity/commit/f51b31ef272101ac8e65a84d77a63ddcd129bd3c))
* **match:** add the Barry score and the trigram stage ([5921193](https://github.com/misterhonk/fidelity/commit/5921193cd40da63716ff31826ff7ae96f0b39b1d))
* **match:** add the five signals the horizon unlocks ([defe2d9](https://github.com/misterhonk/fidelity/commit/defe2d9893cd2c6dea2b4b29b1b7a37a7b3c757b))
* **match:** add the pressing advice ([619d664](https://github.com/misterhonk/fidelity/commit/619d6646c8bff89a12a09a2f46662668e2a00789))
* **match:** add the price and scarcity signals ([203a502](https://github.com/misterhonk/fidelity/commit/203a502feea617cf81bf4aabbdcb36c57539293f))
* **match:** compute the taste profile and add Deine Landkarte ([9893b8e](https://github.com/misterhonk/fidelity/commit/9893b8e6d220794861d7d20d136133f1765a4f50))
* **match:** make "prefer originals" do something ([4e77a98](https://github.com/misterhonk/fidelity/commit/4e77a98b5ada41d5413e7cc684495b2c3d4a91cb))
* **pwa:** add the offline mode, the coach mark and the in-store screen ([c264d35](https://github.com/misterhonk/fidelity/commit/c264d35fcb8856dc529f87a6bf5333fab63c7649))
* **pwa:** cache covers, and measure the worker honestly ([307ba9b](https://github.com/misterhonk/fidelity/commit/307ba9b567501a1b4e8d1ae70e7c4e197b85ec76))
* **ui:** add a theme switch and stop iOS zooming on focus ([bae08fa](https://github.com/misterhonk/fidelity/commit/bae08fa4a51eed15d2a6ff4a8854729921188f8e))
* **ui:** add an icon set and lift the nav bar off the edges ([acdd7cf](https://github.com/misterhonk/fidelity/commit/acdd7cfc4732c1037d97f6dd0af0fa976bc35857))
* **ui:** add attribution, legal pages, export and real error messages ([ca8636c](https://github.com/misterhonk/fidelity/commit/ca8636cd04034bdb040f2f4d916f4d924a9f8b31))
* **ui:** add the clerk's take, the dealer profile screen ([6020a82](https://github.com/misterhonk/fidelity/commit/6020a823d4fe709f3c6718e095977822d6e9a80e))
* **ui:** add the feedback buttons that calibrate barry ([361238b](https://github.com/misterhonk/fidelity/commit/361238b608e19d64445754b187c0809a10531956))
* **ui:** add the filter bar, sorting and the density switch ([3b584a1](https://github.com/misterhonk/fidelity/commit/3b584a1c36934dd94f9d01c22feae8c921252da1))
* **ui:** add the next step, the a11y audit and honest Lighthouse numbers ([d49cb80](https://github.com/misterhonk/fidelity/commit/d49cb806fd23be9c93f8a9051287d098db7bb2e4))
* **ui:** add the release detail sheet ([75944d4](https://github.com/misterhonk/fidelity/commit/75944d481324971c966235f1566258e0d55d58f4))
* **ui:** add the virtualised list and the command palette ([44d9ba9](https://github.com/misterhonk/fidelity/commit/44d9ba9bec8b15dd415d16a53b5356e26a5211de))
* **ui:** answer "habe ich die schon?" with the record in your hand ([e0ab5eb](https://github.com/misterhonk/fidelity/commit/e0ab5eb5f312a7692ab49ebda69ed87afad88e09))
* **ui:** give the app a navigation and a settings area ([b867450](https://github.com/misterhonk/fidelity/commit/b8674509417107722b74b491cebeac21af03d0c8))
* **ui:** keep a shortlist that outlives the dig ([010b1e9](https://github.com/misterhonk/fidelity/commit/010b1e9d1c3e5a314334072bbf950e0ba56f4760))
* **ui:** let somebody actually set what a dig looks for ([4e77a98](https://github.com/misterhonk/fidelity/commit/4e77a98b5ada41d5413e7cc684495b2c3d4a91cb))
* **ui:** let the data screens use the screen ([2f90594](https://github.com/misterhonk/fidelity/commit/2f9059448ad0a974976f295e8c571fb2e0bfe53a))
* **ui:** let the shortlist change its mind ([0be76ba](https://github.com/misterhonk/fidelity/commit/0be76ba3ba246f1355da7babc84b6e7f6b6934eb))
* **ui:** make the dashboard numbers lead somewhere ([099af2b](https://github.com/misterhonk/fidelity/commit/099af2bc46f9a56fed4c4b4c33021aa09530f4d3))
* **ui:** make the start screen the collection rather than a report ([a61e4b3](https://github.com/misterhonk/fidelity/commit/a61e4b3056fcfa079e7c1780dd5248a2e0bf9195))
* **ui:** Presswerk as the default, and the switch stays ([7ce8940](https://github.com/misterhonk/fidelity/commit/7ce89403c683ab880e0c60e0cbfd8259ed81bf9a))
* **ui:** set the vault up once, then stop thinking about it ([1ca0ac8](https://github.com/misterhonk/fidelity/commit/1ca0ac8dad07c959dd84899b481688a62f40a41f))
* **ui:** show the wantlist ([996a6a5](https://github.com/misterhonk/fidelity/commit/996a6a54d9c2739f155d7bdf5b3f3bb9c37d3acc))
* **ui:** tell the map how much of a label and an artist you actually have ([268b504](https://github.com/misterhonk/fidelity/commit/268b5044e72869998a97cf3b569421c30607b81b))
* **ui:** the match list goes multi-column, and shops are one click ([b4e3cb3](https://github.com/misterhonk/fidelity/commit/b4e3cb3591460df4eecbbf0d9bd779697b13457e))
* **ui:** three type sets, switchable in front of real data ([18cd035](https://github.com/misterhonk/fidelity/commit/18cd035f298cf8eea67084b2bb064a33b86f1e8c))
* **ui:** your records, as a shelf ([a8cb54f](https://github.com/misterhonk/fidelity/commit/a8cb54f563c9e660fa527f9fbbbaacc32a3c0718))
* **watch:** add the watchlist and its cheap change detector ([7b32064](https://github.com/misterhonk/fidelity/commit/7b320646e561d5519f816979ca2ce25986fe01de))


### Fixed

* **basket:** stop silently discarding a shipping table ([5db12ae](https://github.com/misterhonk/fidelity/commit/5db12aeedcbe791cf8a9b1d5e33aa2b6dee9364d))
* **build:** stop the size budget measuring the wrong file ([d49cb80](https://github.com/misterhonk/fidelity/commit/d49cb806fd23be9c93f8a9051287d098db7bb2e4))
* **deploy:** the shell went out with no cache directive at all ([d6f2270](https://github.com/misterhonk/fidelity/commit/d6f22701118261f45a5ceb4588320922c7c8f722))
* **dig:** stop offering a running scan as resumable ([3326723](https://github.com/misterhonk/fidelity/commit/33267239c0450a53552d28d66695052e4dbb5f19))
* **match:** correct the artist cascade and drop an invented weighting ([9c31270](https://github.com/misterhonk/fidelity/commit/9c3127036e062315b96687abc9a9028f0e2de393))
* **match:** stop offering a CD as an upgrade for a CD ([5abef63](https://github.com/misterhonk/fidelity/commit/5abef63df8f91bf7ed45655b0b5eb0b05023b327))
* tag releases as v0.1.0, not fidelity-v0.1.0 ([7d36b1b](https://github.com/misterhonk/fidelity/commit/7d36b1b7349ac5d2e4be8416efc907724f75ffcc))
* **ui:** give every text-link action its 24 pixels ([a713817](https://github.com/misterhonk/fidelity/commit/a713817c9186bb332a31251b8b6609cf6d142526))
* **ui:** give the nav bar the room the home indicator takes ([6892e06](https://github.com/misterhonk/fidelity/commit/6892e0609ab28c7f94768d0bc2bb5713c8c6d355))
* **ui:** make the digs that are kept actually reachable ([4e66aa6](https://github.com/misterhonk/fidelity/commit/4e66aa63ebc010ebfe7750a02eded338756db273))
* **ui:** raise the light-mode accent to step 700 for AA contrast ([fe5dc9d](https://github.com/misterhonk/fidelity/commit/fe5dc9d3d0b28477967cf62f78f665f2e6f06c24))
* **ui:** roll back an optimistic click that did not survive ([86f54e3](https://github.com/misterhonk/fidelity/commit/86f54e3b80b80674ecfeed2bea168e92bdf36c52))
* **ui:** show the navigation on pages that do not ask who is signed in ([c06d716](https://github.com/misterhonk/fidelity/commit/c06d7167b2ba3bec8296eb044c79afd3d6872f4c))
* **ui:** stop hiding dealers that were never scanned ([7b32064](https://github.com/misterhonk/fidelity/commit/7b320646e561d5519f816979ca2ce25986fe01de))
* **ui:** stop reporting real storage as "0 MB" ([b867450](https://github.com/misterhonk/fidelity/commit/b8674509417107722b74b491cebeac21af03d0c8))
* **ui:** stop the footer hiding behind the mobile tab bar ([b867450](https://github.com/misterhonk/fidelity/commit/b8674509417107722b74b491cebeac21af03d0c8))
* **ui:** stop the segmented controls stretching across a monitor ([3a7a144](https://github.com/misterhonk/fidelity/commit/3a7a14456ab0b490f1f354297ab72b3781ffda10))
* **ui:** write the numbers out where they are read as words ([c46a525](https://github.com/misterhonk/fidelity/commit/c46a5258ad30e5137b38175621ef517fce124477))
* **watch:** scanning a shop no longer stops watching it ([0dc657f](https://github.com/misterhonk/fidelity/commit/0dc657ff5ed84d5dea298df6ec098898b88414a3))
* **watch:** stop the first check reporting a whole shop as new ([7b32064](https://github.com/misterhonk/fidelity/commit/7b320646e561d5519f816979ca2ce25986fe01de))
* **worker:** stop throwing away the reason a request failed ([ca8636c](https://github.com/misterhonk/fidelity/commit/ca8636cd04034bdb040f2f4d916f4d924a9f8b31))


### Changed

* **ui:** extract CatalogRunGrid from the detail sheet ([50efe9e](https://github.com/misterhonk/fidelity/commit/50efe9e0b99873f605e065203644334e7c4fe733))
* **ui:** make settings an index with pages behind it ([7863683](https://github.com/misterhonk/fidelity/commit/7863683c4bd5e9bc9f6541191486e5b09fe623c5))
* **ui:** put the reasoning one click behind the number ([db903b5](https://github.com/misterhonk/fidelity/commit/db903b5df0f6fd7f9d85e528154574d6161dae43))
* **ui:** say the same word in the tab and on the page ([92650dd](https://github.com/misterhonk/fidelity/commit/92650dddbafb1ae90756677b1da03fc46c1a3b8e))
* **ui:** stop shipping a component library this app never renders ([c06d716](https://github.com/misterhonk/fidelity/commit/c06d7167b2ba3bec8296eb044c79afd3d6872f4c))
* **worker:** defer the enrichment pass ([619d664](https://github.com/misterhonk/fidelity/commit/619d6646c8bff89a12a09a2f46662668e2a00789))
* **worker:** defer the horizon build, and stop the budget lying ([307ba9b](https://github.com/misterhonk/fidelity/commit/307ba9b567501a1b4e8d1ae70e7c4e197b85ec76))
* **worker:** split the basket and detail sheet out of the worker ([5db12ae](https://github.com/misterhonk/fidelity/commit/5db12aeedcbe791cf8a9b1d5e33aa2b6dee9364d))

## [Unreleased]

## [0.1.0] - 2026-08-09

**M0 · Fundament.** Eine leere, aber vollständig verdrahtete PWA: `pnpm dev`
startet sie, `pnpm build` erzeugt statische Dateien, und alle Prüfungen laufen
durch. Ein Dig ist noch nicht drin – der kommt mit M2.

### Added

- **Nuxt 4.5 als statisch generierte SPA** (`ssr: false`), Vue 3.5, TypeScript
  im `strict`-Modus. Kein Node zur Laufzeit, das Deployment ist ein Docroot.
- **IndexedDB-Datenmodell** über `idb` (~2 KB): neun Stores samt Indizes,
  Präferenzen mit Default-Merge, und der Verfallsjob, der die 6-Stunden-Regel
  der Discogs-ToS durchsetzt – Marktplatzfelder werden genullt, Score, Signale
  und Begründung bleiben.
- **Web Worker mit typisiertem `postMessage`-Protokoll.** Request/Response mit
  offenem Fortschrittskanal und Abbruch über `AbortSignal`. Der Main-Thread
  rendert, sonst nichts.
- **Design Tokens im DTCG-Format** (`tokens/*.json`) → Style Dictionary →
  Tailwind-4-`@theme`. OKLCH durchgehend, Farbschema-Rollen als eine einzige
  `light-dark()`-Deklaration, fluide Typo-Skala mit erzwungenem `rem`-Term
  (WCAG 1.4.4). Dazu Nuxt UI 4.
- **PWA**: Manifest, Maskable-Icons aus den Tokens gerendert, und
  `registerType: 'prompt'` samt Update-Banner – ein stilles `skipWaiting`
  würde den Code mitten in einem laufenden Dig austauschen.
- **Die drei Hub-Ports** (`HorizonSource`, `ShippingProfileSource`,
  `WatchService`) mit lokalen Implementierungen und der Fallback-Kette:
  2 s Timeout, kein Retry, lautloser Rückfall. Ein kaputter oder gar nicht
  vorhandener Hub ist ununterscheidbar (ADR-008).
- **Toolchain**: ESLint 10 mit `@nuxt/eslint`, Prettier, lefthook,
  commitlint, Vitest 4 mit `fake-indexeddb`, Playwright inklusive WebKit und
  `@axe-core/playwright`.
- **CI** mit Bundle-Budget: 120 KB gzip für den ersten sinnvollen Paint,
  Überschreitung bricht den Build. Alle Actions auf Commit-SHA gepinnt.
- **release-please** mit Keep-a-Changelog-Mapping.
- Projektkonzept und vollständige Architekturdokumentation unter `docs/`,
  ADR-001 bis ADR-008, HTML-Onepager und UI-Wireframes (9 Screens).

### Changed

Entscheidungen, die während M0 revidiert wurden – vor dem ersten Release, also
ohne Migrationspfad:

- **Architektur auf reine Client-PWA umgestellt (ADR-007).** Kein Backend,
  keine Datenbank, kein Serverprozess. Grundlage: Discogs erlaubt CORS aus dem
  Browser (`allow-origin: *`, `authorization` erlaubt), am 2026-08-09
  verifiziert. Der eigentliche Gewinn ist das Rate-Limit – es gilt pro IP, im
  Browser also pro Nutzer statt einmal für alle.
- Speicher von PostgreSQL auf IndexedDB umgestellt.
- Auth von OAuth 1.0a auf Personal Access Token
  (`POST /oauth/access_token` ist per CORS gesperrt).
- Katalogdaten: Volldump (10,4 GB) durch bedarfsgesteuerten Horizont ersetzt
  (ADR-005).
- Deployment auf statisches Hosting reduziert.

### Known Issues

- Der erste sinnvolle Paint liegt bei 114 von 120 KB gzip – und das mit einer
  leeren App. Nuxt UI und sein CSS machen den Löwenanteil aus.
- `--fid-accent` erreicht im Light Mode nur 3,09:1 gegen `--fid-bg` und
  verfehlt damit WCAG 2.2 AA für Fließtext. Betroffene Stellen weichen
  vorerst auf `--fid-text` aus.

[Unreleased]: https://github.com/misterhonk/fidelity/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/misterhonk/fidelity/releases/tag/v0.1.0
