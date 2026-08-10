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
 * The entry is found the only way that cannot drift: Vite writes the worker's
 * filename into the chunk that constructs it, as
 * `new Worker(new URL("index-<hash>.js", import.meta.url))`. Reading it from
 * there is reading the build's own answer.
 *
 * It used to be found by searching every chunk for "api.discogs.com", on the
 * grounds that only the worker talks to Discogs. Then a privacy page mentioned
 * the hostname in prose, the search matched a page chunk, and the budget
 * reported 54 kB of things the worker never loads. A heuristic that any German
 * sentence can break is not a measurement.
 *
 * Following the imports matters just as much. `worker.format: 'es'` lets Vite
 * split the worker, and measuring the entry alone rewards pushing code into a
 * sibling chunk the entry loads anyway — a saving on paper and nothing a user
 * would notice. `import("./x.js")` is excluded; that is a real deferral.
 */
const WORKER_DIR = '.output/public/_nuxt'

const chunkFiles = readdirSync(WORKER_DIR)
  .filter((file) => file.endsWith('.js'))
  .map((file) => `${WORKER_DIR}/${file}`)

const workerEntry = chunkFiles
  .map(
    (file) =>
      /new Worker\(new URL\([^)]*?["'`]([\w.-]+\.js)["'`]/.exec(
        readFileSync(file, 'utf8'),
      )?.[1],
  )
  .find((name) => name !== undefined)

if (!workerEntry) {
  throw new Error('worker entry not found — did `new Worker(new URL(...))` change shape?')
}

const workerPath = `${WORKER_DIR}/${workerEntry}`

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

const workerChunks = new Set([workerPath])
const queue = [workerPath]

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
