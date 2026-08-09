import { describe, expect, it } from 'vitest'

import type { HorizonChunk } from '#shared/types'
import {
  DAILY_REQUEST_BUDGET,
  MIN_INTERVAL_MS,
  planRevalidation,
  REQUESTS_PER_ENTITY,
} from '~~/worker/horizon/revalidate'
import type { Candidate } from '~~/worker/horizon/select'

const DAY = 24 * 60 * 60 * 1000
const TTL = 30 * DAY

const candidate = (id: number): Candidate => ({
  kind: 'artist',
  id,
  name: `Künstler ${id}`,
  owned: 2,
})

const chunk = (id: number, fetchedAt: number): HorizonChunk =>
  ({
    key: `artist:${id}`,
    kind: 'artist',
    entityId: id,
    name: `Künstler ${id}`,
    fetchedAt,
    complete: true,
    requests: 1,
    releaseIds: Int32Array.from([1]),
    roles: new Uint8Array(1),
    years: new Int16Array(1),
  }) as HorizonChunk

const now = 100 * DAY

describe('spreading the revalidation over days', () => {
  it("takes only a day's worth, oldest first", () => {
    const candidates = Array.from({ length: 40 }, (_, i) => candidate(i + 1))
    const chunks = candidates.map((c, i) => chunk(c.id, now - TTL - (40 - i) * DAY))

    const plan = planRevalidation({ candidates, chunks, now, lastRunAt: null, ttlMs: TTL })

    // A flat TTL would hand back all forty at once — a 670-request wall every
    // thirty days, which is exactly what docs/11 §3 asks to avoid.
    expect(plan.due).toHaveLength(DAILY_REQUEST_BUDGET / REQUESTS_PER_ENTITY)
    expect(plan.stale).toBe(40)
    expect(plan.due[0]?.id).toBe(1)
  })

  it('leaves the fresh ones alone', () => {
    const candidates = [candidate(1), candidate(2)]
    const chunks = [chunk(1, now - TTL - DAY), chunk(2, now - DAY)]

    const plan = planRevalidation({ candidates, chunks, now, lastRunAt: null, ttlMs: TTL })
    expect(plan.due.map((c) => c.id)).toEqual([1])
  })

  it('does not run twice in one day however often the app is opened', () => {
    const candidates = [candidate(1)]
    const chunks = [chunk(1, now - TTL - DAY)]

    const plan = planRevalidation({
      candidates,
      chunks,
      now,
      lastRunAt: now - MIN_INTERVAL_MS + 1000,
      ttlMs: TTL,
    })
    expect(plan.due).toEqual([])
    expect(plan.reason).toBe('too-soon')
    // It still says how far behind it is, so the interface can be honest.
    expect(plan.stale).toBe(1)
  })

  it('runs again once a day has passed', () => {
    const candidates = [candidate(1)]
    const chunks = [chunk(1, now - TTL - DAY)]

    const plan = planRevalidation({
      candidates,
      chunks,
      now,
      lastRunAt: now - MIN_INTERVAL_MS - 1000,
      ttlMs: TTL,
    })
    expect(plan.due).toHaveLength(1)
  })

  it('says nothing is stale rather than nothing is due', () => {
    const plan = planRevalidation({
      candidates: [candidate(1)],
      chunks: [chunk(1, now)],
      now,
      lastRunAt: null,
      ttlMs: TTL,
    })
    expect(plan.reason).toBe('nothing-stale')
  })

  it('leaves a horizon that was never built to the deliberate run', () => {
    // Spending twenty requests on a first build behind somebody's back is the
    // same mistake as a background sync nobody asked for.
    const plan = planRevalidation({
      candidates: [candidate(1), candidate(2)],
      chunks: [],
      now,
      lastRunAt: null,
      ttlMs: TTL,
    })
    expect(plan.due).toEqual([])
    expect(plan.reason).toBe('never-built')
  })

  it('ignores entities that were never expanded, even beside stale ones', () => {
    const candidates = [candidate(1), candidate(2)]
    // Only the first was ever expanded; the second belongs to the full build.
    const chunks = [chunk(1, now - TTL - DAY)]

    const plan = planRevalidation({ candidates, chunks, now, lastRunAt: null, ttlMs: TTL })
    expect(plan.due.map((c) => c.id)).toEqual([1])
  })

  it('holds the numbers docs/11 §3 asks for', () => {
    expect(DAILY_REQUEST_BUDGET).toBe(20)
    expect(MIN_INTERVAL_MS).toBeLessThan(24 * 60 * 60 * 1000)
  })
})
