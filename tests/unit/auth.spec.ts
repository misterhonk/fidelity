import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getMeta, setMeta } from '~~/db/meta'
import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import { currentIdentity, signIn, signOut } from '~~/worker/auth'

/**
 * Sign-in, sign-out, and the token that must not leak.
 *
 * This module was the last one in the worker with no test at all, which is an
 * odd place for that to be true: it is where CLAUDE.md rule 6 lives — the
 * Personal Access Token never leaves IndexedDB.
 */

const realFetch = globalThis.fetch

afterEach(async () => {
  globalThis.fetch = realFetch
  await deleteFidelityDb()
})

function answers(...bodies: unknown[]) {
  const calls: { url: string; auth: string | null }[] = []
  let index = 0

  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    calls.push({ url: String(input), auth: headers.get('authorization') })

    const body = bodies[index++]
    if (body instanceof Error) {
      return new Response(JSON.stringify({ message: body.message }), { status: 401 })
    }
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch

  return calls
}

const IDENTITY = { id: 7, username: 'mrtnmlchr', resource_url: '' }
const PROFILE = { id: 7, username: 'mrtnmlchr', avatar_url: 'https://img/av.png' }

describe('signing in', () => {
  it('refuses an empty token without touching anything', async () => {
    /*
     * The code, not the sentence.
     *
     * The worker has no language — `explain()` turns the code into words on
     * the main thread (`worker/fail.ts`). Asserting the wording here would
     * pin a translation, which is the coupling `vault-file.spec.ts` warns
     * about; asserting the code says which failure this is.
     */
    await expect(signIn('   ')).rejects.toMatchObject({ code: 'no-token' })
    expect(await getMeta('token')).toBeUndefined()
    expect(await getMeta('identity')).toBeUndefined()
  })

  it('writes nothing when Discogs rejects the token', async () => {
    answers(new Error('You must authenticate to access this resource.'))

    await expect(signIn('falsch')).rejects.toThrow()

    /*
     * The claim in the doc comment, held to. A half-signed-in state — a token
     * stored without an identity — is the state `currentIdentity` has to treat
     * as signed out, and the cleanest way to never see it is to never write it.
     */
    expect(await getMeta('token')).toBeUndefined()
    expect(await getMeta('identity')).toBeUndefined()
  })

  it('stores both halves and hands back no token', async () => {
    answers(IDENTITY, PROFILE)

    const identity = await signIn('  geheim  ')

    expect(identity).toEqual({
      userId: 7,
      username: 'mrtnmlchr',
      avatarUrl: 'https://img/av.png',
    })
    // Rule 6: what leaves this function goes to the main thread and onto the
    // screen. The token is not part of it and never becomes part of it.
    expect(JSON.stringify(identity)).not.toContain('geheim')

    // Trimmed on the way in, so a pasted token with a stray newline works.
    expect(await getMeta('token')).toBe('geheim')
  }, 10_000)

  it('sends the token as a header and never in the URL', async () => {
    const calls = answers(IDENTITY, PROFILE)
    await signIn('geheim')

    for (const call of calls) {
      // Rule 6 again, in the place it would actually leak: a query string ends
      // up in proxy logs, in history, in a referrer.
      expect(call.url).not.toContain('geheim')
      expect(call.auth).toBe('Discogs token=geheim')
    }
  }, 10_000)
})

describe('who is signed in', () => {
  beforeEach(async () => {
    await openFidelityDb()
  })

  it('is nobody when only the token survived', async () => {
    await setMeta('token', 'geheim')
    expect(await currentIdentity()).toBeNull()
  })

  it('is nobody when only the identity survived', async () => {
    await setMeta('identity', { userId: 7, username: 'x', avatarUrl: '' })
    expect(await currentIdentity()).toBeNull()
  })

  it('is somebody only when both halves are there', async () => {
    await setMeta('token', 'geheim')
    await setMeta('identity', { userId: 7, username: 'x', avatarUrl: '' })
    expect(await currentIdentity()).not.toBeNull()
  })
})

describe('signing out', () => {
  it('takes the whole database, not only the token', async () => {
    const db = await openFidelityDb()
    await setMeta('token', 'geheim')
    await setMeta('identity', { userId: 7, username: 'x', avatarUrl: '' })
    await db.put('collection', {
      // Keyed by entry since v6 — a fixture needs one of its own.
      instanceId: 901,
      folderId: 1,
      releaseId: 1,
      masterId: 0,
      title: 'Dummy',
      artistNames: ['Portishead'],
      artistNorms: ['portishead'],
      labelNames: [],
      labelNorms: [],
      year: 1994,
      formats: ['Vinyl'],
      rating: 5,
      addedAt: '2020-01-01T00:00:00Z',
    } as never)

    await signOut()

    /*
     * Everything here is reproducible from the API, so this costs a resync and
     * nothing else — and it is the only version of "sign out" that is true.
     * Leaving the collection behind would leave somebody's listening history
     * on a machine they thought they had cleared.
     */
    const fresh = await openFidelityDb()
    expect(await fresh.count('collection')).toBe(0)
    expect(await getMeta('token')).toBeUndefined()
    expect(await currentIdentity()).toBeNull()
  })
})

/**
 * Renewing: a new key, the same database (2026-09-12).
 *
 * A withdrawn token used to cost a sign-out, and a sign-out deletes
 * everything. Now it costs the ten seconds it takes Discogs to make a new
 * one — and nothing on the device moves, which is what these pin.
 */
describe('renewing the token', () => {
  beforeEach(async () => {
    await openFidelityDb()
    await setMeta('token', 'old-token')
    await setMeta('identity', { userId: 7, username: 'mrtnmlchr', avatarUrl: '' })
    await setMeta('lastRequestAt', 4242)
  })

  it('replaces the token for the same account and touches nothing else', async () => {
    const calls = answers(IDENTITY, PROFILE)
    const { renewToken } = await import('~~/worker/auth')

    const identity = await renewToken('new-token')

    expect(identity).toEqual({
      userId: 7,
      username: 'mrtnmlchr',
      avatarUrl: 'https://img/av.png',
    })
    expect(await getMeta('token')).toBe('new-token')
    expect(await getMeta('lastRequestAt')).toBe(4242)
    expect(calls.map((c) => c.auth)).toEqual([
      'Discogs token=new-token',
      'Discogs token=new-token',
    ])
    expect(await currentIdentity()).toMatchObject({ userId: 7 })
  })

  it('refuses a token for another account and keeps the old one', async () => {
    answers({ id: 8, username: 'somebody-else', resource_url: '' }, PROFILE)
    const { renewToken } = await import('~~/worker/auth')

    await expect(renewToken('their-token')).rejects.toMatchObject({
      code: 'token-other-account',
    })
    expect(await getMeta('token')).toBe('old-token')
    expect(await currentIdentity()).toMatchObject({ userId: 7, username: 'mrtnmlchr' })
  })

  it('keeps the old token when Discogs rejects the new one', async () => {
    answers(new Error('nope'))
    const { renewToken } = await import('~~/worker/auth')

    await expect(renewToken('bad-token')).rejects.toMatchObject({ code: 'unauthorized' })
    expect(await getMeta('token')).toBe('old-token')
  })

  it('is a sign-in when nobody is signed in', async () => {
    await deleteFidelityDb()
    await openFidelityDb()
    answers(IDENTITY, PROFILE)
    const { renewToken } = await import('~~/worker/auth')

    await renewToken('first-token')
    expect(await getMeta('token')).toBe('first-token')
    expect(await currentIdentity()).toMatchObject({ userId: 7 })
  })
})
