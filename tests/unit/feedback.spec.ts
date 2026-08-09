import { afterEach, describe, expect, it } from 'vitest'

import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import type { Signal } from '#shared/types'
import {
  allFeedback,
  clearFeedback,
  feedbackVerdicts,
  recordFeedback,
} from '~~/worker/feedback'

afterEach(async () => {
  await deleteFidelityDb()
})

const subject = (listingId: number, signals: Signal[] = []) => ({
  listingId,
  releaseId: listingId * 10,
  score: 71,
  signals,
})

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
    // No price, no condition, no dealer — so this outlives the ToS window and
    // is the one part of a dig that is meant to be permanent.
    expect(Object.keys(entry!).sort()).toEqual([
      'createdAt',
      'listingId',
      'releaseId',
      'score',
      'signals',
      'verdict',
    ])
  })
})
