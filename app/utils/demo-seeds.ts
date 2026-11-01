import type { Language } from '~/composables/useMessages'

/**
 * Records to start from.
 *
 * The demo works from any Discogs listing URL, which is fine for somebody who
 * already has one in mind and useless for somebody who does not: "go to
 * Discogs, find a record, copy the address, come back" is four steps of
 * friction at the exact moment you are trying to remove it. These are one
 * click.
 *
 * **No prices and no conditions here.** Those are marketplace data and may not
 * be shown once they are six hours old (CLAUDE.md rule 4) — a price frozen
 * into the source would be stale the same afternoon and wrong by the week.
 * What is stored is what does not change: who made it, what it is called, on
 * which label, in which year, in whose shop, and what the sleeve looks like.
 * The demo fetches the rest live.
 *
 * **Every promise below is a count, and every count was counted.** The demo
 * reads the shop sorted by artist, around the seed's artist, and the numbers
 * in `promise` are what that read found on 2026-11-01.
 *
 * **Only artists the demo can reach.** A stranger may read 10,000 listings of
 * a shop from each end of the alphabet and nothing in between. Nine seeds were
 * dropped on 2026-11-01 (#212): Kraftwerk, Dylan, Deep Purple, the Clash, the
 * Toten Hosen and the Puhdys sat in the unreachable middle of a 114,000-record
 * shop, Beltram and the Pet Shop Boys in that of a 36,000-record one, and "not
 * even noticed" had sold out. Each of them ended on "nothing fitted". A seed
 * belongs here only with a recorded shop in tests/fixtures/demo-shops.json.
 *
 * That measurement replaced three seeds. Trio, Hubert Kah and Rheingold were
 * here for their *label* and their *era* — a box of German new wave, seventeen
 * singles of the same years — and with one seed neither can fire: the label
 * signal needs two records on that label before it counts as a preference
 * (`worker/match/index.ts`, `label.n >= 2`), and the inventory carries no
 * genre at all. All three would have produced an empty demo. What replaced
 * them are artists the shop stocks in depth, because a run of one artist is
 * the one thing a single record can prove.
 *
 * The cost of that: this list no longer speaks for a shop's *sections*, only
 * for its runs. Two seeds would buy the sections back, which is what
 * `MAX_SEEDS` in worker/demo.ts is for and what nothing yet uses.
 *
 * A shop sells records, so one of these will eventually be gone. That is not a
 * failure to prevent but one to survive: each seed carries its shop and its
 * record, and the demo starts from those rather than from the listing.
 *
 * **The order is the interleaving, not a ranking.** Three are shown at a time
 * and they are taken consecutively, so a list grouped by genre would offer
 * three German rock records from one shop on a Tuesday and three techno
 * twelve-inches on a Wednesday. Sorted the way it is, every window of three
 * spans different decades, different music and different shops — which is the
 * whole point of a list that is meant to look welcoming rather than niche.
 */
export interface DemoSeedOption {
  listingId: number
  /**
   * The record behind the listing, so a sold one still works.
   *
   * Eight of these thirteen had sold or gone by 2026-10-21, and the demo
   * fetched the listing first to learn what this file already knew — the
   * shop and the record. A sold listing answers 401 without a token, which
   * read as "Discogs does not know this token" on the screen that says no
   * sign-in. Now the listing is not asked for at all.
   */
  releaseId: number
  artist: string
  title: string
  label: string
  year: number
  dealer: string
  /**
   * The cover, small and large.
   *
   * Frozen into the source, and that is deliberate. The addresses come from
   * the release, not the offer, so they are database facts rather than
   * marketplace data and rule 4 does not touch them — a cover does not go
   * stale in six hours. Fetching them live would mean thirteen requests on
   * page load against a 25-a-minute budget, to draw a screen that has not
   * been asked to do anything yet.
   *
   * Both sizes because both are used: 150 px is the whole picture on a phone
   * and a waste of nothing, 600 px is what a two-column tile needs on a
   * desktop and on every retina screen. `srcset` picks; neither is fetched
   * unless it is on screen.
   */
  thumbUrl: string
  coverUrl: string
  /**
   * What this one is meant to show — the honest reason it is in the list.
   *
   * Per language, and here rather than in a pack: the sentence is about *this*
   * record in *that* shop ("seven more Clash records on the rack"), so it
   * belongs next to the listing id it was counted from. A pack keyed by
   * listing id would be the same data one file further away.
   */
  promise: Record<Language, string>
}

