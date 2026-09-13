#!/usr/bin/env node
/**
 * Fills the demo account at Discogs (docs/19-DEMO-ACCOUNT.md).
 *
 * A second, otherwise empty Discogs account carries a collection anybody
 * may look at: sixty records across jazz, electronic and the rest, a
 * wantlist of fifteen, ratings on a third. The nightly smoke run syncs it
 * against the live app, testers get a shelf that is not their own, and the
 * screenshots in the docs come from here.
 *
 * Run by hand, with the token in the environment and never on the command
 * line or in a file:
 *
 *     DISCOGS_DEMO_TOKEN=… node scripts/demo/fill.mjs [--dry-run]
 *
 * Idempotent: what the account already holds is skipped. One request at a
 * time, 1 200 ms apart (CLAUDE.md rule 3); a 429 waits a minute and tries
 * once more. The token is never printed.
 */
import { setTimeout as sleep } from 'node:timers/promises'

const API = 'https://api.discogs.com'
const PACE_MS = 1_200
const TOKEN = process.env.DISCOGS_DEMO_TOKEN
const DRY = process.argv.includes('--dry-run')

if (!TOKEN) {
  console.error(
    'DISCOGS_DEMO_TOKEN is not set — the demo account’s token, from the environment.',
  )
  process.exit(2)
}

/** The shelf: artist, title, year, and a rating where somebody had an opinion. */
const COLLECTION = [
  ['Wayne Shorter', 'Speak No Evil', 1966, 5],
  ['Herbie Hancock', 'Maiden Voyage', 1965, 5],
  ['John Coltrane', 'A Love Supreme', 1965, 5],
  ['Miles Davis', 'Kind Of Blue', 1959, 5],
  ['Andrew Hill', 'Point Of Departure', 1965, 4],
  ['Larry Young', 'Unity', 1966, 4],
  ['Lee Morgan', 'The Sidewinder', 1964, 4],
  ['Eric Dolphy', 'Out To Lunch!', 1964, 5],
  ['Dexter Gordon', 'Go', 1962, 4],
  ['Horace Silver', 'Song For My Father', 1965, 4],
  ['Grant Green', 'Idle Moments', 1965, 4],
  ['Bobby Hutcherson', 'Dialogue', 1965, 0],
  ['Charles Mingus', 'Mingus Ah Um', 1959, 5],
  ['Thelonious Monk', 'Monk’s Dream', 1963, 4],
  ['Alice Coltrane', 'Journey In Satchidananda', 1971, 5],
  ['Pharoah Sanders', 'Karma', 1969, 4],
  ['Sun Ra', 'Space Is The Place', 1973, 0],
  ['Don Cherry', 'Brown Rice', 1975, 0],
  ['Bill Evans Trio', 'Sunday At The Village Vanguard', 1961, 5],
  ['Ahmad Jamal', 'The Awakening', 1970, 4],
  ['Stereolab', 'Sound-Dust', 2001, 4],
  ['Stereolab', 'Emperor Tomato Ketchup', 1996, 5],
  ['Broadcast', 'The Noise Made By People', 2000, 4],
  ['Boards Of Canada', 'Music Has The Right To Children', 1998, 5],
  ['Aphex Twin', 'Selected Ambient Works 85-92', 1992, 5],
  ['Autechre', 'Tri Repetae', 1995, 0],
  ['Burial', 'Untrue', 2007, 5],
  ['Four Tet', 'Rounds', 2003, 4],
  ['Caribou', 'Swim', 2010, 0],
  ['Floating Points', 'Crush', 2019, 4],
  ['Kraftwerk', 'Trans Europa Express', 1977, 5],
  ['Neu!', 'Neu!', 1972, 4],
  ['Can', 'Tago Mago', 1971, 5],
  ['Brian Eno', 'Ambient 1 (Music For Airports)', 1978, 4],
  ['Talking Heads', 'Remain In Light', 1980, 5],
  ['Joy Division', 'Unknown Pleasures', 1979, 5],
  ['The Cure', 'Disintegration', 1989, 4],
  ['Cocteau Twins', 'Heaven Or Las Vegas', 1990, 4],
  ['My Bloody Valentine', 'Loveless', 1991, 5],
  ['Slowdive', 'Souvlaki', 1993, 0],
  ['Portishead', 'Dummy', 1994, 5],
  ['Massive Attack', 'Mezzanine', 1998, 4],
  ['Björk', 'Homogenic', 1997, 4],
  ['Radiohead', 'Kid A', 2000, 5],
  ['A Tribe Called Quest', 'The Low End Theory', 1991, 5],
  ['Madvillain', 'Madvillainy', 2004, 5],
  ['J Dilla', 'Donuts', 2006, 4],
  ['Nas', 'Illmatic', 1994, 5],
  ['Fela Kuti', 'Zombie', 1976, 4],
  ['Mulatu Astatke', 'Mulatu Of Ethiopia', 1972, 0],
  ['Ebo Taylor', 'Life Stories', 2011, 0],
  ['Khruangbin', 'Con Todo El Mundo', 2018, 3],
  ['Nils Frahm', 'Spaces', 2013, 4],
  ['Jon Hopkins', 'Immunity', 2013, 4],
  ['Moderat', 'II', 2013, 3],
  ['Nicolas Jaar', 'Space Is Only Noise', 2011, 0],
  ['Bonobo', 'Black Sands', 2010, 3],
  ['Fatima Yamaha', 'What’s A Girl To Do', 2015, 0],
  ['Yussef Kamaal', 'Black Focus', 2016, 4],
  ['Kamasi Washington', 'The Epic', 2015, 0],
]

