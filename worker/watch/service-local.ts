import type { WatchAlert, WatchService } from '#shared/ports'

export interface LocalWatchService extends WatchService {
  /** Registered dealers. Not part of the port — M6 and the tests read it. */
  readonly dealers: readonly string[]
}

/**
 * The hub-less watch service.
 *
 * A browser does not scan while it is closed, so without a hub there is no
 * background watching to be had — the check happens when the app is opened
 * (M6). Until that check exists there is nothing to compare against, so
 * `pending()` truthfully reports nothing rather than inventing a number.
 *
 * The registration is deliberately in-memory: docs/03-DATENMODELL.md defines
 * no store for a watchlist yet, and adding one is an M6 decision rather than
 * something to slip in here.
 */
export function createLocalWatchService(): LocalWatchService {
  let watched: readonly string[] = []

  return {
    get dealers() {
      return watched
    },

    async register(dealers) {
      watched = [...new Set(dealers)]
    },

    async pending(): Promise<WatchAlert[]> {
      return []
    },
  }
}
