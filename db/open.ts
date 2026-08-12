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
    upgrade(db, oldVersion, _newVersion, tx) {
      if (oldVersion < 1) {
        db.createObjectStore('meta', { keyPath: 'key' })

        const collection = db.createObjectStore('collection', { keyPath: 'instanceId' })
        collection.createIndex('by-master', 'masterId')
        collection.createIndex('by-release', 'releaseId')

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

      if (oldVersion > 0 && oldVersion < 2) {
        // v2 added artistNames/labelNames to the mirrored rows. Rows written
        // by v1 lack them, and code that reads a field the data does not have
        // fails in whatever place happens to touch it first.
        //
        // Dropping and refetching is the right migration here, not a
        // workaround: every row is reproducible from the API, so this costs a
        // resync and nothing else. Clearing the watermark is what makes the
        // next sync a full walk rather than a delta over a hole.
        tx.objectStore('collection').clear()
        tx.objectStore('wantlist').clear()
        tx.objectStore('meta').delete('syncState')
        tx.objectStore('meta').delete('tasteProfile')
      }

      if (oldVersion > 0 && oldVersion < 3) {
        // v3 added the cover to the mirrored rows. Same reasoning as v2, and
        // the same price: every row comes back from the API, so this costs a
        // resync and nothing else.
        tx.objectStore('collection').clear()
        tx.objectStore('wantlist').clear()
        tx.objectStore('meta').delete('syncState')
        tx.objectStore('meta').delete('tasteProfile')
      }

      if (oldVersion < 4) {
        // v4 adds the cover store. Purely additive — no existing row changes
        // shape, so nothing is cleared and nobody has to resync to get it.
        db.createObjectStore('covers', { keyPath: 'releaseId' })
      }

      if (oldVersion < 5) {
        db.createObjectStore('outbox', { keyPath: 'id' })
        db.createObjectStore('fieldValues', { keyPath: 'instanceId' })
      }

      if (oldVersion > 0 && oldVersion < 5) {
        /*
         * v5 keeps the entry ids a write has to address, and the collection
         * sync is a delta — it stops at the first record it already knows.
         *
         * Which means leaving the old rows in place would not be the harmless
         * "they simply cannot be rated" it looks like: they could *never* be
         * rated, because no later sync would ever walk back far enough to fill
         * them in. A shelf with no stars, permanently, and no hint why.
         *
         * So the same trade as v2 and v3: every row is reproducible from the
         * API, so this costs one walk of the collection and nothing else.
         * Clearing the watermark is what makes that walk a full one.
         */
        tx.objectStore('collection').clear()
        tx.objectStore('meta').delete('syncState')
        tx.objectStore('meta').delete('tasteProfile')
      }

      if (oldVersion > 0 && oldVersion < 6) {
        /*
         * v6 keys the shelf by entry instead of by release.
         *
         * A collector can own the same record twice, and Discogs says so: 34
         * rows, 32 releases, measured on a real account. Keyed by release the
         * second copy overwrote the first without a trace — one copy
         * invisible, and a rating landing on whichever instance the sync
         * happened to write last.
         *
         * A keyPath cannot be changed in place, so the store is dropped and
         * rebuilt. Same trade as v2, v3 and v5: every row comes back from the
         * API, so this costs one walk of the collection.
         *
         * `fieldValues` goes with it, and for the same reason: media and
         * sleeve condition describe *a copy*, not a record. Keyed by release
         * they would have been two copies' worth of notes on top of each
         * other. Nothing is lost that Discogs could have told us anyway — it
         * hands these back in no listing, and a wrong value is worse than an
         * empty field.
         */
        db.deleteObjectStore('collection')
        const shelf = db.createObjectStore('collection', { keyPath: 'instanceId' })
        shelf.createIndex('by-master', 'masterId')
        shelf.createIndex('by-release', 'releaseId')

        db.deleteObjectStore('fieldValues')
        db.createObjectStore('fieldValues', { keyPath: 'instanceId' })

        tx.objectStore('meta').delete('syncState')
        tx.objectStore('meta').delete('tasteProfile')
      }

      if (oldVersion < 7) {
        /*
         * v7 adds a place for what only `/releases/{id}` knows.
         *
         * Purely additive — nothing is dropped and nothing has to be fetched
         * again. The store starts empty and fills as records are opened, one
         * request each, which is the only way rule 2 allows that endpoint to
         * be used at all.
         *
         * No `oldVersion > 0` here, unlike the destructive blocks above: this
         * one has to run on a brand new database too, or a first-time visitor
         * gets an app with a store the code expects and the database lacks.
         */
        db.createObjectStore('releaseDetail', { keyPath: 'releaseId' })
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
