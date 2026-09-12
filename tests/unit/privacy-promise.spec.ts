import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { packs } from '~/i18n/legal'

/**
 * The privacy notice has to name every place data can go.
 *
 * This is not a style rule. On 2026-09-11 the notice still said "Fidelity has
 * no server" and "only to api.discogs.com and i.discogs.com" — three commits
 * after sharing a find list had started sending a sealed dig to the hub. The
 * sentence had been true when it was written and nobody went back to it,
 * because nothing made them.
 *
 * **Two rules, and only the second is about words.** The first is structural:
 * a destination in the code has a section in the pack, and every section in
 * the pack is rendered by the page. The second is the handful of sentences
 * whose *absence* would make the notice misleading — kept small, and kept
 * because `tests/unit/vault-file.spec.ts` is right that pinning prose couples
 * a test to a phrasing. A required sentence is the exception it names: what is
 * being guarded here is the disclosure itself, not how it reads.
 */
const PAGE = readFileSync('app/pages/privacy.vue', 'utf8')
const HUB = readFileSync('worker/hub/client.ts', 'utf8')
const CATALOGUE = readFileSync('worker/catalogue/client.ts', 'utf8')

/** Every `…Body` in the pack is a destination with something to disclose. */
const BODIES = Object.keys(packs.en.privacy).filter((key) => key.endsWith('Body'))

describe('the privacy notice', () => {
  /**
   * The premise, checked rather than assumed.
   *
   * If the hub client ever stops sending anything, this whole guard is
   * pointless and should go — but then it should go deliberately, with this
   * line failing first and somebody reading why.
   */
  it('is about a hub that data actually goes to', () => {
    expect(HUB).toMatch(/shareWrite/)
    expect(HUB).toMatch(/watchSubscribe/)
    expect(HUB).toMatch(/method: 'POST'/)
  })

  /**
   * Structure, not indentation.
   *
   * The version before this counted `^\s{4}hubBody:$` in the file text, which
   * asserted how deep the key is nested and that prettier had wrapped the
   * value onto its own line. Reading the pack asks the question that was meant
   * instead — and the German half comes with it, because `messages.spec.ts`
   * holds both packs to the same keys.
   */
  it('gives the hub and the web host a section of their own', () => {
    expect(BODIES).toContain('hubBody')
    expect(BODIES).toContain('hostingBody')
  })

  /**
   * The catalogue slipped past this guard for six phases of M21.
   *
   * It watched one file, and the catalogue client is another one: a second
   * address somebody types in, a second server that sees what is looked up,
   * and until M25 not a word about it on the page. Same shape of mistake as
   * the hub in September, one directory over.
   */
  it('is about a catalogue that lookups actually go to', () => {
    expect(CATALOGUE).toMatch(/identify/)
    expect(CATALOGUE).toMatch(/x-fidelity-key/)
    expect(BODIES).toContain('catalogueBody')
  })

  /**
   * The key is the one thing sent that stands for a person.
   *
   * Both clients attach it, so the notice says so once, next to the sentence
   * that it is not the Discogs account — the confusion a reader would most
   * plausibly have.
   */
  it('says the access key travels, and what it is not', () => {
    expect(HUB).toMatch(/x-fidelity-key/)
    expect(BODIES).toContain('accessBody')
    for (const pack of [packs.en.privacy.accessBody, packs.de.privacy.accessBody]) {
      expect(pack).toMatch(/hub/i)
      expect(pack).toMatch(/catalogue|Katalog/)
      expect(pack).toMatch(/not for a Discogs account|nicht für ein Discogs-Konto/)
    }
  })

  it('renders every section it declares', () => {
    for (const body of BODIES) {
      const heading = body.replace(/Body$/, '')
      expect(PAGE, body).toContain(`l.privacy.${body}`)
      expect(PAGE, heading).toContain(`l.privacy.${heading}`)
    }
  })

  /**
   * And the other direction, which is the one that fails silently.
   *
   * A key removed from the pack leaves the page rendering `undefined` — an
   * empty heading where a disclosure used to be, and nothing anywhere says so.
   * Checked one way only, this guard let exactly that through.
   */
  it('declares every section it renders', () => {
    const used = [...PAGE.matchAll(/l\.privacy\.(\w+)/g)].map(([, key]) => key!)
    const known = Object.keys(packs.en.privacy)
    expect([...new Set(used)].filter((key) => !known.includes(key))).toEqual([])
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
    for (const hub of [packs.en.privacy.hubBody, packs.de.privacy.hubBody]) {
      expect(hub).toMatch(/sealed|versiegelt/)
      expect(hub).toMatch(/plain sight|Klartext/)
      expect(hub).toMatch(/token/i)
    }
  })

  /** The host writes logs whether or not anybody says so. */
  it('says the web host logs requests', () => {
    expect(packs.en.privacy.hostingBody).toMatch(/logs the requests/)
    expect(packs.de.privacy.hostingBody).toMatch(/protokolliert/)
  })

  /**
   * The one sentence that must stay gone.
   *
   * "There is nowhere your data could be processed" made the rest of the page
   * unnecessary to read. A forbidden sentence is legitimately about its
   * wording — unlike a required one — so this is the prose assertion that
   * earns its coupling.
   */
  it('does not claim data can go nowhere', () => {
    expect(packs.en.privacy.lead).not.toMatch(/nowhere your data could be processed/)
    expect(packs.de.privacy.lead).not.toMatch(/keine Stelle, an der deine Daten verarbeitet/)
  })
})
