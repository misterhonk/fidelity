import { afterEach, describe, expect, it, vi } from 'vitest'

import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import { getMeta, updatePreferences } from '~~/db/meta'
import type { Dealer } from '#shared/types'

/**
 * Where this device tells a hub how to reach it.
 *
 * Every line of it is optional by design (rule 8): without a hub the watchlist
 * is checked when the app opens, and that is the whole feature. So the thing
 * worth testing is not that it works — it is that it stays quiet and harmless
 * when there is nothing to talk to, and that the shop somebody just added
 * actually reaches the hub rather than sitting locally in a list nobody sends.
 */

afterEach(async () => {
  await deleteFidelityDb()
  vi.unstubAllGlobals()
})

const REGISTRATION = {
  endpoint: 'https://push.example/abc',
  keys: { p256dh: 'p256dh-value', auth: 'auth-value' },
}

function dealer(username: string): Dealer {
  return {
    username,
    listings: 0,
    matched: 0,
    hitRate: 0,
    lastScannedAt: null,
    watching: true,
    avatarUrl: null,
    shipsFrom: null,
    sellerRating: 0,
    ratingCount: 0,
  }
}

async function watching(...names: string[]) {
  const db = await openFidelityDb()
  for (const name of names) await db.put('dealers', dealer(name))
}

/** A hub that answers everything, and remembers what it was asked. */
function hub(publicKey = 'B'.repeat(87)) {
  const calls: { url: string; body: unknown }[] = []
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), body: init?.body ? JSON.parse(String(init.body)) : null })
    if (String(input).endsWith('/v1/watch/key')) {
      return new Response(JSON.stringify({ publicKey }), { status: 200 })
    }
    return new Response(JSON.stringify({ watching: 1 }), { status: 200 })
  })
  vi.stubGlobal('fetch', fetchImpl)
  return calls
}

describe('push registration', () => {
  it('says there is nothing to subscribe to when no hub is set', async () => {
    const { pushKey } = await import('~~/worker/watch/push')
    expect(await pushKey()).toBeNull()
  })

  /*
   * A key that is not a key.
   *
   * The hub is the component this client is written not to trust, and here it
   * matters twice over: `pushManager.subscribe` throws on a malformed
   * application server key, three call sites away from the answer that was
   * wrong. Null becomes "not available here", which is a screen somebody can
   * read.
   */
  it('refuses a VAPID key that is not one', async () => {
    await updatePreferences({ hubUrl: 'https://hub.example' })
    hub('<html>404</html>')

    const { pushKey } = await import('~~/worker/watch/push')
    expect(await pushKey()).toBeNull()
  })

  it('registers this device with the shops it watches', async () => {
    await updatePreferences({ hubUrl: 'https://hub.example' })
    await watching('plattenladen', 'vinylkeller')
    const calls = hub()

    const { enablePush } = await import('~~/worker/watch/push')
    expect(await enablePush(REGISTRATION)).toBe(true)

    const sent = calls.find((call) => call.url.endsWith('/v1/watch/subscribe'))
    expect(sent?.body).toEqual({
      subscription: REGISTRATION,
      dealers: expect.arrayContaining(['plattenladen', 'vinylkeller']),
    })
  })

  /*
   * The one that earns the file.
   *
   * The hub stores the list that arrives and replaces what it had. A shop
   * added after the permission was granted therefore reaches nobody unless the
   * list is sent again — and the failure is invisible: the app shows the shop
   * as watched, and the notification simply never comes.
   */
  it('sends the list again after a shop is added', async () => {
    await updatePreferences({ hubUrl: 'https://hub.example' })
    await watching('plattenladen')
    const calls = hub()

    const { enablePush, syncPush } = await import('~~/worker/watch/push')
    await enablePush(REGISTRATION)

    await watching('spätshop')
    await syncPush()

    const sent = calls.filter((call) => call.url.endsWith('/v1/watch/subscribe'))
    expect(sent).toHaveLength(2)
    expect((sent[1]?.body as { dealers: string[] }).dealers).toContain('spätshop')
  })

  it('sends nothing while this device is not registered', async () => {
    await updatePreferences({ hubUrl: 'https://hub.example' })
    await watching('plattenladen')
    const calls = hub()

    const { syncPush } = await import('~~/worker/watch/push')
    expect(await syncPush()).toBe(false)
    expect(calls).toHaveLength(0)
  })

  /*
   * Off means off, even when the hub is not there to be told.
   *
   * A row that survives a failed unsubscribe is a switch that says "on" for
   * notifications somebody asked to stop. The hub drops an address by itself
   * as soon as the push service reports it gone.
   */
  it('forgets this device even when the hub cannot be reached', async () => {
    await updatePreferences({ hubUrl: 'https://hub.example' })
    hub()

    const { enablePush, disablePush } = await import('~~/worker/watch/push')
    await enablePush(REGISTRATION)

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('hub is off')
      }),
    )
    await disablePush()

    expect(await getMeta('pushRegistration')).toBeUndefined()
  })
})
