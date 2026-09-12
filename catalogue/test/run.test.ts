import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, readlinkSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, test } from 'node:test'

import { datesInListing, downloadUrl, fileName, parseChecksums } from '../src/etl/fetch.ts'
import { currentBuild, lastStatus, runOnce } from '../src/etl/run.ts'

/**
 * The job, end to end, against a Discogs that lives in this file: a listing
 * with two months in it, a checksum file, and the mini-dump's four files
 * served by name. Nothing here touches the network.
 */
const FIXTURE = new URL('../fixtures/mini-dump/', import.meta.url).pathname
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')

/** Serves `dates` as the months that exist, every one of them from the same fixture. */
function discogs(dates: string[], { corrupt = false } = {}) {
  const calls: string[] = []
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = String(input)
    calls.push(url)
    const listed = /prefix=data%2F(\d{4})%2F/.exec(url)
    if (listed) {
      const html = dates
        .filter((d) => d.startsWith(listed[1]!))
        .map(
          (d) =>
            `<a href="?download=data%2F${d.slice(0, 4)}%2Fdiscogs_${d}_CHECKSUM.txt">x</a>`,
        )
        .join('\n')
      return new Response(html, { status: 200 })
    }
    const wanted = /download=data%2F\d{4}%2Fdiscogs_(\d{8})_(\w+)\.(txt|xml\.gz)/.exec(url)
    if (!wanted || !dates.includes(wanted[1]!)) return new Response('no', { status: 404 })
    const [, date, entity] = wanted
    if (entity === 'CHECKSUM') {
      const lines = ['artists', 'labels', 'masters', 'releases'].map((e) => {
        const bytes = readFileSync(join(FIXTURE, fileName('20260901', e as never)))
        return `${sha(bytes)} ${fileName(date!, e as never)}`
      })
      return new Response(lines.join('\n') + '\n', { status: 200 })
    }
    const bytes = readFileSync(join(FIXTURE, fileName('20260901', entity as never)))
    return new Response(corrupt ? bytes.subarray(0, bytes.length - 100) : bytes, {
      status: 200,
    })
  }) as typeof fetch
  return { fetchImpl, calls }
}

function dirs() {
  const root = mkdtempSync(join(tmpdir(), 'fidelity-catalogue-'))
  return { root, dataDir: join(root, 'data'), scratchDir: join(root, 'scratch') }
}

describe('the listing and the checksum file', () => {
  test('the newest month is the last checksum file', () => {
    const html = `
      <a href="?download=data%2F2026%2Fdiscogs_20260801_releases.xml.gz">r</a>
      <a href="?download=data%2F2026%2Fdiscogs_20260801_CHECKSUM.txt">c</a>
      <a href="?download=data%2F2026%2Fdiscogs_20260901_CHECKSUM.txt">c</a>
      <a href="?download=data%2F2026%2Fdiscogs_20260901_artists.xml.gz">a</a>`
    assert.deepEqual(datesInListing(html), ['20260801', '20260901'])
  })

  test('names and addresses the way Discogs publishes them', () => {
    assert.equal(fileName('20260901', 'releases'), 'discogs_20260901_releases.xml.gz')
    assert.equal(fileName('20260901', 'CHECKSUM'), 'discogs_20260901_CHECKSUM.txt')
    assert.equal(
      downloadUrl('20260901', 'discogs_20260901_labels.xml.gz'),
      'https://data.discogs.com/?download=data%2F2026%2Fdiscogs_20260901_labels.xml.gz',
    )
  })

  test('reads "sum  name" lines and nothing else', () => {
    const sums = parseChecksums(
      `${'a'.repeat(64)} discogs_20260901_labels.xml.gz\n\nnonsense\n`,
    )
    assert.equal(sums.get('discogs_20260901_labels.xml.gz'), 'a'.repeat(64))
    assert.equal(sums.size, 1)
  })
})

describe('the job', () => {
  test('builds the newest month, points current at it, and cleans up', async () => {
    const { root, dataDir, scratchDir } = dirs()
    const { fetchImpl, calls } = discogs(['20260801', '20260901'])
    try {
      const status = await runOnce({ dataDir, scratchDir, fetchImpl })
      assert.equal(status.outcome, 'built')
      assert.equal(status.build, '2026-09-01')
      assert.equal(status.counts?.release, 400)
      assert.ok(status.bytes! > 100_000)
      assert.equal(readlinkSync(join(dataDir, 'current')), '2026-09-01.sqlite')
      assert.equal(await currentBuild(dataDir), '2026-09-01')
      assert.deepEqual((await lastStatus(dataDir))?.outcome, 'built')
      // The scratch is gone, the download happened once per file.
      assert.ok(!existsSync(join(scratchDir, 'dump')))
      assert.equal(calls.filter((c) => c.includes('releases.xml.gz')).length, 1)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('does nothing when the newest month is already current', async () => {
    const { root, dataDir, scratchDir } = dirs()
    const { fetchImpl, calls } = discogs(['20260901'])
    try {
      await runOnce({ dataDir, scratchDir, fetchImpl })
      const before = calls.length
      const again = await runOnce({ dataDir, scratchDir, fetchImpl })
      assert.equal(again.outcome, 'current')
      assert.equal(again.build, '2026-09-01')
      // One look at the listing, no download.
      assert.equal(calls.length, before + 1)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('keeps two builds and checks the new one against the old', async () => {
    const { root, dataDir, scratchDir } = dirs()
    try {
      for (const date of ['20260701', '20260801', '20260901']) {
        const status = await runOnce({
          dataDir,
          scratchDir,
          fetchImpl: discogs([date]).fetchImpl,
        })
        assert.equal(status.outcome, 'built', date)
      }
      assert.ok(!existsSync(join(dataDir, '2026-07-01.sqlite')))
      assert.ok(existsSync(join(dataDir, '2026-08-01.sqlite')))
      assert.ok(existsSync(join(dataDir, '2026-09-01.sqlite')))
      assert.equal(await currentBuild(dataDir), '2026-09-01')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('says no when there is no dump, and fails without moving current on a broken file', async () => {
    const { root, dataDir, scratchDir } = dirs()
    try {
      const none = await runOnce({ dataDir, scratchDir, fetchImpl: discogs([]).fetchImpl })
      assert.equal(none.outcome, 'no-dump')

      await runOnce({ dataDir, scratchDir, fetchImpl: discogs(['20260801']).fetchImpl })
      const broken = await runOnce({
        dataDir,
        scratchDir,
        fetchImpl: discogs(['20260901'], { corrupt: true }).fetchImpl,
      })
      assert.equal(broken.outcome, 'failed')
      assert.match(broken.error!, /arrived as/)
      assert.equal(await currentBuild(dataDir), '2026-08-01')
      assert.ok(!existsSync(join(dataDir, '2026-09-01.sqlite')))
      assert.ok(!existsSync(join(dataDir, '2026-09-01.sqlite.building')))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
