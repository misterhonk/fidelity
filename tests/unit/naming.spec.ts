import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import de from '~/i18n/de'
import en from '~/i18n/en'

/**
 * The tab and the heading say the same thing.
 *
 * Every one of the five sections used to disagree with its own tab: "Läden"
 * led to a page headed "The Clerk's Take", "Sammlung" to "Dein Regal",
 * "Start" to "Championship". Tapping a label and landing somewhere that calls
 * itself something else leaves you unable to tell whether you got there.
 *
 * Two of those were references rather than labels — the shop in the novel and
 * the clerk behind its counter. They read as names to whoever picked them and
 * as nothing at all to everybody else. The codenames stay in docs/, where the
 * feature they describe is being discussed rather than used.
 *
 * Since ADR-010 the label lives in the message packs, so the check reads it
 * from there. It also has a second job now: the five headings have to be in
 * **one** language. Halfway through the translation the nav says "Basket" and
 * the page still says "Korb", and a test that accepted a match in any language
 * would call that fine. Requiring all five to agree on the same pack means the
 * suite goes green again only when the last of them has moved.
 */

const NAV = 'app/components/AppNav.vue'

/** Which file serves a route. Only the five sections the nav bar names. */
const PAGES: Record<string, string> = {
  '/': 'app/pages/index.vue',
  '/dig': 'app/pages/dig.vue',
  '/korb': 'app/pages/korb.vue',
  '/regal': 'app/pages/regal.vue',
  '/haendler': 'app/pages/haendler.vue',
}

const PACKS = { en, de }

const nav = readFileSync(NAV, 'utf8')
// `\s*` rather than a space: prettier breaks the longer entries across lines,
// and a regex that only reads the short ones silently skips half the nav.
const sections = [...nav.matchAll(/to: '([^']+)',\s*key: '([^']+)'/g)].map((match) => ({
  to: match[1]!,
  key: match[2]! as keyof typeof en.nav,
}))

/** Any h1, in the file that serves this route. */
function headings(to: string): string[] {
  const page = PAGES[to]
  expect(page, `no page recorded for ${to}`).toBeDefined()
  return [...readFileSync(page!, 'utf8').matchAll(/<h1[^>]*>([^<]+)<\/h1>/g)].map((match) =>
    match[1]!.trim(),
  )
}

function label(pack: typeof en, key: keyof typeof en.nav): string {
  const entry = pack.nav[key]
  return typeof entry === 'object' ? entry.label : String(entry)
}

describe('what the nav promises', () => {
  it('names five sections', () => {
    expect(sections.map((section) => section.key)).toEqual([
      'start',
      'dig',
      'basket',
      'shelf',
      'dealers',
    ])
  })

  it.each(sections)('$key leads to a page that calls itself that', ({ to, key }) => {
    /*
     * Any h1, not the first: the start page has two — the wordmark for
     * somebody signed out, who is being introduced to a product rather than
     * navigating a section, and the section name for everybody else.
     */
    const found = headings(to)
    const names = Object.values(PACKS).map((pack) => label(pack, key))
    expect(
      names.some((name) => found.includes(name)),
      `${found.join(' / ')} is none of ${names.join(' / ')}`,
    ).toBe(true)
  })

  it('has all five headings in one language', () => {
    const agreeing = Object.entries(PACKS).filter(([, pack]) =>
      sections.every(({ to, key }) => headings(to).includes(label(pack, key))),
    )

    expect(
      agreeing.length,
      'the five section headings are in more than one language',
    ).toBeGreaterThan(0)
  })
})
