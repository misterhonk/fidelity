import { readFileSync } from 'node:fs'

import { beforeEach, describe, expect, it } from 'vitest'

import { openFidelityDb } from '~~/db/open'
import {
  ASK_AFTER_MS,
  awaitingArrival,
  gradingFor,
  MIN_FOR_RATE,
  recordArrival,
} from '~~/worker/grading'
import type { Feedback } from '#shared/types'

/**
 * Does this shop grade honestly? (M14)
 *
 * The gap Discogs structurally cannot close: feedback there measures "quality
 * of transaction" and says nothing about grading accuracy; negative ratings
 * for overgrading are removed on the seller's complaint.
 *
 * **The design hangs on one promise, and it is in the last block:** the
 * promised grade is stored nowhere. It would be Discogs content, and
 * `docs/09` §1.1 forbids showing that after six hours. A *comparison*, by
 * contrast, is derived and may stay.
 */
const purchase = (
  listingId: number,
  dealer: string,
  over: Partial<Feedback> = {},
): Feedback => ({
  listingId,
  releaseId: listingId * 10,
  dealer,
  artist: 'Probe',
  title: 'Platte',
  verdict: 'bought',
  signals: [],
  score: 80,
  createdAt: 1_700_000_000_000 + listingId,
  updatedAt: 1_700_000_000_000 + listingId,
  ...over,
})

beforeEach(async () => {
  const db = await openFidelityDb()
  await db.clear('feedback')
})

describe('a shop’s record', () => {
  it('counts what arrived as described', async () => {
    const db = await openFidelityDb()
    for (const [id, arrived] of [
      [1, 'as-described'],
      [2, 'as-described'],
      [3, 'better'],
      [4, 'as-described'],
      [5, 'worse'],
    ] as const) {
      await db.put('feedback', purchase(id, 'plattenkiste', { arrived }))
    }

    const record = await gradingFor('plattenkiste')
    expect(record.judged).toBe(5)
    expect(record.asDescribed).toBe(3)
    expect(record.worse).toBe(1)
    // "Better than described" counts as honest too: anyone understating has
    // disappointed nobody.
    expect(record.rate).toBeCloseTo(4 / 5)
  })

  /**
   * Two out of two is a hundred per cent — and that reads like a verdict on a
   * shop one knows nothing about.
   */
  it('gives no rate until there is something to rate', async () => {
    const db = await openFidelityDb()
    for (let id = 1; id < MIN_FOR_RATE; id += 1) {
      await db.put('feedback', purchase(id, 'klein', { arrived: 'as-described' }))
    }

    const record = await gradingFor('klein')
    expect(record.judged).toBe(MIN_FOR_RATE - 1)
    expect(record.rate).toBeNull()
  })

  it('keeps shops apart', async () => {
    const db = await openFidelityDb()
    await db.put('feedback', purchase(1, 'a', { arrived: 'worse' }))
    await db.put('feedback', purchase(2, 'b', { arrived: 'as-described' }))

    expect((await gradingFor('a')).worse).toBe(1)
    expect((await gradingFor('b')).worse).toBe(0)
  })

  it('ignores a purchase nobody has judged yet', async () => {
    const db = await openFidelityDb()
    await db.put('feedback', purchase(1, 'a'))
    expect((await gradingFor('a')).judged).toBe(0)
  })
})

