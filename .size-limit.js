import { readFileSync } from 'node:fs'

/**
 * Bundle budget (docs/12-RESSOURCEN-BUDGET.md §2).
 *
 * The thing has to load in the basement of a record shop over 3G, so the
 * budget is on the *first meaningful paint*, not on the whole build.
 *
 * The file list is read out of the generated index.html rather than globbed
 * from `_nuxt/`: only the entry stylesheet and the module graph the browser
 * preloads block the first paint. `rel="prefetch"` chunks — error pages and,
 * later, other routes — are fetched at idle and get their own per-route
 * budgets once there is more than one route.
 */
const html = readFileSync('.output/public/index.html', 'utf8')

const blocking = [
  ...html.matchAll(/<link\b[^>]*\brel="(stylesheet|modulepreload)"[^>]*>/g),
  ...html.matchAll(/<script\b[^>]*\bsrc="[^"]+"[^>]*>/g),
]
  .map(([tag]) => /\b(?:href|src)="(\/_nuxt\/[^"]+)"/.exec(tag)?.[1])
  .filter((asset) => asset !== undefined)

const entryAssets = [...new Set(blocking)].map((asset) => `.output/public${asset}`)

if (entryAssets.length === 0) {
  throw new Error('no entry assets found — run `pnpm build` before `pnpm size`')
}

export default [
  {
    name: 'Erster sinnvoller Paint',
    path: entryAssets,
    limit: '120 kB',
    gzip: true,
  },
]
