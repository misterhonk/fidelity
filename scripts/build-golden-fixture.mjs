/**
 * Generates the golden fixture: a miniature universe with a known answer.
 *
 * Synthetic on purpose. A frozen real inventory would be marketplace data and
 * must not sit in a repository past six hours (docs/09-LEGAL.md). The shapes
 * are real — field names, format spellings, multi-label records, the messy
 * catalogue numbers — only the contents are invented.
 *
 * Run with: node scripts/build-golden-fixture.mjs
 */
import { writeFileSync } from 'node:fs'

const norm = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

let nextId = 1
function item(over) {
  return {
    releaseId: nextId++,
    masterId: 0,
    title: 'Titel',
    artistIds: [],
    artistNorms: [],
    artistNames: [],
    labelIds: [],
    labelNorms: [],
    labelNames: [],
    catnos: [],
    genres: ['Electronic'],
    styles: ['Techno'],
    formats: ['Vinyl', '12"'],
    year: 2004,
    rating: 0,
    addedAt: '2024-01-01T00:00:00-08:00',
    ...over,
  }
}
const by = (name, id) => ({ artistIds: [id], artistNorms: [norm(name)], artistNames: [name] })
const on = (name, id, catno) => ({
  labelIds: [id],
  labelNorms: [norm(name)],
  labelNames: [name],
  catnos: catno ? [catno] : [],
})

// --- The shelf -------------------------------------------------------------
const collection = []

// Six Robag Wruhme records, 2002–2007.
for (let i = 0; i < 6; i++)
  collection.push(
    item({
      ...by('Robag Wruhme', 40135),
      ...on('Musik Krause', 900),
      title: `Krause ${i}`,
      year: 2002 + i,
    }),
  )

// Five on Kompakt — a label this shelf plainly buys from.
for (let i = 0; i < 5; i++)
  collection.push(
    item({
      ...by(`Kompakt Act ${i}`, 200 + i),
      ...on('Kompakt', 1),
      title: `Total ${i}`,
      year: 2003 + i,
    }),
  )

// Four of Brain's 1000s, leaving 1003 open.
for (const [i, num] of [1001, 1002, 1004, 1005].entries())
  collection.push(
    item({
      ...by(`Krautrock Band ${i}`, 300 + i),
      ...on('Brain', 5, `BRAIN ${num}`),
      title: `Brain ${num}`,
      year: 1972,
      styles: ['Krautrock'],
    }),
  )

// Three records Conny Plank produced — the credit graph's basis.
for (let i = 0; i < 3; i++)
  collection.push(
    item({
      ...by(`Plank Act ${i}`, 400 + i),
      ...on('Sky', 6),
      title: `Sky ${i}`,
      year: 1975,
      styles: ['Krautrock'],
    }),
  )

// One lone Warner record. The trap: a huge catalogue seen once is not a taste.
collection.push(
  item({
    ...by('Pop Star', 500),
    ...on('Warner Bros. Records', 2),
    title: 'Ein Hit',
    year: 1985,
    genres: ['Rock'],
    styles: ['Pop Rock'],
  }),
)

// Homework on CD, so the vinyl is an upgrade rather than a second copy.
collection.push(
  item({
    ...by('Daft Punk', 600),
    ...on('Virgin', 7),
    title: 'Homework',
    year: 1997,
    formats: ['CD', 'Album'],
    masterId: 88,
  }),
)

// Four odds and ends, so the shelf is not suspiciously tidy.
for (let i = 0; i < 4; i++)
  collection.push(
    item({
      ...by(`Einzelstück ${i}`, 700 + i),
      ...on(`Kleinlabel ${i}`, 800 + i),
      title: `Sonstiges ${i}`,
      year: 1990 + i,
    }),
  )

// --- The wantlist ----------------------------------------------------------
const wantlist = [
  item({
    releaseId: 9001,
    masterId: 77,
    ...by('Portishead', 610),
    title: 'Dummy',
    year: 1994,
    styles: ['Trip Hop'],
  }),
  item({
    releaseId: 9002,
    masterId: 78,
    ...by('Aphex Twin', 620),
    title: 'Selected Ambient Works 85-92',
    year: 1992,
    styles: ['Ambient'],
  }),
].map((entry) => {
  // WantlistItem is CollectionItem without the rating.
  const copy = { ...entry }
  delete copy.rating
  return copy
})

