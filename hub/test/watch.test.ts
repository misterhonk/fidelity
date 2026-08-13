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
 * Der Wächter — und vor allem: wann er den Mund hält.
 *
 * Er ist die einzige Stelle im ganzen Hub, die von sich aus etwas an ein Gerät
 * schickt. Eine Benachrichtigung, die nicht hätte kommen dürfen, ist deshalb
 * teurer als eine, die ausbleibt: sie klingelt nachts am Telefon von jemandem,
 * der nie darum gebeten hat.
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
 * Der Wächter sagt, wer er ist.
 *
 * Discogs beantwortet eine Anfrage ohne User-Agent mit 403 (2026-08-13 gegen
 * den echten Endpunkt gemessen). Nodes eigener Vorgabewert kommt heute durch,
 * heißt aber „node" — und der Fehlschlag wäre der leiseste denkbare: eine
 * Antwort, die nicht `ok` ist, wird verschluckt (`continue`), und der Wächter
 * sähe für immer aus wie ein Laden, der sich nie bewegt.
 */
test('nennt Discogs seinen Namen', async () => {
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
 * Die Kennung, wenn es eine gibt — und keine erfundene, wenn nicht.
 *
 * Sie hebt das Limit von 25 auf 60 Anfragen pro Minute, und genau deshalb
 * hängt der Takt daran: wer den Kopf wegnimmt und die 1.200 ms stehen lässt,
 * baut einen Hub, der sein eigenes Limit reißt.
 */
describe('die Discogs-Kennung', () => {
  const noting = (seen: RequestInit[]) =>
    ((url: string, init?: RequestInit) => {
      seen.push(init ?? {})
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ num_for_sale: 10 }),
      } as unknown as Response)
    }) as unknown as typeof fetch

  test('geht als Kopf hinaus, nie in die Adresse', async () => {
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
    // Ein Geheimnis in einer URL landet in jedem Protokoll dazwischen.
    assert.ok(!urls[0]?.includes('s456'))
    assert.ok(!urls[0]?.includes('k123'))
  })

  test('bleibt ohne Kennung ganz weg', async () => {
    const db = setup()
    db.prepare("INSERT INTO watches (endpoint, dealer) VALUES ('e1', 'fatplastics')").run()

    const seen: RequestInit[] = []
    await watchRound({ db, fetchImpl: noting(seen), sleep: nothing })

    const headers = seen[0]?.headers as Record<string, string>
    assert.equal(headers.authorization, undefined)
  })

  test('gibt der Kennung das schnellere Tempo — und sonst nicht', async () => {
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

describe('der Wächter', () => {
  test('sagt beim ersten Blick nichts — das ist eine Grundlinie', async () => {
    // Sonst bekäme jeder, der einen Laden neu aufnimmt, sofort eine Meldung
    // über zweitausend "neue" Platten.
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

  test('meldet, wenn beim zweiten Blick mehr da ist', async () => {
    const db = setup()
    const sent: string[] = []
    const send = async (_s: unknown, payload: string) => {
      sent.push(payload)
      return { statusCode: 201 }
    }

    await watchRound({ db, fetchImpl: answering({ fatplastics: 100 }), send, sleep: nothing })
    // Der Stand ist jetzt gesetzt; für den zweiten Durchgang muss er alt sein.
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

  test('schweigt, wenn ein Laden Platten verkauft hat', async () => {
    // Nach unten ist keine Nachricht. Darüber will niemand etwas hören.
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

  test('fasst einen Laden nicht an, den er gerade erst geprüft hat', async () => {
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

  test('fragt einen Laden einmal, egal wie viele ihn beobachten', async () => {
    // Der ganze Grund, warum es diesen Dienst gibt.
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

  test('wirft einen Empfänger weg, den der Push-Dienst für tot erklärt', async () => {
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

  test('behält einen Empfänger, dessen Zustellung nur vorübergehend scheitert', async () => {
    // 500 heißt "später nochmal", nicht "den gibt es nicht mehr".
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

  test('lässt einen Laden aus, den niemand beobachtet', async () => {
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

  test('übersteht einen Laden, der nicht antwortet', async () => {
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
