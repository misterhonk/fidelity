import { parseCatno } from './catno.ts'
import { identifierKind, normaliseIdentifier } from './identifiers.ts'
import { norm } from './names.ts'
import { roleIndex } from './roles.ts'
import { child, children, text, type XmlNode } from './xml.ts'

/**
 * From one dump entity to the rows of docs/16 §4. Pure: a tree in, rows out,
 * so the golden tests can look at exactly what a release becomes without a
 * database in the way.
 *
 * Only CC0 fields, and fewer than the dump carries: no notes, no tracklist,
 * no videos, no profile text, no urls. The catalogue answers the questions in
 * docs/16 §2 and stores nothing it does not need to answer them — an 8 GB
 * file is easier to keep honest than a 40 GB one.
 */

export interface ReleaseRow {
  id: number
  master_id: number | null
  title: string
  year: number | null
  country: string
  data_quality: string
}
export interface ReleaseArtistRow {
  release_id: number
  artist_id: number
  /** ROLE_TABLE index; 0 = main; -1 = a credit the table has no name for. */
  role: number
  role_name: string
  position: number
}
export interface ReleaseLabelRow {
  release_id: number
  label_id: number
  catno: string
  catno_prefix: string | null
  catno_num: number | null
}
export interface ReleaseFormatRow {
  release_id: number
  name: string
  qty: number
  text: string
  descriptions: string
}
export interface ReleaseStyleRow {
  release_id: number
  kind: 'genre' | 'style'
  name: string
}
export interface IdentifierRow {
  release_id: number
  type: 'barcode' | 'matrix' | 'other'
  value_norm: string
  value: string
}
export interface ShapedRelease {
  release: ReleaseRow
  artists: ReleaseArtistRow[]
  labels: ReleaseLabelRow[]
  formats: ReleaseFormatRow[]
  styles: ReleaseStyleRow[]
  identifiers: IdentifierRow[]
}

/** "1999-03-00" → 1999; "0", "" and nonsense → null. */
export function yearOf(released: string): number | null {
  const match = /^(\d{4})/.exec(released.trim())
  if (!match) return null
  const year = Number(match[1])
  return year >= 1900 && year <= 2100 ? year : null
}

export function shapeRelease(node: XmlNode): ShapedRelease {
  const id = Number(node.attrs.id)
  const master = text(node, 'master_id')

  const artists: ReleaseArtistRow[] = []
  let position = 0
  for (const artist of children(child(node, 'artists') ?? empty, 'artist')) {
    artists.push({
      release_id: id,
      artist_id: Number(text(artist, 'id')),
      role: 0,
      role_name: '',
      position: position++,
    })
  }
  for (const artist of children(child(node, 'extraartists') ?? empty, 'artist')) {
    const roleName = text(artist, 'role')
    artists.push({
      release_id: id,
      artist_id: Number(text(artist, 'id')),
      role: roleIndex(roleName),
      role_name: roleName,
      position: position++,
    })
  }

  const labels: ReleaseLabelRow[] = []
  const seenLabels = new Set<string>()
  for (const label of children(child(node, 'labels') ?? empty, 'label')) {
    const catno = (label.attrs.catno ?? '').trim()
    // The dump writes a catno twice when the sleeve and the label disagree on
    // a space ("RI 026" and "RI026"); parsed, they are one run entry.
    const parsed = parseCatno(catno)
    const key = `${label.attrs.id}:${parsed ? `${parsed.prefix}:${parsed.num}` : catno}`
    if (seenLabels.has(key)) continue
    seenLabels.add(key)
    labels.push({
      release_id: id,
      label_id: Number(label.attrs.id),
      catno,
      catno_prefix: parsed?.prefix ?? null,
      catno_num: parsed?.num ?? null,
    })
  }

  const formats: ReleaseFormatRow[] = children(child(node, 'formats') ?? empty, 'format').map(
    (format) => ({
      release_id: id,
      name: format.attrs.name ?? '',
      qty: Number(format.attrs.qty ?? '1') || 1,
      text: format.attrs.text ?? '',
      descriptions: JSON.stringify(
        children(child(format, 'descriptions') ?? empty, 'description').map((d) => d.text),
      ),
    }),
  )

  const styles: ReleaseStyleRow[] = [
    ...children(child(node, 'genres') ?? empty, 'genre').map((g) => ({
      release_id: id,
      kind: 'genre' as const,
      name: g.text,
    })),
    ...children(child(node, 'styles') ?? empty, 'style').map((s) => ({
      release_id: id,
      kind: 'style' as const,
      name: s.text,
    })),
  ]

  const identifiers: IdentifierRow[] = []
  const seenIds = new Set<string>()
  for (const identifier of children(child(node, 'identifiers') ?? empty, 'identifier')) {
    const value = (identifier.attrs.value ?? '').trim()
    if (!value) continue
    const type = identifierKind(identifier.attrs.type ?? '')
    const value_norm = normaliseIdentifier(value)
    const key = `${type}:${value_norm}`
    if (seenIds.has(key)) continue
    seenIds.add(key)
    identifiers.push({ release_id: id, type, value_norm, value })
  }

  return {
    release: {
      id,
      // The dump writes `<master_id>0</master_id>` for "none" on some rows and
      // leaves the element out on others; both are no master.
      master_id: master && Number(master) > 0 ? Number(master) : null,
      title: text(node, 'title'),
      year: yearOf(text(node, 'released')),
      country: text(node, 'country'),
      data_quality: text(node, 'data_quality'),
    },
    artists,
    labels,
    formats,
    styles,
    identifiers,
  }
}

