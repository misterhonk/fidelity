import { createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { createGzip } from 'node:zlib'

import { children, entities, openDump, serialise, text, type XmlNode } from '../src/etl/xml.ts'

/**
 * Cutting the mini-dump (docs/16 §9, M21.2).
 *
 * The first N releases of a real monthly dump, then exactly the masters,
 * labels and artists they refer to, written back in the dump's own shape as
 * four small gzip files. Cut from the real thing rather than typed by hand,
 * so the parser and the shaping meet the dump's actual habits — a catno
 * written twice, a `<master_id>` with an attribute, `&#13;` in a profile —
 * and not our idea of them.
 *
 *   node scripts/cut-mini-dump.ts <dump dir> <out dir> [releases=400] [date=20260901]
 *
 * The dump dir holds the four files by their published names; the releases
 * file may be a plain, truncated `.xml` — nobody downloads 10 GB for this.
 */
const [dumpDir, outDir, countArg = '400', date = '20260901'] = process.argv.slice(2)
if (!dumpDir || !outDir) {
  console.error('usage: cut-mini-dump.ts <dump dir> <out dir> [releases] [date]')
  process.exit(2)
}
const limit = Number(countArg)

function source(entity: string): string {
  return join(dumpDir, `discogs_${date}_${entity}.xml`)
}

async function writeFile(entity: string, rows: XmlNode[]) {
  await mkdir(outDir, { recursive: true })
  const body = `<${entity}>\n${rows.map(serialise).join('\n')}\n</${entity}>\n`
  await pipeline(
    [body],
    createGzip({ level: 9 }),
    createWriteStream(join(outDir, `discogs_${date}_${entity}.xml.gz`)),
  )
  // A command-line tool talking to whoever ran it, not browser code.
  // eslint-disable-next-line no-console
  console.log(`${entity}: ${rows.length}`)
}

const ids = (node: XmlNode, list: string, item: string) =>
  children(node, list).flatMap((l) => children(l, item))

/* 1. The releases, and what they point at. */
const releases: XmlNode[] = []
const artistIds = new Set<number>()
const labelIds = new Set<number>()
const masterIds = new Set<number>()

for await (const release of entities(openDump(source('releases')), 'release')) {
  releases.push(release)
  for (const artist of [
    ...ids(release, 'artists', 'artist'),
    ...ids(release, 'extraartists', 'artist'),
  ])
    artistIds.add(Number(text(artist, 'id')))
  for (const label of ids(release, 'labels', 'label')) labelIds.add(Number(label.attrs.id))
  const master = text(release, 'master_id')
  if (master) masterIds.add(Number(master))
  if (releases.length >= limit) break
}
await writeFile('releases', releases)

/* 2. Their masters — whose artists join the set. */
const masters: XmlNode[] = []
for await (const master of entities(openDump(source('masters') + '.gz'), 'master')) {
  if (!masterIds.has(Number(master.attrs.id))) continue
  masters.push(master)
  for (const artist of ids(master, 'artists', 'artist'))
    artistIds.add(Number(text(artist, 'id')))
  if (masters.length === masterIds.size) break
}
await writeFile('masters', masters)

/* 3. The labels. */
const labels: XmlNode[] = []
for await (const label of entities(openDump(source('labels') + '.gz'), 'label')) {
  if (!labelIds.has(Number(text(label, 'id')))) continue
  labels.push(label)
  if (labels.length === labelIds.size) break
}
await writeFile('labels', labels)

/* 4. The artists — 9 million rows to stream for a few hundred. */
const artists: XmlNode[] = []
for await (const artist of entities(openDump(source('artists') + '.gz'), 'artist')) {
  if (!artistIds.has(Number(text(artist, 'id')))) continue
  artists.push(artist)
  if (artists.length === artistIds.size) break
}
await writeFile('artists', artists)
