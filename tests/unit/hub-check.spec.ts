import { afterEach, describe, expect, it, vi } from 'vitest'

import { handlers } from '~~/worker/handlers'

/**
 * "Verbindung testen" has to try the secret at a door that is actually locked.
 *
 * Health is open by design, so a wrong word still reads "reachable · secured".
 * Measured on a phone on 2026-09-12: the status line was green while every
 * horizon request came back 401. The cover route answers 200 to the right
 * word and 401 to a wrong one — that is the knock.
 */
function hub(secured: boolean, accepts: string | null) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith('/v1/health')) {
      return new Response(JSON.stringify({ ok: true, horizon: 3, shipping: 0, secured }), {
        status: 200,
      })
    }
    const word = new Headers(init?.headers).get('x-hub-secret')
    if (accepts !== null && word !== accepts) return new Response('{}', { status: 401 })
    return new Response(JSON.stringify({ covers: {} }), { status: 200 })
  })
}

const check = (secret?: string) =>
  handlers['hub.check']({ url: 'https://hub.test', secret }, {} as never)

afterEach(() => vi.unstubAllGlobals())

describe('testing the hub connection', () => {
  it('says the secret opens the door when it does', async () => {
    vi.stubGlobal('fetch', hub(true, 'wort'))
    expect(await check('wort')).toMatchObject({ ok: true, secured: true, secret: 'ok' })
  })

  it('says the hub refuses the word when it does — "reachable" was not enough', async () => {
    vi.stubGlobal('fetch', hub(true, 'wort'))
    expect(await check('falsch')).toMatchObject({ secured: true, secret: 'wrong' })
  })

  it('says a secured hub without a word is missing one', async () => {
    const fetchMock = hub(true, 'wort')
    vi.stubGlobal('fetch', fetchMock)
    expect(await check()).toMatchObject({ secured: true, secret: 'missing' })
    // And knocks nowhere: health is the only request.
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('checks nothing on an open hub', async () => {
    const fetchMock = hub(false, null)
    vi.stubGlobal('fetch', fetchMock)
    expect(await check('irgendwas')).toMatchObject({ secured: false, secret: 'unchecked' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

/**
 * The second door (M22): a hub that names `key` among its doors has the key
 * tried there too, and the verdict stands beside the secret's.
 */
describe('the access key at the door', () => {
  function keyedHub(accepts: string) {
    return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/v1/health')) {
        return new Response(
          JSON.stringify({ ok: true, horizon: 1, shipping: 0, secured: true, doors: ['key'] }),
          { status: 200 },
        )
      }
      const key = new Headers(init?.headers).get('x-fidelity-key')
      if (key !== accepts) return new Response('{}', { status: 401 })
      return new Response(JSON.stringify({ covers: {} }), { status: 200 })
    })
  }
  const checkWith = (accessKey?: string) =>
    handlers['hub.check']({ url: 'https://hub.test', accessKey }, {} as never)

  it('says the key opens it', async () => {
    vi.stubGlobal('fetch', keyedHub('fk1.good'))
    expect(await checkWith('fk1.good')).toMatchObject({ doors: ['key'], key: 'ok' })
  })

  it('says the hub refuses the key, and that one is missing', async () => {
    vi.stubGlobal('fetch', keyedHub('fk1.good'))
    expect(await checkWith('fk1.bad')).toMatchObject({ key: 'wrong' })
    expect(await checkWith()).toMatchObject({ key: 'missing' })
  })

  it('checks no key on a hub without that door — an older hub reads as before', async () => {
    vi.stubGlobal('fetch', hub(true, 'wort'))
    expect(await checkWith('fk1.good')).toMatchObject({ doors: [], key: 'unchecked' })
  })
})
