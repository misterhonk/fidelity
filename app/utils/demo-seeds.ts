/**
 * Platten, mit denen sich anfangen lässt.
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
 * **Every promise below is a count, and every count was counted.** The shop's
 * newest five hundred listings were read on 2026-08-10 and the neighbours
 * tallied by hand; the numbers in `promise` are those tallies.
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
 * failure to prevent but one to survive: the demo says so and offers the
 * others.
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
  artist: string
  title: string
  label: string
  year: number
  dealer: string
  /**
   * Das Cover, in klein und in groß.
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
  /** What this one is meant to show — the honest reason it is in the list. */
  promise: string
}

/**
 * Die Ladenschilder.
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
    listingId: 4309313268,
    artist: 'Kraftwerk',
    title: 'Das Model',
    label: 'Kling Klang',
    year: 1978,
    dealer: 'schoenwettermusik',
    promise: 'Noch eine Kraftwerk-Single von 1978.',
    ...cover(
      'zbmCQ3oQX7MDzH86obw83VMZurH6H-iuVgLLi-HEYxA',
      '3owBPyalmlALOmsZAhko6JXvKjCU6CQ4SnkkxbUdHOw',
      'h:594/w:600',
      'czM6Ly9kaXNjb2dz/LWRhdGFiYXNlLWlt/YWdlcy9SLTYzNjE1/OS0xMTQxNTUxMTA2/LmpwZWc',
    ),
  },
  {
    listingId: 3921870991,
    artist: 'Joey Beltram',
    title: 'Energy Flash',
    label: 'R & S Records',
    year: 2014,
    dealer: '430AM_Studio',
    promise: 'Noch ein Beltram im selben Laden.',
    ...cover(
      'v33DzOvDLL31wLhJNIhH9nX7mRjQV_msHqAOkXgLAuI',
      'p0w54Y-lMjsd33l5NFvO9lpq-JBTVcZ1Ef-LVxhOVd0',
      'h:592/w:600',
      'czM6Ly9kaXNjb2dz/LWRhdGFiYXNlLWlt/YWdlcy9SLTYwODkx/OTAtMTU5MzQ2NDUw/Mi00Nzg3LmpwZWc',
    ),
  },
  {
    listingId: 4308995931,
    artist: 'The Clash',
    title: 'London Calling',
    label: 'Columbia',
    year: 1999,
    dealer: 'schoenwettermusik',
    promise: 'Sieben weitere Clash-Platten im Regal.',
    ...cover(
      'R2k8XMELB8QRy7vkkLHq1di6iJ4YnHJGFt-h1bNuYTc',
      'Wthl0F7gLYCvuFtZpQSYfhco_3hfArxGdgczoADJrp4',
      'h:597/w:594',
      'czM6Ly9kaXNjb2dz/LWRhdGFiYXNlLWlt/YWdlcy9SLTMxNjYw/MjEtMTM0ODM0MjY3/MS05NDgyLmpwZWc',
    ),
  },
  {
    listingId: 3721514041,
    artist: 'AIR',
    title: 'Moon Safari',
    label: 'Parlophone',
    year: 2023,
    dealer: '430AM_Studio',
    promise: 'Talkie Walkie steht im selben Laden.',
    ...cover(
      'XrLzzdMAIL5QaHVghvH0DZQwjQZybt8gFQIA_pDOIW0',
      'QxsMavZoWkfRNKhrkblNR8HwHXZXysy8hFhOCR6_tac',
      'h:594/w:600',
      'czM6Ly9kaXNjb2dz/LWRhdGFiYXNlLWlt/YWdlcy9SLTMxNDE5/MzY4LTE3MzQ1Mjcx/ODMtNTEwNi5qcGVn',
    ),
  },
  {
    listingId: 4309125996,
    artist: 'Die Toten Hosen',
    title: 'Reich & Sexy',
    label: 'Totenkopf',
    year: 1993,
    dealer: 'schoenwettermusik',
    promise: 'Sechs weitere von den Toten Hosen.',
    ...cover(
      'MEQzsnWMz7dZb67FuSiPQ4e-yzxYhDml2DPe8Plzwig',
      'RiglYEbPKn47qsmWrM3fUomHKlzfqqsk9nVLzLYuFpE',
      'h:593/w:600',
      'czM6Ly9kaXNjb2dz/LWRhdGFiYXNlLWlt/YWdlcy9SLTQ1MjQx/Ni0xNzA2MjYwMzc1/LTEyNTMuanBlZw',
    ),
  },
  {
    /*
     * Audion – Sky/Motormouth Remixes, nicht Suckfish.
     *
     * Suckfish sat here and made the same point about the SPC catalogue run,
     * but Discogs holds no image for that pressing — one grey square in a row
     * of three covers, on the one screen whose whole job is to look like a
     * record shop. Same artist, same label, same series, and a sleeve.
     */
    listingId: 4224333861,
    artist: 'Audion',
    title: 'Sky / Motormouth Remixes',
    label: 'Spectral Sound',
    year: 2014,
    dealer: 'spirax.records',
    promise: 'Noch ein Audion auf Spectral Sound.',
    ...cover(
      'mENrQPhtGSDdoaQL5V8qkZMXeVRgmqWeF3MEyHPkmM8',
      'k9nPQmhkjtvRwZlV4iamWl6zH7-eNRjJgW1hf2KQYaI',
      'h:600/w:600',
      'czM6Ly9kaXNjb2dz/LWRhdGFiYXNlLWlt/YWdlcy9SLTU4NjYw/MDYtMTQxMDA0Mzcw/NS02NTcxLmpwZWc',
    ),
  },
  {
    listingId: 4309286094,
    artist: 'The Who',
    title: 'My Generation',
    label: 'MCA Records',
    year: 2002,
    dealer: 'schoenwettermusik',
    promise: 'Vierzehn weitere von The Who.',
    ...cover(
      's4kc87yQLO4Kz3w6Yo2HrYM0gcbMQNnJPkzbYAugwxM',
      '31vKgRzBBOtonidx6mCfCK9ViSi82lkxCwr-M3iDSyM',
      'h:544/w:600',
      'czM6Ly9kaXNjb2dz/LWRhdGFiYXNlLWlt/YWdlcy9SLTI5OTIz/MzYtMTU0MTM5NjM0/Ni03NzAzLmpwZWc',
    ),
  },
  {
    listingId: 3446612022,
    artist: 'Pet Shop Boys',
    title: 'Suburbia',
    label: 'Parlophone',
    year: 1986,
    dealer: '430AM_Studio',
    promise: 'Noch eine Pet-Shop-Boys-Platte.',
    ...cover(
      'tIK3PB3VkvqYdcRztjk7DfLd8_wCqnCQFU1UeX73p7M',
      'R7jVaCtzU0-D29eBIIkkFYXy_dW-KVs6ErdRmNFOL6I',
      'h:592/w:600',
      'czM6Ly9kaXNjb2dz/LWRhdGFiYXNlLWlt/YWdlcy9SLTE1MTI2/MC0xNzEzNzk5NDIy/LTEwODQuanBlZw',
    ),
  },
  {
    listingId: 4309359201,
    artist: 'Deep Purple',
    title: 'Machine Head',
    label: 'Purple Records',
    year: 2012,
    dealer: 'schoenwettermusik',
    promise: 'Neun weitere Deep-Purple-Platten liegen dort.',
    ...cover(
      'f35uGihhfUzFRw8rbyrwPJBaaqdSmlVqJIujfU_7JZk',
      'wDAri2X3oMTcU1Mi0vPdGus7L94bXcqiWnNfjlcHi_w',
      'h:600/w:566',
      'czM6Ly9kaXNjb2dz/LWRhdGFiYXNlLWlt/YWdlcy9SLTM5NjA1/MDAtMTY4MjgzODg5/OS03NDE4LmpwZWc',
    ),
  },
  {
    listingId: 4274557002,
    artist: 'not even noticed',
    title: 'Feel EP',
    label: 'eudemonia',
    year: 2024,
    dealer: 'spirax.records',
    promise: 'Zehn weitere desselben Künstlers.',
    ...cover(
      'TptviHATua_z2bAdfigEHjyR7ZPwf-VYAds_uKalA-U',
      'Q-p3Agll867rhvRC_nvOXsNYdzdUcLSU_9jmoOJ4Nb8',
      'h:600/w:600',
      'czM6Ly9kaXNjb2dz/LWRhdGFiYXNlLWlt/YWdlcy9SLTMyMDQ0/MzYyLTE3MjkzMjI0/NDEtMTIzMS5qcGVn',
    ),
  },
  {
    listingId: 4309120548,
    artist: 'Bob Dylan',
    title: 'John Wesley Harding',
    label: 'Columbia',
    year: 2003,
    dealer: 'schoenwettermusik',
    promise: 'Zwölf weitere Dylan-Platten liegen dort.',
    ...cover(
      'OPx_NImYs-Elj4yLSbhPJOxUAaCiH65zEkXuDxrjYKQ',
      'TzLVG4AyfZO8Y9cTcLVdScO-7e7UwkwNBsIhmvlIp5g',
      'h:600/w:600',
      'czM6Ly9kaXNjb2dz/LWRhdGFiYXNlLWlt/YWdlcy9SLTM5NjIz/NS0xNjQ4NTQ4Nzk1/LTMzMzkuanBlZw',
    ),
  },
  {
    listingId: 4218677304,
    artist: 'Marek Hemmann',
    title: 'Gemini EP',
    label: 'Freude Am Tanzen',
    year: 2009,
    dealer: 'fatplastics',
    promise: 'Zwei weitere Hemmann im Laden.',
    ...cover(
      'PTGyNjQoisUYJsn1DThMEXbcIWRVVYpu6mVrDn9K-Sw',
      '3ayQvChu2PrjH073K9jfbGSm7K-hPUrjnNbd6-r2EXM',
      'h:600/w:592',
      'czM6Ly9kaXNjb2dz/LWRhdGFiYXNlLWlt/YWdlcy9SLTE3ODY0/MzUtMTM1ODY3MjI0/NS05NDQzLmpwZWc',
    ),
  },
  {
    listingId: 4309372362,
    artist: 'Puhdys',
    title: "Hey, Wir Woll'n Die Eisbär'n Sehn!",
    label: 'BuschFunk',
    year: 2009,
    dealer: 'schoenwettermusik',
    promise: 'Sechsundzwanzig weitere Puhdys stehen dort.',
    ...cover(
      'HBjabLWOMPAd3VnhRNq773OC3oe-WPZ1GFmlx0ph22c',
      'id7dMpDjcD2lMW166mqfrr_INiITe9ksBXF1HjvG3aE',
      'h:446/w:500',
      'czM6Ly9kaXNjb2dz/LWRhdGFiYXNlLWlt/YWdlcy9SLTgwODY4/ODktMTQ1NDg3MzI0/My0zMTE1LmpwZWc',
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
 * Drei aus dem Vorrat, die sich täglich weiterdrehen.
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
