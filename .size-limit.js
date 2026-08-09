import { readdirSync, readFileSync } from 'node:fs'

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

/**
 * The worker's start-up cost: its entry chunk plus everything it *statically*
 * imports, transitively.
 *
 * Following the imports is the whole point. `worker.format: 'es'` lets Vite
 * split the worker, and a naive measurement of the entry file alone rewards
 * exactly the wrong thing: pushing code into a sibling chunk the entry loads
 * anyway reads as a 19 kB saving and changes nothing a user would notice. A
 * budget that can be satisfied by moving bytes sideways is not a budget.
 *
 * `import("./x.js")` is excluded — that is a real deferral, fetched only when
 * a handler needs it. `import "./x.js"` and `from "./x.js"` are not.
 */
const WORKER_DIR = '.output/public/_nuxt'

const workerEntry = readdirSync(WORKER_DIR)
  .filter((file) => file.endsWith('.js'))
  .map((file) => `${WORKER_DIR}/${file}`)
  .find((file) => readFileSync(file, 'utf8').includes('api.discogs.com'))

if (!workerEntry) {
  throw new Error('worker chunk not found — did the Discogs client move?')
}

function staticImports(file) {
  const code = readFileSync(file, 'utf8')
  const found = new Set()

  // Static forms only. The negative lookbehind on `(` is what keeps dynamic
  // imports out: `import("./x.js")` is deferred, `import"./x.js"` is not.
  for (const [, specifier] of code.matchAll(/(?:^|[^.\w])import\s*(?!\()["']([^"']+)["']/g)) {
    found.add(specifier)
  }
  for (const [, specifier] of code.matchAll(/\bfrom\s*["']([^"']+)["']/g)) {
    found.add(specifier)
  }

  return [...found]
    .filter((specifier) => specifier.startsWith('./') || specifier.startsWith('../'))
    .map((specifier) => `${WORKER_DIR}/${specifier.replace(/^\.+\//, '')}`)
}

const workerChunks = new Set([workerEntry])
const queue = [workerEntry]

while (queue.length > 0) {
  for (const next of staticImports(queue.pop())) {
    if (workerChunks.has(next)) continue
    workerChunks.add(next)
    queue.push(next)
  }
}

export default [
  {
    name: 'Erster sinnvoller Paint',
    path: entryAssets,
    limit: '120 kB',
    gzip: true,
  },
  {
    name: 'Worker (lazy, nach dem ersten Paint)',
    path: [...workerChunks],
    limit: '35 kB',
    gzip: true,
  },
]