export interface MasterRow {
  id: number
  main_release: number | null
  year: number | null
  title: string
}

export function shapeMaster(node: XmlNode): MasterRow {
  const main = text(node, 'main_release')
  const year = Number(text(node, 'year'))
  return {
    id: Number(node.attrs.id),
    main_release: main ? Number(main) : null,
    year: year >= 1900 && year <= 2100 ? year : null,
    title: text(node, 'title'),
  }
}

export interface ArtistRow {
  id: number
  name: string
  real_name: string
}
export interface ArtistNameRow {
  artist_id: number
  name_norm: string
  name: string
  relation: 'self' | 'alias' | 'variation' | 'member' | 'group'
  /** The other artist's id for alias/member/group; null for a variation. */
  other_id: number | null
}

export function shapeArtist(node: XmlNode): { artist: ArtistRow; names: ArtistNameRow[] } {
  const id = Number(text(node, 'id'))
  const name = text(node, 'name')
  const names: ArtistNameRow[] = [
    { artist_id: id, name_norm: norm(name), name, relation: 'self', other_id: null },
  ]
  const seen = new Set<string>([`self:${norm(name)}`])
  const add = (list: string, relation: ArtistNameRow['relation']) => {
    for (const entry of children(child(node, list) ?? empty, 'name')) {
      const other = entry.attrs.id ? Number(entry.attrs.id) : null
      const name_norm = norm(entry.text)
      const key = `${relation}:${other ?? name_norm}`
      if (!name_norm || seen.has(key)) continue
      seen.add(key)
      names.push({ artist_id: id, name_norm, name: entry.text, relation, other_id: other })
    }
  }
  add('namevariations', 'variation')
  add('aliases', 'alias')
  add('members', 'member')
  add('groups', 'group')
  return { artist: { id, name, real_name: text(node, 'realname') }, names }
}

export interface LabelRow {
  id: number
  name: string
  parent_id: number | null
}

export function shapeLabel(node: XmlNode): LabelRow {
  const parent = child(node, 'parentLabel')
  return {
    id: Number(text(node, 'id')),
    name: text(node, 'name'),
    parent_id: parent?.attrs.id ? Number(parent.attrs.id) : null,
  }
}

const empty: XmlNode = { name: '', attrs: {}, text: '', children: [] }
