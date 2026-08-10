import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * Der Reiter und die Überschrift sagen dasselbe.
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

const nav = readFileSync(NAV, 'utf8')
// `\s*` rather than a space: prettier breaks the longer entries across lines,
// and a regex that only reads the short ones silently skips half the nav.
const sections = [...nav.matchAll(/to: '([^']+)',\s*label: '([^']+)'/g)].map((match) => ({
  to: match[1]!,
  label: match[2]!,
}))

describe('what the nav promises', () => {
  it('names five sections', () => {
    expect(sections.map((section) => section.label)).toEqual([
      'Start',
      'Graben',
      'Korb',
      'Sammlung',
      'Läden',
    ])
  })

  it.each(sections)('$label leads to a page that calls itself that', ({ to, label }) => {
    const page = PAGES[to]
    expect(page, `keine Seite für ${to} hinterlegt`).toBeDefined()

    const headings = [...readFileSync(page!, 'utf8').matchAll(/<h1[^>]*>([^<]+)<\/h1>/g)].map(
      (match) => match[1]!.trim(),
    )

    /*
     * Any h1, not the first: the start page has two — the wordmark for
     * somebody signed out, who is being introduced to a product rather than
     * navigating a section, and the section name for everybody else.
     */
    expect(headings).toContain(label)
  })
})
