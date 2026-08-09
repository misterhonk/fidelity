import type { WatchAlert, WatchService } from '#shared/ports'

import type { DiscogsClient } from '../discogs/client'

import { checkWatched, setWatching, watchedDealers } from './check'

export interface LocalWatchService extends WatchService {
  /** Registered dealers. Not part of the port — the UI and the tests read it. */
  dealers(): Promise<string[]>
}

/**
 * The hub-less watch service.
 *
 * A browser does not scan while it is closed, so without a hub there is no
 * background watching to be had: the check happens when the app is opened,
 * which is also the only moment somebody is around to care about the answer.
 *
 * `register` is the whole watchlist API — it takes the complete set every
 * time, so unwatching is expressed by leaving somebody out rather than by a
 * second method the port does not have.
 *
 * Registration lives on the dealer rows rather than in memory or in a store of
 * its own: "einen Händler merken" is a property of that dealer, and a second
 * store keyed by the same username would be two rows to keep in step.
 */
export function createLocalWatchService(client: () => DiscogsClient): LocalWatchService {
  return {
    async dealers() {
      return (await watchedDealers()).map((dealer) => dealer.username)
    },

    async register(dealers) {
      const wanted = new Set(dealers)
      const current = await watchedDealers()

      for (const dealer of current) {
        if (!wanted.has(dealer.username)) await setWatching(dealer.username, false)
      }
      for (const username of wanted) {
        await setWatching(username, true)
      }
    },

    async pending(): Promise<WatchAlert[]> {
      const { alerts } = await checkWatched({ client: client() })
      return alerts
    },
  }
}
