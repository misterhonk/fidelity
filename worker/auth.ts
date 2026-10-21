import { getMeta, setMeta } from '~~/db/meta'
import { deleteFidelityDb } from '~~/db/open'
import type { Identity } from '#shared/types'

import { DiscogsClient } from './discogs/client'
import {
  ANONYMOUS_REQUEST_INTERVAL_MS,
  createPacer,
  MIN_REQUEST_INTERVAL_MS,
} from './discogs/pacer'
import { forgetSecrets, registerSecret } from './log'
import { fail } from './fail'

/*
 * The two schemas this module needs are fetched when it needs them (docs/12 §2).
 *
 * `auth.ts` is the worker's *entry* — `index.ts` imports `handlers.ts` imports
 * this — so anything it names statically is paid for before the first message
 * is answered. These two named Zod, and Zod was **18.9 kB gzip of the worker's
 * 39.5 kB ceiling**: nearly half of the start-up cost, loaded so that signing
 * in could validate two responses.
 *
 * Both uses sit inside a function that is about to spend two paced Discogs
 * requests — 2.4 seconds — on a deliberate, user-initiated action. A module
 * load in front of that is not a cost anybody can perceive, and it is the
 * difference between Zod being in the worker's start-up or not.
 */
async function discogsSchemas() {
  return import('./discogs/schemas')
}

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

/** The last slot, in IndexedDB so every tab and every client reads the same one. */
const slotClock = {
  read: async () => (await getMeta('lastRequestAt')) ?? Number.NEGATIVE_INFINITY,
  write: (startedAt: number) => setMeta('lastRequestAt', startedAt),
}

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
      slotClock,
    }),
  })
  return shared
}

let anonymous: DiscogsClient | undefined

/**
 * A client that never sends a token, for the look without signing in.
 *
 * The demo used the stored token when there was one — and a token that
 * Discogs had since forgotten turned "No sign-in" into "Discogs does not know
 * this token" (found 2026-10-21). Same lock, same slot, the slower pace.
 */
export function anonymousDiscogs(): DiscogsClient {
  anonymous ??= new DiscogsClient({
    getToken: async () => null,
    pacer: createPacer({ minIntervalMs: () => ANONYMOUS_REQUEST_INTERVAL_MS, slotClock }),
  })
  return anonymous
}

/**
 * A client for a token that is not stored yet: checking it at sign-in or on
 * renewal. On the shared slot too — with a pacer of its own it took the lock
 * but not the gap, and two requests could leave back to back.
 */
function probeClient(token: string): DiscogsClient {
  return new DiscogsClient({
    getToken: () => token,
    pacer: createPacer({ minIntervalMs: () => MIN_REQUEST_INTERVAL_MS, slotClock }),
  })
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
    throw fail('no-token', 'no token given')
  }
  registerSecret(trimmed)

  const { identitySchema, userProfileSchema } = await discogsSchemas()
  const probe = probeClient(trimmed)
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

/**
 * A new token for the same account — nothing else changes.
 *
 * Discogs withdraws tokens, people regenerate them, and until 2026-09-12 the
 * only way to enter a new one was to sign out, which deletes the database:
 * thirteen minutes of horizon, every dig and every rating for a key that
 * took ten seconds to make. Renewing writes the token and the refreshed
 * identity, and that is all — the client reads the token per request, so
 * the next call already uses it.
 *
 * The one thing it refuses is a token for *another* account: the collection
 * on this device is somebody's, and a key that belongs to somebody else must
 * not quietly take it over. That case is a sign-out and a fresh start, said
 * so rather than done silently. With nobody signed in, renewing is signing in.
 */
export async function renewToken(token: string): Promise<Identity> {
  const trimmed = token.trim()
  if (trimmed.length === 0) throw fail('no-token', 'no token given')
  registerSecret(trimmed)

  const { identitySchema, userProfileSchema } = await discogsSchemas()
  const probe = probeClient(trimmed)
  const identity = await probe.get('/oauth/identity', identitySchema)

  const current = await getMeta('identity')
  if (current && current.userId !== identity.id) {
    throw fail(
      'token-other-account',
      `token belongs to ${identity.username}, not to the signed-in account`,
    )
  }

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
  return stored
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
