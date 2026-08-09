import { sql } from 'drizzle-orm'

import { useDatabase } from '../db/client'
import type { HealthCheck, HealthResponse } from '#shared/schemas/health'

async function pingDatabase(): Promise<HealthCheck> {
  const startedAt = performance.now()
  try {
    await useDatabase().execute(sql`SELECT 1`)
    return { ok: true, latencyMs: Math.round(performance.now() - startedAt) }
  } catch (error) {
    // The full error goes to the log, never into the response: a connection
    // error can carry the DSN, and this endpoint has no authentication.
    console.error('[health] database ping failed', error)
    return {
      ok: false,
      latencyMs: null,
      detail: error instanceof Error ? error.name : 'UnknownError',
    }
  }
}

export default defineEventHandler(async (event): Promise<HealthResponse> => {
  const database = await pingDatabase()
  const healthy = database.ok

  setResponseStatus(event, healthy ? 200 : 503)
  // A monitor that caches this endpoint is a monitor that lies.
  setResponseHeader(event, 'Cache-Control', 'no-store')

  return {
    status: healthy ? 'ok' : 'degraded',
    version: useRuntimeConfig(event).public.version,
    uptimeSeconds: Math.round(process.uptime()),
    checkedAt: new Date().toISOString(),
    checks: { database },
  }
})