/** The wantlist: fifteen, a few with a note the sheet can show. */
const WANTS = [
  ['Hank Mobley', 'Soul Station', 1960, 'Only an original or a Music Matters press'],
  ['Joe Henderson', 'Page One', 1963, ''],
  ['Kenny Dorham', 'Una Mas', 1963, ''],
  ['Jackie McLean', 'Destination... Out!', 1964, ''],
  ['Sam Rivers', 'Fuchsia Swing Song', 1965, ''],
  ['Duke Pearson', 'The Right Touch', 1967, ''],
  ['Donald Byrd', 'A New Perspective', 1964, ''],
  ['Yusef Lateef', 'Eastern Sounds', 1961, ''],
  ['Tortoise', 'Millions Now Living Will Never Die', 1996, ''],
  ['Talk Talk', 'Spirit Of Eden', 1988, 'Not the 2012 repress — sounds thin'],
  ['Arthur Russell', 'World Of Echo', 1986, ''],
  ['Actress', 'R.I.P', 2012, ''],
  ['Ryuichi Sakamoto', 'async', 2017, ''],
  ['Alice Coltrane', 'Ptah, The El Daoud', 1970, 'Any clean copy'],
  ['Sault', 'Untitled (Black Is)', 2020, ''],
]

let lastAt = 0
async function discogs(path, { method = 'GET', body } = {}) {
  const wait = lastAt + PACE_MS - Date.now()
  if (wait > 0) await sleep(wait)
  for (let attempt = 0; attempt < 2; attempt += 1) {
    lastAt = Date.now()
    const response = await fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Discogs token=${TOKEN}`,
        'User-Agent': 'FidelityDemoFill/1.0 +https://github.com/misterhonk/fidelity',
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (response.status === 429 && attempt === 0) {
      console.log('  429 — waiting a minute')
      await sleep(60_000)
      continue
    }
    const text = await response.text()
    const json = text ? JSON.parse(text) : null
    if (!response.ok)
      throw new Error(`${method} ${path} → ${response.status} ${json?.message ?? ''}`)
    return json
  }
  throw new Error(`${method} ${path} → still 429`)
}

/** The first vinyl release the search returns for "artist title" — good enough for a demo shelf. */
async function resolve(artist, title, year) {
  const q = encodeURIComponent(`${artist} ${title}`)
  const found = await discogs(`/database/search?q=${q}&type=release&format=Vinyl&per_page=8`)
  const rows = found?.results ?? []
  const wanted = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  const fits = (row) =>
    (row.title ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .includes(wanted)
  const same = rows.filter(fits)
  const pick = same.find((row) => Number(row.year) === year) ?? same[0] ?? rows[0] ?? null
  return pick ? { id: pick.id, title: pick.title, year: pick.year } : null
}

async function everything(path, key) {
  const rows = []
  for (let page = 1; ; page += 1) {
    const answer = await discogs(
      `${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`,
    )
    rows.push(...(answer?.[key] ?? []))
    if (page >= (answer?.pagination?.pages ?? 1)) return rows
  }
}

const me = await discogs('/oauth/identity')
const user = me.username
console.log(`Demo account: ${user}${DRY ? ' (dry run)' : ''}`)

const owned = new Set(
  (await everything(`/users/${user}/collection/folders/0/releases`, 'releases')).map(
    (r) => r.id,
  ),
)
const wanted = new Set((await everything(`/users/${user}/wants`, 'wants')).map((w) => w.id))
console.log(`Holds ${owned.size} records and wants ${wanted.size}.`)

let added = 0
let rated = 0
for (const [artist, title, year, rating] of COLLECTION) {
  const release = await resolve(artist, title, year)
  if (!release) {
    console.log(`  ? not found: ${artist} – ${title}`)
    continue
  }
  if (owned.has(release.id)) continue
  console.log(`  + ${artist} – ${release.title} (${release.year ?? year}) #${release.id}`)
  if (DRY) continue
  const instance = await discogs(`/users/${user}/collection/folders/1/releases/${release.id}`, {
    method: 'POST',
  })
  added += 1
  owned.add(release.id)
  if (rating > 0 && instance?.instance_id) {
    await discogs(
      `/users/${user}/collection/folders/1/releases/${release.id}/instances/${instance.instance_id}`,
      { method: 'POST', body: { rating } },
    )
    rated += 1
  }
}

let wants = 0
for (const [artist, title, year, notes] of WANTS) {
  const release = await resolve(artist, title, year)
  if (!release) {
    console.log(`  ? not found: ${artist} – ${title}`)
    continue
  }
  if (wanted.has(release.id)) continue
  console.log(`  ★ ${artist} – ${release.title} (${release.year ?? year}) #${release.id}`)
  if (DRY) continue
  await discogs(`/users/${user}/wants/${release.id}`, {
    method: 'PUT',
    body: notes ? { notes } : {},
  })
  wants += 1
  wanted.add(release.id)
}

console.log(`Added ${added} records (${rated} rated) and ${wants} wants.`)