/**
 * The shop signs.
 *
 * `/users/{name}` carries an `avatar_url`, and all four shops here have set a
 * real one rather than the grey default (checked 2026-08-10) — so a shop can
 * be recognised by its picture the way a record is. Frozen for the same reason
 * as the covers: a logo is not worth a request on a page that has not been
 * asked to do anything.
 */
const IMG = 'https://i.discogs.com'
const AVATAR = 'rs:fill/g:sm/q:40/h:500/w:500'

export const DEALER_LOGOS: Record<string, string> = {
  schoenwettermusik: `${IMG}/lQmsMJ91RK2Pj7oSIVWLD-3yTDH0nRCwa_HqaNml95Q/${AVATAR}/czM6Ly9kaXNjb2dz/LXVzZXItYXZhdGFy/cy9VLTEwNTAxMDMt/MTQ0ODYzNzI0MC5q/cGVn.jpeg`,
  '430AM_Studio': `${IMG}/DT0JilrZ83BjLYbMnQYLmbmbYOJ0Ico1mJ6K9o64ETk/${AVATAR}/czM6Ly9kaXNjb2dz/LXVzZXItYXZhdGFy/cy9VLTI1OTAyMi0x/NTczMDQyNzMyLmpw/ZWc.jpeg`,
  'spirax.records': `${IMG}/AkdbORjtMFw8oz5F3LRS0cbAdseemcRpcMnW7lODVbw/${AVATAR}/czM6Ly9kaXNjb2dz/LXVzZXItYXZhdGFy/cy9VLTI3MzYwNzM3/LTE3NzQ1MzA1MjQu/cG5n.jpeg`,
  fatplastics: `${IMG}/Yh2vNtZWtkW4wVdpH0425DgUxSqdz0qDDQfZwLVDCQk/${AVATAR}/czM6Ly9kaXNjb2dz/LXVzZXItYXZhdGFy/cy9VLTcxMjU5NS0x/NDEzMjcwMDY2Lmpw/ZWc.jpeg`,
}

/** Both sizes of one cover, from the part of the address that differs. */
function cover(thumbHash: string, coverHash: string, size: string, path: string) {
  return {
    thumbUrl: `${IMG}/${thumbHash}/rs:fit/g:sm/q:40/h:150/w:150/${path}.jpeg`,
    coverUrl: `${IMG}/${coverHash}/rs:fit/g:sm/q:90/${size}/${path}.jpeg`,
  }
}

