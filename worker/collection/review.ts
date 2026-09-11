import { openFidelityDb } from '~~/db/open'
import { distinctReleases } from '~~/db/collection'
import {
  ROLE_TABLE,
  type CollectionItem,
  type Dig,
  type Feedback,
  type ReviewRecord,
  type TasteFacet,
  type YearReview,
} from '#shared/types'
import { mediumOf } from '#shared/format'

import { buildLookup, hitsFor, type HorizonLookup } from '../horizon/lookup'
import { computeTasteProfile, topFacets } from '../match/taste'

/**
 * A year on the shelf (docs/06 M19 #8).
 *
 * Letterboxd and StoryGraph sell this as the subscription: what arrived,
 * where it came from, who made it. Everything here was on the device
 * already — the shelf carries `addedAt` and the CC0 fields, the digs and
 * the verdicts are Fidelity's own, the horizon knows who shaped what. No
 * request, and nothing from the marketplace: a year is read off, not
 * fetched.
 *
 * Copies, not releases: a second copy of a record you already had is
 * something that arrived that year. The taste facets below use the same
 * profile the map uses, over this year's additions instead of the whole shelf.
 */

/** How many of anything a review names. Past this it is a list, not a story. */
export const TOP = 8

export interface ReviewInput {
  /** Every copy on the shelf, with its `addedAt`. */
  copies: CollectionItem[]
  digs: Dig[]
  feedback: Feedback[]
  /** Null before the horizon exists — then nobody shaped anything, honestly. */
  lookup: HorizonLookup | null
}

/** The year an ISO date names, read off the string so no time zone moves it. */
export function yearOf(iso: string): number {
  return Number.parseInt(iso.slice(0, 4), 10) || 0
}

function monthOf(iso: string): number {
  const month = Number.parseInt(iso.slice(5, 7), 10)
  return month >= 1 && month <= 12 ? month - 1 : 0
}

function record(item: CollectionItem): ReviewRecord {
  return {
    releaseId: item.releaseId,
    title: item.title,
    artist: item.artistNames.join(', '),
    year: item.year,
  }
}

/** Facets in the shape the map's bars take: name, count, share. */
function facets(counts: Map<string, number>, total: number): TasteFacet[] {
  return [...counts.entries()]
    .map(([name, n]) => ({ name, n, weight: total > 0 ? n / total : 0, lift: null }))
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
}

export function reviewYear(input: ReviewInput, wanted: number | null): YearReview | null {
  const years = [
    ...new Set(input.copies.map((copy) => yearOf(copy.addedAt)).filter(Boolean)),
  ].sort((a, b) => b - a)
  if (years.length === 0) return null

  const year = wanted !== null && years.includes(wanted) ? wanted : years[0]!
  const added = input.copies.filter((copy) => yearOf(copy.addedAt) === year)
  const before = input.copies.filter((copy) => yearOf(copy.addedAt) === year - 1).length

  const byMonth = Array.from({ length: 12 }, () => 0)
  for (const copy of added) byMonth[monthOf(copy.addedAt)]! += 1

  // New to the shelf: an artist whose earliest copy arrived this year.
  const firstSeen = new Map<number, number>()
  for (const copy of input.copies) {
    const y = yearOf(copy.addedAt)
    if (!y) continue
    for (const id of copy.artistIds) {
      const seen = firstSeen.get(id)
      if (seen === undefined || y < seen) firstSeen.set(id, y)
    }
  }
  const newNames = new Map<number, string>()
  for (const copy of added) {
    copy.artistIds.forEach((id, index) => {
      if (firstSeen.get(id) === year && !newNames.has(id)) {
        newNames.set(id, copy.artistNames[index] ?? String(id))
      }
    })
  }

  const profile = computeTasteProfile(added, 0)

  const media = new Map<string, number>()
  for (const copy of added) {
    const medium = mediumOf(copy.formats.join(', '))
    if (medium) media.set(medium, (media.get(medium) ?? 0) + 1)
  }

  const dated = added.filter((copy) => copy.year > 1880).sort((a, b) => a.year - b.year)

  const runs = input.digs.filter((dig) => new Date(dig.startedAt).getFullYear() === year)
  const bought = input.feedback.filter(
    (row) =>
      row.verdict === 'bought' &&
      new Date(row.updatedAt ?? row.createdAt).getFullYear() === year,
  ).length

  // Who shaped them: credits the horizon has for these records. Role 0 is a
  // main credit — that is the artist, already in the bars above.
  const people = new Map<number, { name: string; n: number; roles: Map<number, number> }>()
  if (input.lookup) {
    for (const copy of added) {
      for (const hit of hitsFor(input.lookup, copy.releaseId)) {
        if (hit.kind !== 'artist' || hit.role === 0) continue
        const person = people.get(hit.entityId) ?? { name: hit.name, n: 0, roles: new Map() }
        person.n += 1
        person.roles.set(hit.role, (person.roles.get(hit.role) ?? 0) + 1)
        people.set(hit.entityId, person)
      }
    }
  }

  return {
    year,
    years,
    added: added.length,
    addedBefore: before,
    byMonth,
    newArtists: newNames.size,
    newArtistNames: [...newNames.values()].sort((a, b) => a.localeCompare(b)).slice(0, TOP * 2),
    artists: topFacets(profile.artists, TOP),
    labels: topFacets(profile.labels, TOP),
    styles: topFacets(profile.styles, TOP),
    decades: Object.entries(profile.decades)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([, facet]) => facet),
    media: facets(media, added.length),
    oldest: dated[0] ? record(dated[0]) : null,
    newest: dated.length > 1 ? record(dated[dated.length - 1]!) : null,
    loved: added.filter((copy) => copy.rating >= 4).length,
    rated: added.filter((copy) => copy.rating > 0).length,
    digs: {
      runs: runs.length,
      shops: new Set(runs.map((dig) => dig.dealer)).size,
      finds: runs.reduce((sum, dig) => sum + dig.matchCount, 0),
      bought,
    },
    people: [...people.values()]
      .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
      .slice(0, TOP)
      .map((person) => ({
        name: person.name,
        n: person.n,
        role:
          ROLE_TABLE[[...person.roles.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0] ??
          '',
      })),
  }
}

export async function collectionReview(year: number | null): Promise<YearReview | null> {
  const db = await openFidelityDb()
  const [copies, digs, feedback, chunks, releases, wantlist] = await Promise.all([
    db.getAll('collection'),
    db.getAll('digs'),
    db.getAll('feedback'),
    db.getAll('horizon'),
    distinctReleases(),
    db.getAll('wantlist'),
  ])

  return reviewYear(
    {
      copies,
      digs,
      feedback,
      lookup: chunks.length > 0 ? buildLookup(chunks, releases, wantlist) : null,
    },
    year,
  )
}