// --- The dealer's stock ----------------------------------------------------
let listingId = 100_000
function listing(over) {
  return {
    listingId: listingId++,
    releaseId: 0,
    title: 'Titel',
    artist: 'Wer',
    label: null,
    catno: null,
    format: '12"',
    year: 2004,
    condition: 'Near Mint (NM or M-)',
    sleeve: 'Very Good Plus (VG+)',
    price: 12,
    currency: 'EUR',
    shipsFrom: 'Germany',
    comments: null,
    thumbUrl: null,
    ...over,
  }
}

/** Records with one of the eight documented relations to the shelf. */
const wanted = [
  listing({
    releaseId: 9001,
    artist: 'Portishead',
    title: 'Dummy',
    label: 'Go! Beat',
    year: 1994,
    price: 34,
  }),
  listing({
    releaseId: 9101,
    artist: 'Portishead',
    title: 'Dummy',
    label: 'Go! Beat',
    year: 2014,
    price: 28,
  }),
  listing({
    releaseId: 9002,
    artist: 'Aphex Twin',
    title: 'Selected Ambient Works 85-92',
    label: 'Apollo',
    year: 1992,
    price: 45,
  }),
  listing({
    releaseId: 9201,
    artist: 'Robag Wruhme',
    title: 'Wuppdeck',
    label: 'Musik Krause',
    year: 2005,
    price: 14,
  }),
  listing({
    releaseId: 9202,
    artist: 'Robag Wruhme',
    title: 'Bumsty',
    label: 'Pampa',
    year: 2006,
    price: 16,
  }),
  listing({
    releaseId: 9301,
    artist: 'Krautrock Band 4',
    title: 'Brain 1003',
    label: 'Brain',
    catno: 'BRAIN 1003',
    year: 1972,
    price: 55,
  }),
  listing({
    releaseId: 9401,
    artist: 'Anderer Act',
    title: 'Von Plank produziert',
    label: 'Sky',
    year: 1976,
    price: 22,
  }),
  listing({
    releaseId: 9501,
    artist: 'Daft Punk',
    title: 'Homework',
    label: 'Virgin',
    format: '2xLP, Album',
    year: 1997,
    price: 38,
  }),
  listing({
    releaseId: 9601,
    artist: 'Kompakt Act 9',
    title: 'Total 9',
    label: 'Kompakt',
    year: 2008,
    price: 11,
  }),
  listing({
    releaseId: 9602,
    artist: 'Neuer Act',
    title: 'Kompakt Sache',
    label: 'Kompakt',
    year: 2009,
    price: 9,
  }),
]

/** The distractors. The first five are the ones that can actually fool it. */
const noise = [
  // Trigram-close to a name on the shelf, but a different act.
  listing({
    releaseId: 9701,
    artist: 'Pop Stars',
    title: 'Nicht derselbe',
    label: 'Indie',
    year: 1986,
  }),
  // A huge catalogue the shelf has been near exactly once.
  listing({
    releaseId: 9702,
    artist: 'Irgendwer',
    title: 'Major-Release',
    label: 'Warner Bros. Records',
    year: 1988,
  }),
  // Same series, two hundred numbers away — not a run.
  listing({
    releaseId: 9703,
    artist: 'Krautrock Band 9',
    title: 'Brain 1205',
    label: 'Brain',
    catno: 'BRAIN 1205',
    year: 1978,
  }),
  // The CD of a record already owned on CD. Not an upgrade.
  listing({
    releaseId: 9704,
    artist: 'Daft Punk',
    title: 'Homework',
    label: 'Virgin',
    format: 'CD, Album',
    year: 1997,
  }),
  // Same label name, different label entirely.
  listing({
    releaseId: 9705,
    artist: 'Fremd',
    title: 'Kompaktkassette',
    label: 'Kompakt Distribution',
    year: 2011,
  }),
]
for (let i = 0; i < 45; i++) {
  noise.push(
    listing({
      releaseId: 9800 + i,
      artist: `Unbekannt ${i}`,
      title: `Platte ${i}`,
      label: `Fremdlabel ${i % 9}`,
      catno: `FL-${100 + i}`,
      year: 1970 + ((i * 3) % 50),
      price: 5 + (i % 30),
    }),
  )
}

