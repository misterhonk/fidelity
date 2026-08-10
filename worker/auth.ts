import { getMeta, setMeta } from '~~/db/meta'
import { deleteFidelityDb } from '~~/db/open'
import type { Identity } from '#shared/types'

import { DiscogsClient } from './discogs/client'
import {
  ANONYMOUS_REQUEST_INTERVAL_MS,
  createPacer,
  MIN_REQUEST_INTERVAL_MS,
} from './discogs/pacer'
import { identitySchema, userProfileSchema } from './discogs/schemas'
import { forgetSecrets, registerSecret } from './log'

/**
 * The client used for everything after sign-in. It reads the token per request
 * rather than holding it, so signing out takes effect on the very next call
 * instead of whenever something happens to recreate the client.
 */
let shared: DiscogsClient | undefined

/**
 * Whether the last request went out with a token.
 *
 * The pacer needs the answer synchronously and the token lives in IndexedDB,
 * so it is remembered as each request reads it. It starts false: before the
 * first read the honest assumption is the stricter budget, and the demo runs
 * without a token by design.
 */
let authenticated = false

export function discogs(): DiscogsClient {
  shared ??= new DiscogsClient({
    getToken: async () => {
      const token = await getMeta('token')
      registerSecret(token)
      authenticated = Boolean(token)
      return token ?? null
    },
    /*
     * The gap between requests belongs to the whole browser, not to this tab.
     * Discogs counts per IP, so two open tabs pacing themselves perfectly
     * still send twice as often as either believes — which is what the 429s
     * were. Backed by IndexedDB so every tab reads the same last slot.
     */
    pacer: createPacer({
      /*
       * 60 requests a minute with a token, 25 without — measured, not assumed
       * (docs/02). The token-less demo at the signed-in pace would trip the
       * limit on its own.
       */
      minIntervalMs: () =>
        authenticated ? MIN_REQUEST_INTERVAL_MS : ANONYMOUS_REQUEST_INTERVAL_MS,
      slotClock: {
        read: async () => (await getMeta('lastRequestAt')) ?? Number.NEGATIVE_INFINITY,
        write: (startedAt) => setMeta('lastRequestAt', startedAt),
      },
    }),
  })
  return shared
}

/**
 * Validates a token and, only if it works, stores it.
 *
 * Two requests: /oauth/identity is the cheapest proof that the token is real,
 * /users/{username} adds the avatar. Nothing is written before both succeed —
 * a rejected token must not leave a half-signed-in state behind.
 */
export async function signIn(token: string): Promise<Identity> {
  const trimmed = token.trim()
  if (trimmed.length === 0) {
    throw new Error('Kein Token eingegeben.')
  }
  registerSecret(trimmed)

  const probe = new DiscogsClient({ getToken: () => trimmed })
  const identity = await probe.get('/oauth/identity', identitySchema)
  const profile = await probe.get(
    `/users/${encodeURIComponent(identity.username)}`,
    userProfileSchema,
  )

  const stored: Identity = {
    userId: identity.id,
    username: identity.username,
    avatarUrl: profile.avatar_url ?? '',
  }

  await setMeta('token', trimmed)
  await setMeta('identity', stored)
  await requestPersistence()
  return stored
}

/**
 * Asks the browser not to evict us.
 *
 * WebKit clears site data after roughly seven days of inactivity, which would
 * silently take the token and the whole horizon with it — thirteen minutes of
 * expansion, gone, and the user has no idea why they are signed out. Installed
 * home-screen apps are exempt, but this costs one call and covers the rest.
 *
 * Best effort by definition: browsers grant it on their own heuristics, and a
 * refusal is not an error.
 */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export async function currentIdentity(): Promise<Identity | null> {
  const [token, identity] = await Promise.all([getMeta('token'), getMeta('identity')])
  // Either half alone is a broken state, not a signed-in one.
  return token && identity ? identity : null
}

/**
 * Signing out deletes the whole database, not just the token. Everything in it
 * is reproducible from the API, so this costs a resync and nothing else — and
 * it is the only version of "sign out" that is actually true.
 */
export async function signOut(): Promise<void> {
  await deleteFidelityDb()
  forgetSecrets()
  shared = undefined
}