describe('the open question', () => {
  it('lists what was bought and not yet judged', async () => {
    const db = await openFidelityDb()
    await db.put('feedback', purchase(1, 'a'))
    await db.put('feedback', purchase(2, 'a', { arrived: 'as-described' }))
    // A thumb is not a purchase — nothing is waiting here.
    await db.put('feedback', purchase(3, 'a', { verdict: 'interesting' }))

    const offen = await awaitingArrival()
    expect(offen.map((o) => o.listingId)).toEqual([1])
  })

  it('takes the judgement back if it was a slip', async () => {
    const db = await openFidelityDb()
    await db.put('feedback', purchase(1, 'a', { arrived: 'worse' }))

    await recordArrival(1, null)
    expect((await gradingFor('a')).judged).toBe(0)
    expect((await awaitingArrival()).map((o) => o.listingId)).toEqual([1])

    // And the timestamp goes with it. A date for a verdict that does not exist
    // later reads as "judged on" — and is wrong then.
    expect((await db.get('feedback', 1))?.arrivedAt).toBeNull()
  })

  /**
   * And not on the evening of the purchase.
   *
   * A tick at "bought" means ordered. The question of how the record arrived
   * has no answer that day — and a question with no answer teaches somebody to
   * read past it.
   */
  /**
   * And the bound is a waiting time, not a formality.
   *
   * The test below measures against `ASK_AFTER_MS` itself and therefore holds
   * at zero too — a mutation probe showed exactly that. It proves the bound is
   * *kept*; that it is a bound at all is stated here.
   *
   * A range rather than a number: ten days is a judgement and may change.
   * "Somewhere between a week and two months" is the statement that really
   * stands behind it.
   */
  it('waits a span that matches how long post takes', () => {
    const tag = 24 * 60 * 60 * 1000
    expect(ASK_AFTER_MS).toBeGreaterThanOrEqual(7 * tag)
    expect(ASK_AFTER_MS).toBeLessThanOrEqual(60 * tag)
  })

  it('waits until the post could plausibly have been', async () => {
    const db = await openFidelityDb()
    const jetzt = 1_800_000_000_000
    await db.put('feedback', purchase(1, 'a', { createdAt: jetzt - ASK_AFTER_MS + 1000 }))
    await db.put('feedback', purchase(2, 'a', { createdAt: jetzt - ASK_AFTER_MS }))

    expect((await awaitingArrival(jetzt)).map((o) => o.listingId)).toEqual([2])
  })

  it('says nothing about a listing it does not know', async () => {
    await recordArrival(999, 'worse')
    expect((await gradingFor('a')).judged).toBe(0)
  })
})

/**
 * And the promise without which this design would not be permitted.
 */
describe('what is never stored', () => {
  /**
   * **The promised grade.**
   *
   * It would be Discogs content, and `docs/09` §1.1 forbids showing that when
   * it is more than six hours older than what is at Discogs. A *comparison* is
   * derived — the same category as scores and the dealer fingerprint, and
   * those are explicitly allowed to stay.
   *
   * The obvious convenience would be to write `match.condition` down on
   * purchase and put it beside the verdict later. That is exactly what must
   * not happen.
   */
  it('never keeps the condition a seller claimed', () => {
    const types = readFileSync('shared/types.ts', 'utf8')
    const feedback = types.slice(types.indexOf('export interface Feedback {'))
    const body = feedback.slice(0, feedback.indexOf('\n}'))

    expect(body).not.toMatch(/\bcondition\b/)
    expect(body).not.toMatch(/\bsleeve\b/)
    expect(body).toMatch(/arrived\?:/)

    const worker = readFileSync('worker/grading.ts', 'utf8')
    expect(worker).not.toMatch(/condition|sleeve|Mint|VG\+/)
  })

  /**
   * And the question does not name it either.
   *
   * The worker stores no grade — an interface that nonetheless writes "you
   * were promised VG+" would have fetched it from the marketplace and would
   * show it for as long as it liked. The vocabulary is checked, not the
   * screen: `tests/unit/template-text.spec.ts` forbids prose in templates, so
   * a sentence like that **must** pass through this block. Both languages,
   * because a translation is a second place it can appear.
   */
  it('asks without naming the grade that was promised', () => {
    const i18n = readFileSync('app/i18n/basket.ts', 'utf8')

    const blocks = [...i18n.matchAll(/arrival: \{([\s\S]*?)\n {4}\},/g)].map(
      (match) => match[1]!,
    )
    expect(blocks).toHaveLength(2)

    /*
     * What is forbidden is the **grades**, not the word "grade".
     *
     * The first attempt banned `grade` and `Note` altogether — and fell
     * immediately over the sentence explaining why this exists: "Discogs
     * feedback rates the process, not the accuracy of the grade". A test that
     * forbids a feature's justification is checking the wrong thing. What may
     * not reach the screen is a concrete value — that would come from the
     * listing.
     */
    for (const block of blocks) {
      expect(block).not.toMatch(/\bMint\b|\bNM\b|\bVG\+?\b|\bGood \(G\)|\bPoor \(P\)/)
      expect(block).not.toMatch(/\bcondition\b|\bsleeve\b|\bMedia:|\bSleeve:/)
    }

    // And the screen that asks holds to it too.
    const screen = readFileSync('app/components/ArrivalQuestion.vue', 'utf8')
    expect(screen).not.toMatch(/condition|sleeve|Mint|VG\+/)
  })

  /** And it goes nowhere — no pillory, no rating of somebody else. */
  it('stays on this device', () => {
    const worker = readFileSync('worker/grading.ts', 'utf8')
    expect(worker).not.toMatch(/fetch\(|hub|DiscogsClient|discogs\.com/i)
  })
})
