import { deleteDB, openDB, type IDBPDatabase } from 'idb'

import { log } from '~~/worker/log'

import { repairShipsFrom } from './dealer'
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
        collection.createIndex('by-label', 'labelNorms', { multiEntry: true })

        const wantlist = db.createObjectStore('wantlist', { keyPath: 'releaseId' })
        wantlist.createIndex('by-master', 'masterId')

        db.createObjectStore('horizon', { keyPath: 'key' })
        db.createObjectStore('dealers', { keyPath: 'username' })
        db.createObjectStore('digs', { keyPath: 'id' })

        const matches = db.createObjectStore('matches', { keyPath: ['digId', 'listingId'] })
        matches.createIndex('by-dig-score', ['digId', 'score'])

        db.createObjectStore('basket', { keyPath: 'listingId' })
        db.createObjectStore('feedback', { keyPath: 'listingId' }).createIndex(
          'by-dealer',
          'dealer',
        )
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

      /*
       * v8 keeps what a dig would otherwise throw away.
       *
       * A scan sees every row of the inventory and used to keep only the
       * matches. That left "what does this shop have on Warp?" unanswerable —
       * and unanswerable exactly when the question is interesting: for a label
       * you own nothing by, there are no matches at all.
       *
       * Purely additive, like v7: nothing is discarded, nothing has to be
       * fetched again. The store stays empty until the next dig runs, and
       * empties again with every dig that expires (db/expire.ts).
       *
       * No `oldVersion > 0` here either: a fresh database needs the store just
       * as much, or the code expects something that does not exist.
       */
      if (oldVersion < 8) {
        const stock = db.createObjectStore('stock', {
          keyPath: ['digId', 'listingId'],
        })
        stock.createIndex('by-dig-label', ['digId', 'label'])
        stock.createIndex('by-dig-decade', ['digId', 'decade'])
      }

      if (oldVersion < 9) {
        /*
         * v9 brings the watched records (M11).
         *
         * Purely additive: a new store, no field on any existing row, so there
         * is nothing to convert and nothing to discard. Anyone watching
         * nothing before is watching nothing after.
         */
        db.createObjectStore('watched', { keyPath: 'releaseId' })
      }

      if (oldVersion < 10) {
        /*
         * v10 brings the storage places (M12). Additive again.
         *
         * `by-place` turns "what is in crate 3" into a range read instead of a
         * walk through two thousand rows. There is none on `parentId`:
         * IndexedDB does not index `null`, so the topmost places would drop
         * out — and with twenty places a `getAll()` is cheaper than the index
         * anyway.
         */
        db.createObjectStore('places', { keyPath: 'id' })

        const placements = db.createObjectStore('placements', { keyPath: 'instanceId' })
        placements.createIndex('by-place', 'placeId')
      }

      if (oldVersion < 11) {
        /*
         * v11 keeps Discogs' estimate of the collection, one row a day
         * (M19 #3). Additive, like v7 to v10: the store starts empty and
         * fills with the next sync that fetches the value. This is the one
         * store that cannot be rebuilt from the API — Discogs keeps no history
         * of that number — which is why it also goes into the backup.
         */
        db.createObjectStore('valueHistory', { keyPath: 'day' })
      }

      if (oldVersion < 12) {
        /*
         * v12 keeps the bands somebody has on their radar and owns nothing by
         * (M29). Additive like v7 to v11: the store starts empty, and an
         * app with nothing in it behaves exactly as it did.
         */
        db.createObjectStore('followed', { keyPath: 'artistId' })
      }

      if (oldVersion < 13) {
        /*
         * v13 indexes the stock by release, so the basket comparison can ask
         * "who else has this one?" without walking every row of every dig
         * (M29). Additive, and on a store whose contents are deleted after six
         * hours anyway — there is nothing here to migrate, only to index.
         */
        const stock = tx.objectStore('stock')
        if (!stock.indexNames.contains('by-release')) {
          stock.createIndex('by-release', 'releaseId')
        }
      }

      // Guarded on the store, not only on the version: an upgrade that reaches
      // for a store a database does not have throws inside the transaction and
      // takes the whole open down with it.
      if (oldVersion > 0 && oldVersion < 14 && db.objectStoreNames.contains('dealers')) {
        /*
         * v14 repairs `Dealer.shipsFrom`, which held the wrong field.
         *
         * A listing's `ships_from` is an English country name (docs/02). A
         * user profile's `location` is a free-text box, and that is what the
         * import and the hand-entered shop were writing here: `fatplastics`
         * carried "Schillergäßchen 5, 07745 Jena, Thuringia, Germany - phone:
         * ++49-3641-35.38.00". The origin filter compared that against
         * "Germany" and hid every shop under every filter.
         *
         * Code alone does not fix a device that already has the rows, and
         * waiting for each shop to be dug again would leave the screen broken
         * for as long as that takes. So the rows are repaired: the country is
         * read out of the line, and the line moves to `location`, where it is
         * shown and never compared.
         *
         * Nothing is lost — a text that names no country stays in `location`
         * and only stops being mistaken for one.
         */
        const dealers = tx.objectStore('dealers')
        void dealers.openCursor().then(function walk(cursor): unknown {
          if (!cursor) return undefined
          const repaired = repairShipsFrom(cursor.value)
          if (repaired !== cursor.value) void cursor.update(repaired)
          return cursor.continue().then(walk)
        })
      }

      /*
       * Two indexes for the shops screen (M34.4). The grading read every
       * feedback row to find one shop's, and the shelf sample read the whole
       * collection to find four records on twelve labels — on every open of
       * a profile. `labelNorms` is an array, so the index is multi-entry.
       */
      if (oldVersion > 0 && oldVersion < 15) {
        if (db.objectStoreNames.contains('feedback')) {
          const feedback = tx.objectStore('feedback')
          if (!feedback.indexNames.contains('by-dealer')) {
            feedback.createIndex('by-dealer', 'dealer')
          }
        }
        if (db.objectStoreNames.contains('collection')) {
          const collection = tx.objectStore('collection')
          if (!collection.indexNames.contains('by-label')) {
            collection.createIndex('by-label', 'labelNorms', { multiEntry: true })
          }
        }
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
