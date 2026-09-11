import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * The privacy notice has to name every place data can go.
 *
 * This is not a style rule. On 2026-09-11 the notice still said "Fidelity has
 * no server" and "only to api.discogs.com and i.discogs.com" — three commits
 * after sharing a find list had started sending a sealed dig to the hub. The
 * sentence had been true when it was written and nobody went back to it,
 * because nothing made them.
 *
 * So the test is the thing that makes them: a destination in the code, a
 * heading on the page. The audio preview has had exactly this guard since
 * ADR-012 (`audio-preview.spec.ts`); it was the missing second copy that let
 * the hub through.
 */
const LEGAL = readFileSync('app/i18n/legal.ts', 'utf8')
const PAGE = readFileSync('app/pages/privacy.vue', 'utf8')
const HUB = readFileSync('worker/hub/client.ts', 'utf8')

/** Both language packs carry the same keys, so every key appears twice. */
const BOTH = 2

function keyCount(key: string) {
  return [...LEGAL.matchAll(new RegExp(`^\\s{4}${key}:$`, 'gm'))].length
}

describe('the hub is named', () => {
  /**
   * The premise, checked rather than assumed.
   *
   * If the hub client ever stops sending anything, this whole guard is
   * pointless and should go — but then it should go deliberately, with this
   * line failing first and somebody reading why.
   */
  it('is something data actually goes to', () => {
    expect(HUB).toMatch(/shareWrite/)
    expect(HUB).toMatch(/watchSubscribe/)
    expect(HUB).toMatch(/method: 'POST'/)
  })

  it('has a heading of its own, in both languages', () => {
    expect(keyCount('hubBody')).toBe(BOTH)
    expect(PAGE).toMatch(/l\.privacy\.hub\b/)
    expect(PAGE).toMatch(/l\.privacy\.hubBody/)
  })

  /**
   * And says which half is sealed and which half is not.
   *
   * "Encrypted" alone would be the flattering half of the truth: the backup
   * and the shared dig are sealed, the watched dealers and the push address
   * are not. A notice that mentions only the first is worse than one that
   * mentions neither, because it sounds like an answer.
   */
  it('separates what the hub can read from what it cannot', () => {
    expect(LEGAL).toMatch(/sealed, so the hub holds them and cannot read them/)
    expect(LEGAL).toMatch(/versiegelt dorthin, der Hub hält sie und kann sie nicht lesen/)

    expect(LEGAL).toMatch(/in plain sight is the dealers you are watching/)
    expect(LEGAL).toMatch(/Im Klartext sieht er die Händler, die du beobachtest/)
  })

  /** Rule 6 in CLAUDE.md, stated where a user can read it. */
  it('says the token is not among it', () => {
    expect(LEGAL).toMatch(/Discogs token is never among it/)
    expect(LEGAL).toMatch(/Discogs-Token ist nie dabei/)
  })
})

describe('the web host is named', () => {
  it('has a heading of its own, in both languages', () => {
    expect(keyCount('hostingBody')).toBe(BOTH)
    expect(PAGE).toMatch(/l\.privacy\.hosting\b/)
    expect(PAGE).toMatch(/l\.privacy\.hostingBody/)
  })

  it('says the host logs requests', () => {
    expect(LEGAL).toMatch(/logs the requests it answers/)
    expect(LEGAL).toMatch(/protokolliert er die Anfragen/)
  })
})

/**
 * The lead may no longer promise more than the sections below deliver.
 *
 * "There is nowhere your data could be processed" was the sentence that made
 * the rest of the page unnecessary to read. It is gone, and it should not come
 * back by someone tidying the opening paragraph.
 */
describe('the opening paragraph', () => {
  it('does not claim data can go nowhere', () => {
    expect(LEGAL).not.toMatch(/nowhere your data could be processed/)
    expect(LEGAL).not.toMatch(/keine Stelle, an der deine Daten verarbeitet werden/)
  })

  it('says how many exceptions there are, and both are numbered below', () => {
    expect(keyCount('audioBody')).toBe(BOTH)
    expect(LEGAL).toMatch(/The first exception/)
    expect(LEGAL).toMatch(/The second exception/)
    expect(LEGAL).toMatch(/Die erste Ausnahme/)
    expect(LEGAL).toMatch(/Die zweite Ausnahme/)
  })
})
