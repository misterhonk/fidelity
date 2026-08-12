import { deleteMeta, getMeta, getPreferences, setMeta } from '~~/db/meta'
import type { PushRegistration } from '#shared/types'

import { createHubClient } from '../hub/client'
import { HUB_TIMEOUT_MS, withTimeout } from '../hub/fallback'

import { watchedDealers } from './check'

/**
 * Telling a hub where to reach this device.
 *
 * The watchlist works without any of this — `service-local.ts` checks the
 * watched shops when the app is opened, which is the best a browser can do on
 * its own, because a browser does not run while it is closed. What a hub adds
 * is the times it is closed: it asks once for everybody, and the answer
 * arrives as a notification.
 *
 * So everything here is allowed to fail and say nothing (rule 8). No hub, an
 * old hub, a hub that is down: the app keeps the local check and never shows
 * a broken screen for a feature that is an addition in the first place.
 *
 * The subscription lives in `meta` rather than being asked for each time,
 * because the list it carries changes later than the permission does — and
 * `pushManager.getSubscription()` needs a page, which is the one thing this
 * feature is about not having.
 */

async function hub() {
  const preferences = await getPreferences()
  return createHubClient({ baseUrl: preferences.hubUrl, secret: preferences.hubSecret })
}

/**
 * The hub's public VAPID key, or null when there is nothing to subscribe to.
 *
 * The first call of the whole flow: no browser will create a subscription
 * without it, so a null here is what the screen turns into "not available"
 * rather than an error.
 */
export async function pushKey(): Promise<string | null> {
  const client = await hub()
  if (!client) return null

  try {
    return await withTimeout(client.watchKey(), HUB_TIMEOUT_MS)
  } catch {
    return null
  }
}

/** Whether this device believes it is registered. */
export async function pushRegistration(): Promise<PushRegistration | null> {
  return (await getMeta('pushRegistration')) ?? null
}

/**
 * Remember this device and tell the hub what it watches.
 *
 * Stored first and sent second, deliberately. A registration that reached the
 * hub but was never stored is the worse half: the device would receive
 * notifications it cannot turn off, because turning them off needs the
 * endpoint. Stored-but-not-sent costs one silent shop until the next change.
 */
export async function enablePush(registration: PushRegistration): Promise<boolean> {
  await setMeta('pushRegistration', registration)
  return syncPush()
}

/**
 * Send the current watchlist, if this device is registered at all.
 *
 * Called after every change to the list — watching a shop that the hub does
 * not know about is a shop nobody hears about.
 */
export async function syncPush(): Promise<boolean> {
  const registration = await pushRegistration()
  if (!registration) return false

  const client = await hub()
  if (!client) return false

  const dealers = (await watchedDealers()).map((dealer) => dealer.username)

  try {
    return await withTimeout(client.watchSubscribe(registration, dealers), HUB_TIMEOUT_MS)
  } catch {
    return false
  }
}

/**
 * Forget this device, here and at the hub.
 *
 * The local row goes even when the hub cannot be reached. Keeping it would
 * leave a switch that says "on" for notifications that were asked to stop —
 * and the hub drops an address by itself as soon as the push service reports
 * it gone (hub/src/watch.ts), which is what happens to a browser whose
 * permission was revoked.
 */
export async function disablePush(): Promise<void> {
  const registration = await pushRegistration()
  await deleteMeta('pushRegistration')
  if (!registration) return

  const client = await hub()
  if (!client) return

  try {
    await withTimeout(client.watchUnsubscribe(registration.endpoint), HUB_TIMEOUT_MS)
  } catch {
    // See above: the hub cleans up after itself. This is a courtesy, not a
    // guarantee, and it must never keep somebody waiting on a screen.
  }
}
