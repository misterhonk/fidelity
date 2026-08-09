import { describe, expect, it } from 'vitest'

import { healthResponseSchema } from '#shared/schemas/health'

const green = {
  status: 'ok' as const,
  version: '0.1.0',
  uptimeSeconds: 42,
  checkedAt: '2026-08-09T09:12:00.000Z',
  checks: { database: { ok: true, latencyMs: 3 } },
}

describe('health response schema', () => {
  it('accepts a healthy response', () => {
    expect(healthResponseSchema.parse(green)).toEqual(green)
  })

  it('keeps latencyMs nullable so a failed check can still report', () => {
    const red = {
      ...green,
      status: 'degraded' as const,
      checks: { database: { ok: false, latencyMs: null, detail: 'AggregateError' } },
    }
    expect(healthResponseSchema.parse(red).checks.database.latencyMs).toBeNull()
  })

  it('rejects a status outside the enum', () => {
    expect(() => healthResponseSchema.parse({ ...green, status: 'fine' })).toThrow()
  })

  it('rejects a non-ISO timestamp', () => {
    expect(() => healthResponseSchema.parse({ ...green, checkedAt: '09.08.2026' })).toThrow()
  })
})
