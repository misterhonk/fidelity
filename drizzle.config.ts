import { defineConfig } from 'drizzle-kit'

// Node 22 built-in; drizzle-kit does not read .env on its own.
try {
  process.loadEnvFile('.env')
} catch {
  // No .env — fall back to whatever the shell or Docker provides.
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/db/schema/*.ts',
  out: './server/db/migrations',
  // `catalog` is built locally from the CC0 dumps and shipped as a pg_dump.
  // Drizzle must never diff or drop it (M5, docs/03-DATENMODELL.md §3).
  schemaFilter: ['app'],
  casing: 'snake_case',
  strict: true,
  verbose: true,
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://fidelity:dev@localhost:5432/fidelity',
  },
})
