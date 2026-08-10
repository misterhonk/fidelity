import { afterEach, describe, expect, it } from 'vitest'

import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import type { Signal } from '#shared/types'
import {
  allFeedback,
  clearFeedback,
  feedbackVerdicts,
  markedOverview,
  recordFeedback,
  setVerdict,
} from '~~/worker/feedback'

afterEach(async () => {
  await deleteFidelityDb()
})

const subject = (listingId: number, signals: Signal[] = []) => ({
  listingId,
  releaseId: listingId * 10,
  score: 71,
  signals,
  digId: '',
  title: '',
  artist: '',
})

/** A dig has to exist for the dealer lookup to find anything. */
async function dig(id: string, dealer: string) {
  const db = await openFidelityDb()
  await db.put('digs', {
    id,
    dealer,
    startedAt: 1000,
    expiresAt: 2000,
    status: 'done',
    scanned: 0,
    total: 0,
    matched: 0,
    coverage: 'full',
    currency: 'EUR',
  } as never)
}

describe('feedback', () => {
  it('keeps the reasoning, not only the verdict', async () => {
    const signals: Signal[] = [
      { type: 'ARTIST_KNOWN', confidence: 1, evidence: { artist: 'Robag Wruhme', owned: 5 } },
    ]
    await recordFeedback(subject(1, signals), 'interesting', 1000)

    const [entry] = await allFeedback()
    expect(entry).toMatchObject({
      listingId: 1,
      releaseId: 10,
      verdict: 'interesting',
      score: 71,
      createdAt: 1000,
    })
    expect(entry?.signals).toEqual(signals)
  })

  it('snapshots the signals instead of pointing at them', async () => {
    // The style pass rewrites match.signals after the scan. A snapshot that
    // changes afterwards is not a snapshot.
    const signals: Signal[] = [{ type: 'ARTIST_KNOWN', confidence: 1, evidence: {} }]
    await recordFeedback(subject(1, signals), 'interesting', 1000)

    signals.push({ type: 'STYLE_ADJACENT', confidence: 0.8, evidence: {} })
    signals[0]!.confidence = 0.1

    const [entry] = await allFeedback()
    expect(entry?.signals).toHaveLength(1)
    expect(entry?.signals[0]?.confidence).toBe(1)
  })

  it('replaces an earlier verdict rather than collecting both', async () => {
    await recordFeedback(subject(1), 'interesting', 1000)
    await recordFeedback(subject(1), 'wrong', 2000)

    expect(await allFeedback()).toHaveLength(1)
    expect(await feedbackVerdicts()).toEqual({ 1: 'wrong' })
  })

  it('can be taken back', async () => {
    await recordFeedback(subject(1), 'meh', 1000)
    await clearFeedback(1)
    expect(await feedbackVerdicts()).toEqual({})
  })

  it('exports newest first, which is the order you want to read it in', async () => {
    await recordFeedback(subject(1), 'meh', 1000)
    await recordFeedback(subject(2), 'bought', 3000)
    await recordFeedback(subject(3), 'wrong', 2000)

    expect((await allFeedback()).map((entry) => entry.listingId)).toEqual([2, 3, 1])
  })

  it('stores nothing that expires after six hours', async () => {
    await recordFeedback(subject(1), 'bought', 1000)

    const db = await openFidelityDb()
    const entry = await db.get('feedback', 1)

    /*
     * The line is drawn at numbers, not at facts.
     *
     * What CLAUDE.md rule 4 deletes after six hours is the offer: the price,
     * the condition, the sleeve grade, the seller's note. None of those are
     * here and none ever will be — this store is meant to be permanent.
     *
     * Who made the record, what it is called and which shop had it are not the
     * offer. They are how a shortlist is still readable a year later, once the
     * dig it came from was pruned at five. The basket has kept the title for
     * exactly this reason since M4.
     *
     * `updatedAt` is not marketplace data either — it is when *you* last
     * touched this row, and it is what decides which of two devices is right
     * when they disagree.
     */
    expect(Object.keys(entry!).sort()).toEqual([
      'artist',
      'createdAt',
      'dealer',
      'listingId',
      'releaseId',
      'score',
      'signals',
      'title',
      'updatedAt',
      'verdict',
    ])
  })
})

