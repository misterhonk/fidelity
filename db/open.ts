import { deleteDB, openDB, type IDBPDatabase } from 'idb'

import { log } from '~~/worker/log'

import { DB_NAME, DB_VERSION, type FidelityDB } from './schema'

export type FidelityDatabase = IDBPDatabase<FidelityDB>

let handle: Promise<FidelityDatabase> | undefined

/**
 * Opens (and on first call creates) the database. Safe to call from both the
 * main thread and the worker — each context keeps its own connection.
 */
export function openFidelityDb(): Promise<FidelityDatabase> {
  handle ??= openDB<FidelityDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('meta', { keyPath: 'key' })

        const collection = db.createObjectStore('collection', { keyPath: 'releaseId' })
        collection.createIndex('by-master', 'masterId')

        const wantlist = db.createObjectStore('wantlist', { keyPath: 'releaseId' })
        wantlist.createIndex('by-master', 'masterId')

        db.createObjectStore('horizon', { keyPath: 'key' })
        db.createObjectStore('dealers', { keyPath: 'username' })
        db.createObjectStore('digs', { keyPath: 'id' })

        const matches = db.createObjectStore('matches', { keyPath: ['digId', 'listingId'] })
        matches.createIndex('by-dig-score', ['digId', 'score'])

        db.createObjectStore('basket', { keyPath: 'listingId' })
        db.createObjectStore('feedback', { keyPath: 'listingId' })
      }

      // Future versions go here. The rule: never migrate destructively unless
      // the state can be rebuilt from the API — which, so far, all of it can.
    },

    blocked() {
      // Another tab still holds the old version.
      log.warn('[db] upgrade blocked by another tab')
    },

    blocking() {
      // This connection is holding up an upgrade elsewhere. Let go.
      void handle?.then((db) => db.close())
      handle = undefined
    },

    terminated() {
      // The browser killed the connection; the next call reopens it.
      handle = undefined
    },
  })

  return handle
}

/**
 * "Sign out" — deletes the token *and* every trace of the account's data.
 * All of it is reproducible from the API, so this is a real exit, not a loss.
 */
export async function deleteFidelityDb(): Promise<void> {
  const open = handle
  handle = undefined
  if (open) {
    await open.then((db) => db.close())
  }
  await deleteDB(DB_NAME)
}
