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
 * which label, in which year, in whose shop. The demo fetches the rest live.
 *
 * Each of these was verified against the live inventory on 2026-08-10, and
 * chosen because the shop demonstrably holds neighbours — records by the same
 * artist, on the same label, in the same catalogue series. A seed with nothing
 * around it produces an empty demo, which is worse than no demo.
 *
 * A shop sells records, so one of these will eventually be gone. That is not a
 * failure to prevent but one to survive: the demo says so and offers the
 * others.
 *
 * **The order is the interleaving, not a ranking.** Three are shown at a time
 * and they are taken consecutively, so a list grouped by genre would offer
 * three German new-wave singles from one shop on a Tuesday and three techno
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
  /** What this one is meant to show — the honest reason it is in the list. */
  promise: string
}

export const DEMO_SEEDS: DemoSeedOption[] = [
  {
    listingId: 4309313268,
    artist: 'Kraftwerk',
    title: 'Das Model',
    label: 'Kling Klang',
    year: 1978,
    dealer: 'schoenwettermusik',
    promise: 'Der Laden hat noch eine zweite Kraftwerk-Single von 1978.',
  },
  {
    listingId: 3921870991,
    artist: 'Joey Beltram',
    title: 'Energy Flash',
    label: 'R & S Records',
    year: 2014,
    dealer: '430AM_Studio',
    promise: 'Zwei weitere Beltram, dazu vier auf R & S.',
  },
  {
    listingId: 4308995931,
    artist: 'The Clash',
    title: 'London Calling',
    label: 'Columbia',
    year: 1999,
    dealer: 'schoenwettermusik',
    promise: 'Sieben weitere Clash-Platten stehen dort im Regal.',
  },
  {
    listingId: 3721514041,
    artist: 'AIR',
    title: 'Moon Safari',
    label: 'Parlophone',
    year: 2023,
    dealer: '430AM_Studio',
    promise: 'Talkie Walkie steht im selben Laden.',
  },
  {
    listingId: 4309361919,
    artist: 'Trio',
    title: 'Herz Ist Trumpf',
    label: 'Mercury',
    year: 1983,
    dealer: 'schoenwettermusik',
    promise: 'Mitten in einer Kiste Neuer Deutscher Welle von 1982/83.',
  },
  {
    listingId: 4261867251,
    artist: 'Audion',
    title: 'Suckfish',
    label: 'Spectral Sound',
    year: 2005,
    dealer: 'spirax.records',
    promise: 'Die Serie SPC-28 bis SPC-52 liegt dort fast lückenlos.',
  },
  {
    listingId: 4309286094,
    artist: 'The Who',
    title: 'My Generation',
    label: 'MCA Records',
    year: 2002,
    dealer: 'schoenwettermusik',
    promise: 'Vierzehn weitere von The Who — der dichteste Fund im Laden.',
  },
  {
    listingId: 3446612022,
    artist: 'Pet Shop Boys',
    title: 'Suburbia',
    label: 'Parlophone',
    year: 1986,
    dealer: '430AM_Studio',
    promise: 'Noch eine Pet-Shop-Boys-Platte und sechs auf Parlophone.',
  },
  {
    listingId: 4309363227,
    artist: 'Hubert Kah',
    title: 'Rosemarie',
    label: 'Polydor',
    year: 1982,
    dealer: 'schoenwettermusik',
    promise: 'Siebzehn Singles derselben Jahre stehen daneben.',
  },
  {
    listingId: 4274557002,
    artist: 'not even noticed',
    title: 'Feel EP',
    label: 'eudemonia',
    year: 2024,
    dealer: 'spirax.records',
    promise: 'Zehn weitere Platten desselben Künstlers im selben Laden.',
  },
  {
    listingId: 4309120548,
    artist: 'Bob Dylan',
    title: 'John Wesley Harding',
    label: 'Columbia',
    year: 2003,
    dealer: 'schoenwettermusik',
    promise: 'Zwölf weitere Dylan-Platten liegen dort.',
  },
  {
    listingId: 4218677304,
    artist: 'Marek Hemmann',
    title: 'Gemini EP',
    label: 'Freude Am Tanzen',
    year: 2009,
    dealer: 'fatplastics',
    promise: 'Zwei weitere Hemmann, sechzehn auf Freude Am Tanzen, dazu die Katalogserie.',
  },
  {
    listingId: 4309358271,
    artist: 'Rheingold',
    title: 'Dreiklangs-Dimensionen',
    label: 'Welt-Rekord',
    year: 1981,
    dealer: 'schoenwettermusik',
    promise: 'Deutsche Elektronik von 1981, mit Nachbarn.',
  },
]

/** How many are offered at once. Three is a choice; ten is a catalogue. */
export const SEEDS_SHOWN = 3

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
