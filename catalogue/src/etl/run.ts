import {
  mkdir,
  readdir,
  readFile,
  readlink,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { join } from 'node:path'

import { buildCatalogue } from './build.ts'
import { fetchDump, latestDumpDate } from './fetch.ts'

/**
 * The monthly job (docs/16 §4): one run makes one build, or says why not.
 *
 *   /data/2026-09-01.sqlite      a build, named after the dump it came from
 *   /data/current       →        the newest one that passed its checks
 *   /data/status.json            what the last run did, for a human and for §8
 *   /scratch/dump/<date>/        the four files while they are needed
 *
 * The swap is two generations and a symlink: the new file is built beside
 * the old one under a name nobody serves, checked against the old one's row
 * counts, and only then does `current` move — by renaming a fresh symlink
 * over it, which is atomic, so a reader opens the old file or the new one
 * and never half of either. The old build stays until the next one passes;
 * a build that fails its check leaves `current` untouched and the file
 * deleted.
 *
 * Disk is the tight resource on the home lab (50 GB free on 2026-09-12 for a
 * 12 GB download and a file that starts at 8 GB), so each dump file is
 * deleted the moment its rows are in, and only two builds are kept.
 *
 * A dump that has not appeared this month is the ordinary case for the
 * first days of a month, not an error: the run says "current is still
 * <date>" and the loop tries again tomorrow.
 */
export interface RunOptions {
  dataDir: string
  scratchDir: string
  /** Normally the listing decides; a test or an operator can pin a month. */
  date?: string
  /** The files are already in the scratch dir — build from them, fetch nothing. */
  offline?: boolean
  fetchImpl?: typeof fetch
  now?: () => Date
  log?: (line: string) => void
}

export interface RunStatus {
  outcome: 'built' | 'current' | 'no-dump' | 'refused' | 'failed'
  build: string | null
  current: string | null
  startedAt: string
  finishedAt: string
  seconds: number
  bytes?: number
  counts?: Record<string, number>
  error?: string
}

const asBuild = (date: string) => `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`

export async function currentBuild(dataDir: string): Promise<string | null> {
  return readlink(join(dataDir, 'current')).then(
    (target) => target.replace(/\.sqlite$/, ''),
    () => null,
  )
}

export async function runOnce(options: RunOptions): Promise<RunStatus> {
  const {
    dataDir,
    scratchDir,
    fetchImpl = fetch,
    now = () => new Date(),
    log = () => {},
  } = options
  const started = now()
  const finish = async (
    partial: Omit<RunStatus, 'startedAt' | 'finishedAt' | 'seconds' | 'current'>,
  ) => {
    const status: RunStatus = {
      ...partial,
      current: await currentBuild(dataDir),
      startedAt: started.toISOString(),
      finishedAt: now().toISOString(),
      seconds: Math.round((now().getTime() - started.getTime()) / 1000),
    }
    await mkdir(dataDir, { recursive: true })
    await writeFile(join(dataDir, 'status.json'), JSON.stringify(status, null, 2) + '\n')
    log(
      `run: ${status.outcome}${status.build ? ` ${status.build}` : ''} in ${status.seconds} s`,
    )
    return status
  }

  const date =
    options.date ?? (options.offline ? null : await latestDumpDate(fetchImpl, started))
  if (!date) return finish({ outcome: 'no-dump', build: null })
  const build = asBuild(date)
  const current = await currentBuild(dataDir)
  if (current === build) {
    log(`run: current is still ${build}`)
    return finish({ outcome: 'current', build })
  }

  const dumpDir = join(scratchDir, 'dump', date)
  const target = join(dataDir, `${build}.sqlite`)
  const building = `${target}.building`
  try {
    await mkdir(dataDir, { recursive: true })
    if (!options.offline) await fetchDump({ date, dir: dumpDir, fetchImpl, log })

    const result = await buildCatalogue({
      dumpDir,
      date,
      out: building,
      previous: current ? join(dataDir, `${current}.sqlite`) : undefined,
      log,
      afterFile: async (_entity, path) => {
        await rm(path, { force: true })
        log(`run: ${path.split('/').pop()} deleted, rows are in`)
      },
    })
    result.db.close()

    await rename(building, target)
    await swap(dataDir, `${build}.sqlite`)
    await tidy(dataDir, scratchDir, log)
    const { size } = await stat(target)
    return finish({ outcome: 'built', build, bytes: size, counts: result.counts })
  } catch (error) {
    await rm(building, { force: true })
    const message = error instanceof Error ? error.message : String(error)
    const refused = message.startsWith('check:')
    log(`run: ${refused ? 'refused' : 'failed'} — ${message}`)
    return finish({ outcome: refused ? 'refused' : 'failed', build, error: message })
  }
}

/** `current` → name, by renaming a fresh symlink over the old one. */
async function swap(dataDir: string, name: string): Promise<void> {
  const fresh = join(dataDir, 'current.next')
  await rm(fresh, { force: true })
  await symlink(name, fresh)
  await rename(fresh, join(dataDir, 'current'))
}

/** Two builds stay, the rest go; the scratch goes entirely. */
async function tidy(
  dataDir: string,
  scratchDir: string,
  log: (line: string) => void,
): Promise<void> {
  const builds = (await readdir(dataDir))
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.sqlite$/.test(f))
    .sort()
  for (const old of builds.slice(0, -2)) {
    await rm(join(dataDir, old), { force: true })
    log(`tidy: ${old} deleted`)
  }
  await rm(join(scratchDir, 'dump'), { recursive: true, force: true })
}

export async function lastStatus(dataDir: string): Promise<RunStatus | null> {
  return readFile(join(dataDir, 'status.json'), 'utf8').then(
    (text) => JSON.parse(text) as RunStatus,
    () => null,
  )
}

/*
 * The container: run, then look again tomorrow. `CATALOGUE_ONCE=1` runs once
 * and exits, for `docker compose run` and for a first build by hand.
 */
if (process.argv[1]?.endsWith('run.ts')) {
  const dataDir = process.env.CATALOGUE_DATA ?? '/data'
  const scratchDir = process.env.CATALOGUE_SCRATCH ?? '/scratch'
  const once = process.env.CATALOGUE_ONCE === '1'
  const date = process.env.CATALOGUE_DATE || undefined
  // `CATALOGUE_OFFLINE=1` with a pinned date: the files are already there.
  const offline = process.env.CATALOGUE_OFFLINE === '1'
  // A job talking to its log, not browser code.
  // eslint-disable-next-line no-console
  const log = (line: string) => console.log(`${new Date().toISOString()} ${line}`)

  const DAY = 24 * 60 * 60 * 1000
  for (;;) {
    const status = await runOnce({ dataDir, scratchDir, date, offline, log })
    if (once) process.exit(status.outcome === 'failed' ? 1 : 0)
    await new Promise((resolve) => setTimeout(resolve, DAY))
  }
}