const inventory = [...wanted, ...noise]

// --- The horizon -----------------------------------------------------------
// TypedArrays do not survive JSON, so they are written as plain arrays and
// rebuilt in the test. Same data, one conversion.
const horizon = [
  {
    key: 'master:77',
    kind: 'master',
    entityId: 77,
    name: 'Dummy',
    complete: true,
    requests: 1,
    fetchedAt: 1,
    releaseIds: [9001, 9101],
    roles: [0, 0],
    years: [1994, 2014],
  },
  {
    key: 'master:88',
    kind: 'master',
    entityId: 88,
    name: 'Homework',
    complete: true,
    requests: 1,
    fetchedAt: 1,
    releaseIds: [9501, 9704],
    roles: [0, 0],
    years: [1997, 1997],
  },
  {
    key: 'artist:40135',
    kind: 'artist',
    entityId: 40135,
    name: 'Robag Wruhme',
    complete: true,
    requests: 1,
    fetchedAt: 1,
    releaseIds: [1, 2, 3, 4, 5, 6, 9201, 9202],
    roles: [0, 0, 0, 0, 0, 0, 0, 0],
    years: [2002, 2003, 2004, 2005, 2006, 2007, 2005, 2006],
  },
  {
    key: 'artist:55',
    kind: 'artist',
    entityId: 55,
    name: 'Conny Plank',
    complete: true,
    requests: 1,
    fetchedAt: 1,
    releaseIds: [18, 19, 20, 9401],
    roles: [0, 0, 0, 1],
    years: [1975, 1975, 1975, 1976],
  },
  {
    key: 'label:5',
    kind: 'label',
    entityId: 5,
    name: 'Brain',
    complete: true,
    requests: 1,
    fetchedAt: 1,
    catalogueSize: 300,
    catnoPrefix: 'BRAIN',
    releaseIds: [12, 13, 14, 15, 9301, 9703],
    roles: [0, 0, 0, 0, 0, 0],
    years: [1972, 1972, 1972, 1972, 1972, 1978],
    catnoNums: [1001, 1002, 1004, 1005, 1003, 1205],
  },
  {
    key: 'label:1',
    kind: 'label',
    entityId: 1,
    name: 'Kompakt',
    complete: true,
    requests: 1,
    fetchedAt: 1,
    catalogueSize: 1200,
    releaseIds: [7, 8, 9, 10, 11, 9601, 9602],
    roles: [0, 0, 0, 0, 0, 0, 0],
    years: [2003, 2004, 2005, 2006, 2007, 2008, 2009],
  },
  {
    key: 'label:2',
    kind: 'label',
    entityId: 2,
    name: 'Warner Bros. Records',
    complete: true,
    requests: 1,
    fetchedAt: 1,
    catalogueSize: 90_000,
    releaseIds: [21, 9702],
    roles: [0, 0],
    years: [1985, 1988],
  },
]

const relevant = wanted.map((l) => l.releaseId)

writeFileSync('tests/fixtures/golden/collection.json', JSON.stringify(collection, null, 1))
writeFileSync('tests/fixtures/golden/wantlist.json', JSON.stringify(wantlist, null, 1))
writeFileSync('tests/fixtures/golden/inventory.json', JSON.stringify(inventory, null, 1))
writeFileSync('tests/fixtures/golden/horizon.json', JSON.stringify(horizon, null, 1))
writeFileSync('tests/fixtures/golden/relevant.json', JSON.stringify(relevant, null, 1))

console.log(
  `collection ${collection.length} · wantlist ${wantlist.length} · inventory ${inventory.length} · relevant ${relevant.length}`,
)