describe('the shortlist', () => {
  it('keeps enough to still be readable once the dig is gone', async () => {
    // Only the last five digs survive. Two integers are not a shortlist.
    await dig('D1', 'plattenkiste')
    await recordFeedback(
      { ...subject(1), digId: 'D1', artist: 'Robag Wruhme', title: 'Wuzzelbud KK' },
      'interesting',
      1000,
    )

    const [entry] = await allFeedback()
    expect(entry?.artist).toBe('Robag Wruhme')
    expect(entry?.title).toBe('Wuzzelbud KK')
    expect(entry?.dealer).toBe('plattenkiste')

    // And still no numbers off the marketplace — that is what expires.
    expect(entry).not.toHaveProperty('price')
    expect(entry).not.toHaveProperty('condition')
  })

  it('groups by shop, fullest shop first', async () => {
    await dig('D1', 'einer')
    await dig('D2', 'zwei')

    await recordFeedback({ ...subject(1), digId: 'D1' }, 'interesting', 1000)
    await recordFeedback({ ...subject(2), digId: 'D2' }, 'interesting', 2000)
    await recordFeedback({ ...subject(3), digId: 'D2' }, 'interesting', 3000)

    const overview = await markedOverview()
    // Postage is per shipment: the shop with three is where an order forms.
    expect(overview.groups.map((group) => group.dealer)).toEqual(['zwei', 'einer'])
    // Newest first inside a shop — that is the dig you are still thinking about.
    expect(overview.groups[0]?.records.map((record) => record.listingId)).toEqual([3, 2])
    expect(overview.total).toBe(3)
  })

  it('shows only what you said yes to', async () => {
    await dig('D1', 'einer')
    await recordFeedback({ ...subject(1), digId: 'D1' }, 'interesting', 1000)
    await recordFeedback({ ...subject(2), digId: 'D1' }, 'meh', 1000)
    await recordFeedback({ ...subject(3), digId: 'D1' }, 'wrong', 1000)
    await recordFeedback({ ...subject(4), digId: 'D1' }, 'bought', 1000)

    const overview = await markedOverview()
    // "meh" and "wrong" are training data, not a list anybody wants to read.
    expect(overview.total).toBe(1)
    expect(overview.bought.map((record) => record.listingId)).toEqual([4])
  })

  it('does not count a sold record as still worth a request', async () => {
    await dig('D1', 'einer')
    await recordFeedback({ ...subject(1), digId: 'D1' }, 'interesting', 1000)
    await recordFeedback({ ...subject(2), digId: 'D1' }, 'interesting', 1000)

    const db = await openFidelityDb()
    const gone = await db.get('feedback', 2)
    await db.put('feedback', { ...gone!, soldAt: 5000 })

    const overview = await markedOverview()
    expect(overview.total).toBe(2)
    // A listing id does not come back on the market, so asking again is waste.
    expect(overview.stillOpen).toBe(1)
    expect(overview.groups[0]?.open).toBe(1)
  })

  it('changes its mind without losing why', async () => {
    await dig('D1', 'plattenkiste')
    const signals: Signal[] = [
      { type: 'ARTIST_KNOWN', confidence: 1, evidence: { artist: 'Robag', owned: 5 } },
    ]
    await recordFeedback(
      { ...subject(1, signals), digId: 'D1', artist: 'Robag', title: 'Wuzzelbud KK' },
      'interesting',
      1000,
    )

    await setVerdict(1, 'bought')

    const [entry] = await allFeedback()
    expect(entry?.verdict).toBe('bought')
    /*
     * The snapshot is the whole reason this store exists (docs/03 §7). Writing
     * a fresh row from the shortlist would throw it away — and there is no
     * `Match` left to rebuild it from, because the dig was pruned long ago.
     */
    expect(entry?.signals).toEqual(signals)
    expect(entry?.title).toBe('Wuzzelbud KK')
    expect(entry?.dealer).toBe('plattenkiste')

    const overview = await markedOverview()
    expect(overview.total).toBe(0)
    expect(overview.bought.map((record) => record.listingId)).toEqual([1])
  })

  it('does nothing to a listing it has never judged', async () => {
    await setVerdict(999, 'bought')
    expect(await allFeedback()).toEqual([])
  })

  it('survives rows written before titles were kept', async () => {
    const db = await openFidelityDb()
    await db.put('feedback', {
      listingId: 9,
      releaseId: 90,
      verdict: 'interesting',
      signals: [],
      score: 60,
      createdAt: 1000,
    })

    const overview = await markedOverview()
    // Says so rather than inventing one; the release id still links out.
    expect(overview.groups[0]?.records[0]?.title).toBeNull()
    expect(overview.groups[0]?.records[0]?.dealer).toBeNull()
    expect(overview.groups[0]?.dealer).toBeNull()
  })
})
