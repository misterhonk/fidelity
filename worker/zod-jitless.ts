/*
 * The CSP has no 'unsafe-eval', so zod's compiled parsers could never run in
 * the worker anyway — but zod finds that out by calling `new Function`, and
 * the browser reports every such probe as a violation (#204).
 *
 * Set on the global zod keeps its config on, not through `z.config()`: that
 * import put zod's core and util — 3.6 kB gzip — into the worker's entry
 * chunk, ahead of the first message, for a flag (#299).
 *
 * Its own module, imported FIRST by worker/index.ts: zod reads the flag when a
 * schema is constructed, and a schema module evaluates at import time. ES
 * modules evaluate in import order, so first is the only place guaranteed to
 * be early enough. tests/unit/worker-zod-config.spec.ts holds zod to this.
 */
const zodGlobal = globalThis as { __zod_globalConfig?: { jitless?: boolean } }
;(zodGlobal.__zod_globalConfig ??= {}).jitless = true

export {}
