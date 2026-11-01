import { readdirSync, readFileSync } from 'node:fs'

/**
 * Bundle budget (docs/12-RESOURCE-BUDGET.md §2).
 *
 * It should still load where reception is bad — a shop's basement, behind
 * concrete — so the budget is on the *first meaningful paint*, not on the whole
 * build.
 *
 * Raised from 120 kB on 2026-08-11. That number modelled 3G, which has been
 * switched off in Germany since 2021, and on any connection a person actually
 * has the difference between 120 and 180 kB is forty milliseconds. It is still
 * a hard limit and still breaks the build: a budget that gets raised whenever
 * it is inconvenient is not a budget. See docs/12 for the arithmetic.
 *
 * The file list is read out of the generated index.html rather than globbed
 * from `_nuxt/`: only the entry stylesheet and the module graph the browser
 * preloads block the first paint. `rel="prefetch"` chunks — error pages and,
 * later, other routes — are fetched at idle and get their own per-route
 * budgets once there is more than one route.
 */
const html = readFileSync('.output/public/index.html', 'utf8')
// The service worker's navigation fallback: every address but `/` opens this
// one, so what it preloads or prefetches is paid just the same (#304).
const fallbackHtml = readFileSync('.output/public/200.html', 'utf8')

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

const read = (file) => readFileSync(file, 'utf8')

/*
 * The barcode reader for Safari (ADR-018, #301) starts a worker of its own
 * (#304), so there are two `new Worker(new URL(...))` in the build. Its
 * launcher is the one chunk that names the hashed `.wasm`; the Discogs worker
 * is whichever the launcher does not start.
 */
const decoderLaunchers = chunkFiles.filter((file) =>
  /zxing_reader\.[\w-]+\.wasm/.test(read(file)),
)

const workerStarts = (file) =>
  [...read(file).matchAll(/new Worker\(new URL\([^)]*?["'`]([\w.-]+\.js)["'`]/g)].map(
    ([, name]) => name,
  )

const decoderWorkers = new Set(decoderLaunchers.flatMap(workerStarts))
const workerEntries = [
  ...new Set(chunkFiles.flatMap(workerStarts).filter((name) => !decoderWorkers.has(name))),
]
const workerEntry = workerEntries.length === 1 ? workerEntries[0] : undefined

if (!workerEntry) {
  throw new Error(
    `expected one worker entry besides the decoder's, found ${workerEntries.length} — did \`new Worker(new URL(...))\` change shape?`,
  )
}

const workerPath = `${WORKER_DIR}/${workerEntry}`

/*
 * The worker is not a first-paint asset (#299). Nuxt used to preload it from
 * index.html, and the first-paint figure carried 19 kB the page never runs;
 * nuxt.config.ts's `build:manifest` hook takes it out. Should it come back,
 * that is a regression to name, not a number to absorb.
 */
if (entryAssets.includes(workerPath)) {
  throw new Error(
    `the worker (${workerEntry}) is preloaded by index.html — see nuxt.config.ts build:manifest`,
  )
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

/*
 * The barcode reader for Safari (ADR-018, #301): zxing-wasm's reader build,
 * reached only through `import()` in useBarcodeScan.start(). Its launcher
 * names the hashed `.wasm` and starts the decoder's worker, which carries the
 * glue (#304). None of it may be among the first-paint files, nor so much as
 * prefetched by index.html or 200.html — a Chromium visitor must never
 * download it.
 */
const decoderWasm = readdirSync(WORKER_DIR)
  .filter((file) => /^zxing_reader\..+\.wasm$/.test(file))
  .map((file) => `${WORKER_DIR}/${file}`)

if (decoderWasm.length !== 1 || decoderLaunchers.length !== 1 || decoderWorkers.size !== 1) {
  throw new Error(
    `barcode decoder not found as one .wasm, one launcher and one worker (${decoderWasm.length}, ${decoderLaunchers.length}, ${decoderWorkers.size})`,
  )
}

const withStaticImports = (roots) => {
  const found = new Set(roots)
  const pending = [...roots]
  while (pending.length > 0) {
    for (const next of staticImports(pending.pop())) {
      if (found.has(next)) continue
      found.add(next)
      pending.push(next)
    }
  }
  return found
}

const decoderChunks = withStaticImports([
  ...decoderLaunchers,
  ...[...decoderWorkers].map((name) => `${WORKER_DIR}/${name}`),
])

for (const file of [...decoderWasm, ...decoderChunks]) {
  const name = file.slice(WORKER_DIR.length + 1)
  for (const [page, source] of [
    ['index.html', html],
    ['200.html', fallbackHtml],
  ]) {
    if (entryAssets.includes(file) || source.includes(name)) {
      throw new Error(
        `the barcode decoder (${name}) is loaded or prefetched by ${page} — ADR-018`,
      )
    }
  }
}

export default [
  {
    name: 'Erster sinnvoller Paint',
    path: entryAssets,
    limit: '180 kB',
    gzip: true,
  },
  {
    name: 'Worker (lazy, nach dem ersten Paint)',
    path: [...withStaticImports([workerPath])],
    /*
     * 35 → 40 kB on 2026-09-12 (M21.4), then **40 → 25 kB on 2026-09-16**,
     * because the worker had reached 39.54 and the answer turned out to be
     * one import.
     *
     * Zod was 18.9 kB of that 39.54 — nearly half the start-up — and it was
     * there because `auth.ts` named two response schemas at the top of the
     * file. `auth.ts` is the entry: `index.ts` imports `handlers.ts` imports
     * it, so a name at its top is paid before the first message is answered.
     * Both uses sit inside a sign-in that is about to spend 2.4 seconds on two
     * paced requests. Fetched there instead: **39.54 → 20.31 kB.**
     *
     * The ceiling comes down with it, and that is the point rather than
     * tidiness. A limit at 40 over a worker at 20 stops nothing — Zod could
     * walk back in tomorrow through any static import and the build would
     * stay green. 25 kB leaves room for real growth and still notices that.
     *
     * Raising it again is a decision, not a fix. What comes first if it is
     * reached: the horizon and the matcher, then zod/mini (docs/12 §2).
     *
     * **25 → 22 kB on 2026-11-01 (#299).** It had crept to 25.01 kB. Zod was
     * back in the entry for a one-line `z.config()` (3.6 kB), and the basket
     * and hub handlers sat in the table inline; out: **25.01 → 20.13 kB**.
     * The ceiling follows for the same reason as last time — tests/unit/
     * worker-entry.spec.ts names the cause, this notices the size.
     */
    limit: '22 kB',
    gzip: true,
  },
  {
    name: 'Barcode decoder (lazy, only without BarcodeDetector)',
    path: [...decoderChunks, ...decoderWasm],
    /*
     * zxing-wasm 3.1.5's reader build, measured on 2026-11-01: 415.1 kB of
     * .wasm plus 12.3 kB of glue, gzip. Fetched once, on the first tap on
     * "Scan" in a browser without BarcodeDetector, then kept by the service
     * worker (docs/12 §2). The ceiling leaves room for a patch release, not
     * for the full build (reader + writer) slipping in by a wrong import.
     */
    limit: '440 kB',
    gzip: true,
  },
]
