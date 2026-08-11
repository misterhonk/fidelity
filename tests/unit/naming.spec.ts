import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { packs as basket } from '~/i18n/basket'
import { packs as collection } from '~/i18n/collection'
import de from '~/i18n/de'
import { packs as dealers } from '~/i18n/dealers'
import { packs as dig } from '~/i18n/dig'
import en from '~/i18n/en'

/**
 * The tab and the heading say the same thing.
 *
 * Every one of the five sections used to disagree with its own tab: "Shops"
 * led to a page headed "The Clerk's Take", "Sammlung" to "Dein Regal", "Start"
 * to "Championship". Tapping a label and landing somewhere that calls itself
 * something else leaves you unable to tell whether you got there.
 *
 * Two of those were references rather than labels — the shop in the novel and
 * the clerk behind its counter. They read as names to whoever picked them and
 * as nothing at all to everybody else. The codenames stay in docs/, where the
 * feature they describe is being discussed rather than used.
 *
 * Since the translation both sides are interpolated, so reading the words out
 * of the markup no longer works — the heading is `{{ d.title }}`, not "Dig".
 * What this checks now is one step further back and one step stronger: that the
 * heading names a pack entry, and that the entry it names holds the same word
 * as the nav label **in both languages**. A translation that moved one of the
 * two and not the other fails here, which the old string comparison could not
 * have noticed at all.
 */

const NAV = 'app/components/AppNav.vue'

/**
 * Which file serves a route, which pack pair its heading reads from, and which
 * entry of the nav names it. Only the five sections the nav bar names.
 */
const SECTIONS = [
  { to: '/', page: 'app/pages/index.vue', nav: 'start', packs: { en, de }, path: 'home.title' },
  { to: '/dig', page: 'app/pages/dig.vue', nav: 'dig', packs: dig, path: 'title' },
  { to: '/korb', page: 'app/pages/korb.vue', nav: 'basket', packs: basket, path: 'title' },
  { to: '/regal', page: 'app/pages/regal.vue', nav: 'shelf', packs: collection, path: 'title' },
  {
    to: '/haendler',
    page: 'app/pages/haendler.vue',
    nav: 'dealers',
    packs: dealers,
    path: 'title',
  },
] as const

/** The first `<h1>` of a page, as written. */
function heading(page: string): string {
  const match = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(readFileSync(page, 'utf8'))
  expect(match, `${page} has no <h1>`).not.toBeNull()
  return match![1]!.trim()
}

function at(pack: object, path: string): unknown {
  return path.split('.').reduce<unknown>((node, key) => (node as never)[key], pack)
}

const nav = readFileSync(NAV, 'utf8')
// `\s*` rather than a space: prettier breaks the longer entries across lines,
// and a regex that only reads the short ones silently skips half the nav.
const navKeys = [...nav.matchAll(/to: '[^']+',\s*key: '([^']+)'/g)].map((match) => match[1]!)

describe('what the nav promises', () => {
  it('names five sections', () => {
    expect(navKeys).toEqual(['start', 'dig', 'basket', 'shelf', 'dealers'])
  })

  it.each(SECTIONS)('$to has a heading that comes from a pack', ({ to, page }) => {
    // A literal here is the regression this guards: a heading typed into the
    // markup is a heading that cannot be translated, and nothing else in the
    // suite would notice.
    expect(heading(page), `${to} has a hard-coded heading`).toMatch(/^\{\{[\s\S]+\}\}$/)
  })

  it.each(SECTIONS)(
    '$to calls itself what the nav calls it',
    ({ page, nav: key, packs, path }) => {
      // The heading names *this* entry, not another one that happens to match.
      expect(heading(page).replace(/[{}\s]/g, '')).toMatch(new RegExp(`\\.${path}$`))

      for (const language of ['en', 'de'] as const) {
        const label = (language === 'en' ? en : de).nav[key].label
        expect(at(packs[language], path), `${page} in ${language}`).toBe(label)
      }
    },
  )
})
