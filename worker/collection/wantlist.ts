import { openFidelityDb } from '~~/db/open'
import type { WantedRecord, WantlistOverview } from '#shared/types'

/**
 * The wantlist, which nothing has ever shown.
 *
 * Twenty-one records were being synced, used for S1 and S2, and never
 * displayed anywhere — the one list in this app that *is* the collector's
 * list of gaps, invisible between digs.
 *
 * Everything here is already on the device: the wantlist rows, the horizon's
 * master chunks, and the matches from the last five digs. No requests.
 */

export async function wantlistOverview(now: number): Promise<WantlistOverview> {
  const db = await openFidelityDb()

  const [wantlist, chunks, digs, matches] = await Promise.all([
    db.getAll('wantlist'),
    db.getAll('horizon'),
    db.getAll('digs'),
    db.getAll('matches'),
  ])

  // How many pressings the horizon knows of each wanted album. This is what
  // turns "on the wantlist" into "and there are 160 of them out there".
  const pressings = new Map<number, number>()
  for (const chunk of chunks) {
    if (chunk.kind === 'master') pressings.set(chunk.entityId, chunk.releaseIds.length)
  }

  const dealerOf = new Map(digs.map((dig) => [dig.id, dig.dealer]))
  const startedOf = new Map(digs.map((dig) => [dig.id, dig.startedAt]))

  /*
   * Where a dig has seen this album — by master where there is one, so a
   * different pressing still counts as "seen". That is the whole point of S2,
   * and a wantlist screen that only matched exact release ids would report
   * "never seen" about a record somebody was offered last week.
   */
  const seenByMaster = new Map<number, { dealer: string; at: number; score: number }>()
  const seenByRelease = new Map<number, { dealer: string; at: number; score: number }>()

  for (const match of matches) {
    const dealer = dealerOf.get(match.digId)
    const at = startedOf.get(match.digId)
    if (!dealer || at === undefined) continue

    const entry = { dealer, at, score: match.score }
    const previous = seenByRelease.get(match.releaseId)
    if (!previous || previous.at < at) seenByRelease.set(match.releaseId, entry)

    for (const signal of match.signals) {
      if (signal.type !== 'WANTLIST_PRESSING' && signal.type !== 'WANTLIST_EXACT') continue
      const master = Number(signal.evidence.masterId ?? 0)
      if (master > 0) {
        const before = seenByMaster.get(master)
        if (!before || before.at < at) seenByMaster.set(master, entry)
      }
    }
  }

  const records: WantedRecord[] = wantlist.map((item) => {
    const seen = seenByRelease.get(item.releaseId) ?? seenByMaster.get(item.masterId) ?? null

    return {
      releaseId: item.releaseId,
      masterId: item.masterId,
      title: item.title,
      artist: item.artistNames[0] ?? item.artistNorms[0] ?? '',
      year: item.year,
      addedAt: item.addedAt,
      thumbUrl: item.thumbUrl ?? '',
      coverUrl: item.coverUrl ?? '',
      note: item.note ?? '',
      want: item.want ?? 0,
      // Null means the horizon has not expanded this album — the pressings are
      // unknown rather than zero, and the interface says so.
      pressings: item.masterId > 0 ? (pressings.get(item.masterId) ?? null) : null,
      lastSeen: seen,
    }
  })

  return {
    total: records.length,
    /*
     * Longest wanted first.
     *
     * A wantlist is a queue of disappointments, and the record that has been
     * on it since 2019 is the one worth being reminded of. `date_added` is
     * what Discogs gives and it sorts as a string because it is ISO 8601.
     */
    records: records.sort((a, b) => a.addedAt.localeCompare(b.addedAt)),
    /** How many the horizon can say anything about at all. */
    withPressings: records.filter((record) => record.pressings !== null).length,
    seenRecently: records.filter(
      (record) => record.lastSeen !== null && now - record.lastSeen.at < 30 * 24 * 3600_000,
    ).length,
  }
}