export const DEMO_SEEDS: DemoSeedOption[] = [
  {
    listingId: 3721514041,
    releaseId: 31419368,
    artist: 'AIR',
    title: 'Moon Safari',
    label: 'Parlophone',
    year: 2023,
    dealer: '430AM_Studio',
    promise: {
      en: 'Talkie Walkie is in the same shop.',
      de: 'Talkie Walkie steht im selben Laden.',
    },
    ...cover(
      'XrLzzdMAIL5QaHVghvH0DZQwjQZybt8gFQIA_pDOIW0',
      'QxsMavZoWkfRNKhrkblNR8HwHXZXysy8hFhOCR6_tac',
      'h:594/w:600',
      'czM6Ly9kaXNjb2dz/LWRhdGFiYXNlLWlt/YWdlcy9SLTMxNDE5/MzY4LTE3MzQ1Mjcx/ODMtNTEwNi5qcGVn',
    ),
  },
  {
    /*
     * Audion – Sky/Motormouth Remixes, not Suckfish.
     *
     * Suckfish sat here and made the same point about the SPC catalogue run,
     * but Discogs holds no image for that pressing — one grey square in a row
     * of three covers, on the one screen whose whole job is to look like a
     * record shop. Same artist, same label, same series, and a sleeve.
     */
    listingId: 4224333861,
    releaseId: 5866006,
    artist: 'Audion',
    title: 'Sky / Motormouth Remixes',
    label: 'Spectral Sound',
    year: 2014,
    dealer: 'spirax.records',
    promise: {
      en: 'Another Audion on Spectral Sound.',
      de: 'Noch ein Audion auf Spectral Sound.',
    },
    ...cover(
      'mENrQPhtGSDdoaQL5V8qkZMXeVRgmqWeF3MEyHPkmM8',
      'k9nPQmhkjtvRwZlV4iamWl6zH7-eNRjJgW1hf2KQYaI',
      'h:600/w:600',
      'czM6Ly9kaXNjb2dz/LWRhdGFiYXNlLWlt/YWdlcy9SLTU4NjYw/MDYtMTQxMDA0Mzcw/NS02NTcxLmpwZWc',
    ),
  },
  {
    listingId: 4309286094,
    releaseId: 2992336,
    artist: 'The Who',
    title: 'My Generation',
    label: 'MCA Records',
    year: 2002,
    dealer: 'schoenwettermusik',
    promise: { en: 'Over a hundred more by The Who.', de: 'Über hundert weitere von The Who.' },
    ...cover(
      's4kc87yQLO4Kz3w6Yo2HrYM0gcbMQNnJPkzbYAugwxM',
      '31vKgRzBBOtonidx6mCfCK9ViSi82lkxCwr-M3iDSyM',
      'h:544/w:600',
      'czM6Ly9kaXNjb2dz/LWRhdGFiYXNlLWlt/YWdlcy9SLTI5OTIz/MzYtMTU0MTM5NjM0/Ni03NzAzLmpwZWc',
    ),
  },
  {
    listingId: 4218677304,
    releaseId: 1786435,
    artist: 'Marek Hemmann',
    title: 'Gemini EP',
    label: 'Freude Am Tanzen',
    year: 2009,
    dealer: 'fatplastics',
    promise: { en: 'Three more Hemmann in the shop.', de: 'Drei weitere Hemmann im Laden.' },
    ...cover(
      'PTGyNjQoisUYJsn1DThMEXbcIWRVVYpu6mVrDn9K-Sw',
      '3ayQvChu2PrjH073K9jfbGSm7K-hPUrjnNbd6-r2EXM',
      'h:600/w:592',
      'czM6Ly9kaXNjb2dz/LWRhdGFiYXNlLWlt/YWdlcy9SLTE3ODY0/MzUtMTM1ODY3MjI0/NS05NDQzLmpwZWc',
    ),
  },
]

/**
 * How many are offered at once. Four is a choice; ten is a catalogue.
 *
 * Four rather than three because the grid is two columns on a phone, and three
 * tiles in a two-column grid leave a hole where the fourth should be. Four
 * fills it, and on a wide screen it is one row of four instead of three.
 */
export const SEEDS_SHOWN = 4

/**
 * Three from the pile, rotating daily.
 *
 * Rotated by the date rather than at random: within a day the page is the same
 * page, which matters when somebody reloads it or sends the link to a friend,
 * and across days it stays interesting. `Math.random()` would reshuffle on
 * every reload and make the screen feel unreliable for no gain.
 */
export function seedsForToday(today = new Date()): DemoSeedOption[] {
  const day = Math.floor(today.getTime() / 86_400_000)
  const offset = ((day % DEMO_SEEDS.length) + DEMO_SEEDS.length) % DEMO_SEEDS.length

  return Array.from(
    { length: Math.min(SEEDS_SHOWN, DEMO_SEEDS.length) },
    (_, index) => DEMO_SEEDS[(offset + index) % DEMO_SEEDS.length]!,
  )
}
