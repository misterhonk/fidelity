import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import * as schema from './schema'

let pool: Pool | undefined
let database: ReturnType<typeof create> | undefined

function create(connectionString: string) {
  pool = new Pool({
    connectionString,
    // Uberspace gives us 1.5 GB for everything. PostgreSQL runs with
    // max_connections=20; a single Nitro process has no business claiming
    // more than a fraction of that (docs/01-ARCHITEKTUR.md §3).
    max: 8,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  })

  return drizzle(pool, { schema, casing: 'snake_case' })
}

/**
 * Lazily created singleton. `DATABASE_URL` is read at runtime, not at build
 * time — the production image is built once and run with a different URL.
 */
export function useDatabase() {
  if (!database) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set')
    }
    database = create(connectionString)
  }
  return database
}

/** Closes the pool. Nitro calls this on shutdown; tests call it when done. */
export async function closeDatabase() {
  await pool?.end()
  pool = undefined
  database = undefined
}

export { schema }
