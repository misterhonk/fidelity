import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, readFile, rename, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

/**
 * Getting the dump (docs/16 §3, §4 step 1).
 *
 * `data.discogs.com` lists a year as an HTML page and hands out a file through
 * `?download=`; the S3 bucket behind it refuses to be listed or read directly,
 * and range requests come back as a fresh 200 — measured on 2026-09-12 — so a
 * download is whole or it is not, and "resumable" means "a finished file is
 * not fetched twice". Every file is hashed on the way down and held against
 * the month's CHECKSUM.txt, because a truncated gzip parses fine up to the
 * point where it is missing.
 */
export const ENTITIES = ['artists', 'labels', 'masters', 'releases'] as const
export type Entity = (typeof ENTITIES)[number]

export const DUMP_HOST = 'https://data.discogs.com'

export function fileName(date: string, entity: Entity | 'CHECKSUM', gz = true): string {
  return entity === 'CHECKSUM'
    ? `discogs_${date}_CHECKSUM.txt`
    : `discogs_${date}_${entity}.xml${gz ? '.gz' : ''}`
}

export function downloadUrl(date: string, name: string): string {
  return `${DUMP_HOST}/?download=${encodeURIComponent(`data/${date.slice(0, 4)}/${name}`)}`
}

/** The newest month with a checksum file in the listing — the sign a month is complete. */
export function datesInListing(html: string): string[] {
  return [
    ...new Set([...html.matchAll(/discogs_(\d{8})_CHECKSUM\.txt/g)].map((m) => m[1]!)),
  ].sort()
}

export async function latestDumpDate(
  fetchImpl: typeof fetch = fetch,
  now = new Date(),
): Promise<string | null> {
  const year = now.getUTCFullYear()
  for (const y of [year, year - 1]) {
    const response = await fetchImpl(`${DUMP_HOST}/?prefix=${encodeURIComponent(`data/${y}/`)}`)
    if (!response.ok) continue
    const dates = datesInListing(await response.text())
    if (dates.length > 0) return dates[dates.length - 1]!
  }
  return null
}

/** "sha256  name" per line, the way the checksum file is written. */
export function parseChecksums(text: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const line of text.split('\n')) {
    const match = /^([0-9a-f]{64})\s+(\S+)/.exec(line.trim())
    if (match) out.set(match[2]!, match[1]!)
  }
  return out
}

export async function sha256(path: string): Promise<string> {
  const hash = createHash('sha256')
  const { createReadStream } = await import('node:fs')
  await pipeline(createReadStream(path), hash)
  return hash.digest('hex')
}

export interface FetchOptions {
  date: string
  dir: string
  fetchImpl?: typeof fetch
  log?: (line: string) => void
}

/**
 * The four files and the checksum file into `dir`, each skipped when it is
 * already there and whole. Returns the paths by entity.
 */
export async function fetchDump({
  date,
  dir,
  fetchImpl = fetch,
  log = () => {},
}: FetchOptions): Promise<Record<Entity, string>> {
  await mkdir(dir, { recursive: true })

  const checksumPath = join(dir, fileName(date, 'CHECKSUM'))
  await download(downloadUrl(date, fileName(date, 'CHECKSUM')), checksumPath, fetchImpl, log)
  const sums = parseChecksums(await readFile(checksumPath, 'utf8'))

  const paths = {} as Record<Entity, string>
  for (const entity of ENTITIES) {
    const name = fileName(date, entity)
    const path = join(dir, name)
    const expected = sums.get(name)
    if (!expected) throw new Error(`fetch: ${name} is not in the checksum file`)
    paths[entity] = path

    if (await exists(path)) {
      const have = await sha256(path)
      if (have === expected) {
        log(`fetch: ${name} already here and whole`)
        continue
      }
      log(`fetch: ${name} here but wrong (${have.slice(0, 8)}…), fetching again`)
    }
    const got = await download(downloadUrl(date, name), path, fetchImpl, log)
    if (got !== expected) {
      throw new Error(
        `fetch: ${name} arrived as ${got.slice(0, 8)}…, expected ${expected.slice(0, 8)}…`,
      )
    }
    log(`fetch: ${name} whole`)
  }
  return paths
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false,
  )
}

/** To `path` via `path.part`, hashed on the way; the hash comes back. */
async function download(
  url: string,
  path: string,
  fetchImpl: typeof fetch,
  log: (line: string) => void,
): Promise<string> {
  const response = await fetchImpl(url)
  if (!response.ok || !response.body)
    throw new Error(`fetch: ${url} answered ${response.status}`)
  const hash = createHash('sha256')
  let bytes = 0
  let reported = 0
  const counting = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      hash.update(chunk)
      bytes += chunk.byteLength
      if (bytes - reported >= 500 * 1024 * 1024) {
        reported = bytes
        log(`fetch: ${path.split('/').pop()} ${Math.round(bytes / 1024 / 1024)} MB`)
      }
      controller.enqueue(chunk)
    },
  })
  const part = `${path}.part`
  await pipeline(
    Readable.fromWeb(response.body.pipeThrough(counting) as never),
    createWriteStream(part),
  )
  await rename(part, path)
  return hash.digest('hex')
}
