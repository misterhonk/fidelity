import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { openHubDb } from '../src/db.ts'
import {
  POLL_SPACING_IDENTIFIED_MS,
  POLL_SPACING_MS,
  USER_AGENT,
  watchRound,
} from '../src/watch.ts'

/**
 * The watcher — and above all: when it keeps quiet.
 *
 * It is the only place in the whole hub that sends anything to a device of its
 * own accord. A notification that should not have come is therefore more
 * expensive than one that does not arrive: it rings at night on the phone of
 * somebody who never asked for it.
 */
function setup(dealers = ['fatplastics']) {
  const db = openHubDb(':memory:')
  db.prepare(
    `INSERT INTO watchers (endpoint, p256dh, auth, created_at, updated_at)
     VALUES ('https://push.test/abc', 'p', 'a', 1, 1)`,
  ).run()
  for (const dealer of dealers) {
    db.prepare('INSERT INTO watches (endpoint, dealer) VALUES (?, ?)').run(
      'https://push.test/abc',
      dealer,
    )
  }
  return db
}

const answering = (counts: Record<string, number>) =>
  ((url: string) => {
    const name = decodeURIComponent(String(url).split('/users/')[1] ?? '')
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ num_for_sale: counts[name] }),
    } as unknown as Response)
  }) as unknown as typeof fetch

const nothing = async () => {}

/*
 * The watcher says who it is.
 *
 * Discogs answers a request with no User-Agent with a 403 (measured
 * 2026-08-13 against the real endpoint). Node's own default gets through
 * today, but it says "node" — and the failure would be the quietest
 * imaginable: an answer that is not `ok` is swallowed (`continue`), and the
 * watcher would look forever like a shop that never moves.
 */
test('tells Discogs its name', async () => {
  const db = setup()
  db.prepare("INSERT INTO watches (endpoint, dealer) VALUES ('e1', 'fatplastics')").run()

  const seen: (HeadersInit | undefined)[] = []
  const noting = ((url: string, init?: RequestInit) => {
    seen.push(init?.headers)
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ num_for_sale: 10 }),
    } as unknown as Response)
  }) as unknown as typeof fetch

  await watchRound({ db, fetchImpl: noting, sleep: nothing })

  assert.equal(seen.length, 1)
  assert.equal((seen[0] as Record<string, string>)['user-agent'], USER_AGENT)
})

/**
 * The credentials where there are some — and none invented where there are
 * not.
 *
 * They raise the limit from 25 to 60 requests a minute, and that is exactly
 * why the pace hangs off them: anyone removing the header and leaving the
 * 1,200 ms in place builds a hub that breaks its own limit.
 */
describe('the Discogs credentials', () => {
  const noting = (seen: RequestInit[]) =>
    ((url: string, init?: RequestInit) => {
      seen.push(init ?? {})
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ num_for_sale: 10 }),
      } as unknown as Response)
    }) as unknown as typeof fetch

  test('go out as a header, never in the address', async () => {
    const db = setup()
    db.prepare("INSERT INTO watches (endpoint, dealer) VALUES ('e1', 'fatplastics')").run()

    const seen: RequestInit[] = []
    const urls: string[] = []
    const watching = ((url: string, init?: RequestInit) => {
      urls.push(String(url))
      seen.push(init ?? {})
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ num_for_sale: 10 }),
      } as unknown as Response)
    }) as unknown as typeof fetch

    await watchRound({
      db,
      fetchImpl: watching,
      sleep: nothing,
      identity: { key: 'k123', secret: 's456' },
    })

    const headers = seen[0]?.headers as Record<string, string>
    assert.equal(headers.authorization, 'Discogs key=k123, secret=s456')
    // A secret in a URL lands in every log in between.
    assert.ok(!urls[0]?.includes('s456'))
    assert.ok(!urls[0]?.includes('k123'))
  })

  test('stay away entirely where there are none', async () => {
    const db = setup()
    db.prepare("INSERT INTO watches (endpoint, dealer) VALUES ('e1', 'fatplastics')").run()

    const seen: RequestInit[] = []
    await watchRound({ db, fetchImpl: noting(seen), sleep: nothing })

    const headers = seen[0]?.headers as Record<string, string>
    assert.equal(headers.authorization, undefined)
  })

  test('give the faster pace — and nothing else does', async () => {
    const paused: number[] = []
    const measure = async (ms: number) => {
      paused.push(ms)
    }

    for (const identity of [null, { key: 'k', secret: 's' }]) {
      const db = setup(['a', 'b'])
      db.prepare("INSERT INTO watches (endpoint, dealer) VALUES ('e1', 'a')").run()
      db.prepare("INSERT INTO watches (endpoint, dealer) VALUES ('e1', 'b')").run()
      await watchRound({ db, fetchImpl: noting([]), sleep: measure, identity })
    }

    assert.deepEqual(paused, [POLL_SPACING_MS, POLL_SPACING_IDENTIFIED_MS])
  })
})

describe('the watcher', () => {
  test('says nothing on the first look — that is a baseline', async () => {
    // Otherwise anybody taking on a new shop would immediately be told about
    // two thousand "new" records.
    const db = setup()
    const sent: string[] = []

    const result = await watchRound({
      db,
      fetchImpl: answering({ fatplastics: 2881 }),
      send: async (_s, payload) => {
        sent.push(payload)
        return { statusCode: 201 }
      },
      sleep: nothing,
    })

    assert.equal(result.checked, 1)
    assert.equal(result.changed, 0)
    assert.deepEqual(sent, [])
  })

  test('reports when there is more on the second look', async () => {
    const db = setup()
    const sent: string[] = []
    const send = async (_s: unknown, payload: string) => {
      sent.push(payload)
      return { statusCode: 201 }
    }

    await watchRound({ db, fetchImpl: answering({ fatplastics: 100 }), send, sleep: nothing })
    // The reading is set now; for the second pass it has to be old.
    db.prepare('UPDATE watch_state SET checked_at = 0').run()

    const result = await watchRound({
      db,
      fetchImpl: answering({ fatplastics: 112 }),
      send,
      sleep: nothing,
    })

    assert.equal(result.changed, 1)
    assert.equal(result.notified, 1)
    assert.equal(JSON.parse(sent[0]!).newListings, 12)
  })

  test('stays quiet when a shop has sold records', async () => {
    // Downwards is not news. Nobody wants to hear about that.
    const db = setup()
    const sent: string[] = []
    const send = async (_s: unknown, payload: string) => {
      sent.push(payload)
      return { statusCode: 201 }
    }

    await watchRound({ db, fetchImpl: answering({ fatplastics: 100 }), send, sleep: nothing })
    db.prepare('UPDATE watch_state SET checked_at = 0').run()
    const result = await watchRound({
      db,
      fetchImpl: answering({ fatplastics: 95 }),
      send,
      sleep: nothing,
    })

    assert.equal(result.changed, 0)
    assert.deepEqual(sent, [])
  })

  test('does not touch a shop it has only just checked', async () => {
    const db = setup()
    let calls = 0
    const counting = ((url: string) => {
      calls += 1
      return answering({ fatplastics: 100 })(url as never)
    }) as unknown as typeof fetch

    await watchRound({ db, fetchImpl: counting, sleep: nothing })
    await watchRound({ db, fetchImpl: counting, sleep: nothing })

    assert.equal(calls, 1)
  })

  test('asks a shop once, however many are watching it', async () => {
    // The whole reason this service exists.
    const db = setup()
    for (const n of [1, 2, 3]) {
      db.prepare(
        `INSERT INTO watchers (endpoint, p256dh, auth, created_at, updated_at)
         VALUES (?, 'p', 'a', 1, 1)`,
      ).run(`https://push.test/${n}`)
      db.prepare('INSERT INTO watches (endpoint, dealer) VALUES (?, ?)').run(
        `https://push.test/${n}`,
        'fatplastics',
      )
    }

    let calls = 0
    const counting = ((url: string) => {
      calls += 1
      return answering({ fatplastics: 100 })(url as never)
    }) as unknown as typeof fetch

    await watchRound({ db, fetchImpl: counting, sleep: nothing })
    db.prepare('UPDATE watch_state SET checked_at = 0').run()

    const result = await watchRound({
      db,
      fetchImpl: ((url: string) => {
        calls += 1
        return answering({ fatplastics: 140 })(url as never)
      }) as unknown as typeof fetch,
      send: async () => ({ statusCode: 201 }),
      sleep: nothing,
    })

    assert.equal(calls, 2, 'zwei Durchgänge, ein Laden — nicht vier Empfänger mal zwei')
    assert.equal(result.notified, 4)
  })

  test('throws away a recipient the push service declares dead', async () => {
    const db = setup()
    await watchRound({ db, fetchImpl: answering({ fatplastics: 100 }), sleep: nothing })
    db.prepare('UPDATE watch_state SET checked_at = 0').run()

    const result = await watchRound({
      db,
      fetchImpl: answering({ fatplastics: 150 }),
      send: () => Promise.reject(Object.assign(new Error('gone'), { statusCode: 410 })),
      sleep: nothing,
    })

    assert.equal(result.dropped, 1)
    const left = db.prepare('SELECT COUNT(*) AS n FROM watchers').get() as { n: number }
    assert.equal(left.n, 0)
  })

  /**
   * A silence is counted.
   *
   * The `catch` handled 404 and 410 and did nothing else: no counter, no log.
   * A device nothing ever got through to therefore looked exactly like one
   * that had never watched the shop — `notified` simply came out quieter, and
   * that was all. On 2026-08-13 that exact gap stood between "it rang" and "I
   * saw nothing".
   */
  test('counts a failed delivery instead of swallowing it', async () => {
    const db = setup()
    await watchRound({ db, fetchImpl: answering({ fatplastics: 100 }), sleep: nothing })
    // Without this the hourly bar takes hold and the second pass does not
    // look at all.
    db.prepare('UPDATE watch_state SET checked_at = 0').run()

    const result = await watchRound({
      db,
      fetchImpl: answering({ fatplastics: 150 }),
      sleep: nothing,
      send: () => Promise.reject(Object.assign(new Error('nope'), { statusCode: 403 })),
    })

    assert.equal(result.notified, 0)
    assert.equal(result.failed, 1)
    // Not thrown away: a 403 is not "this device no longer exists".
    assert.equal(result.dropped, 0)
    assert.equal((db.prepare('SELECT COUNT(*) AS n FROM watchers').get() as { n: number }).n, 1)
  })

  test('keeps a recipient whose delivery only fails temporarily', async () => {
    // 500 means "try later", not "that one no longer exists".
    const db = setup()
    await watchRound({ db, fetchImpl: answering({ fatplastics: 100 }), sleep: nothing })
    db.prepare('UPDATE watch_state SET checked_at = 0').run()

    const result = await watchRound({
      db,
      fetchImpl: answering({ fatplastics: 150 }),
      send: () => Promise.reject(Object.assign(new Error('boom'), { statusCode: 500 })),
      sleep: nothing,
    })

    assert.equal(result.dropped, 0)
    const left = db.prepare('SELECT COUNT(*) AS n FROM watchers').get() as { n: number }
    assert.equal(left.n, 1)
  })

  test('skips a shop nobody is watching', async () => {
    const db = openHubDb(':memory:')
    let calls = 0
    await watchRound({
      db,
      fetchImpl: (() => {
        calls += 1
        return Promise.reject(new Error('sollte nicht passieren'))
      }) as unknown as typeof fetch,
      sleep: nothing,
    })
    assert.equal(calls, 0)
  })

  test('survives a shop that does not answer', async () => {
    const db = setup(['fatplastics', 'weg'])
    const result = await watchRound({
      db,
      fetchImpl: ((url: string) =>
        String(url).includes('weg')
          ? Promise.reject(new Error('offline'))
          : answering({ fatplastics: 100 })(url as never)) as unknown as typeof fetch,
      sleep: nothing,
    })

    assert.equal(result.checked, 1, 'der eine gute Laden zählt trotzdem')
  })
})
