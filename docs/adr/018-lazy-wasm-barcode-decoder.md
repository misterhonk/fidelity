# ADR-018 – A barcode decoder for Safari, loaded only when asked for

**Status:** Proposed — waiting for the owner's decision (#217)
**Date:** 2026-11-01

## Context

The in-store screen reads a record's barcode with `BarcodeDetector`
(`app/composables/useBarcodeScan.ts`). Chromium has it; WebKit does not, so the
iPhone, this project's weakest target, gets a text field and nothing else. Since #217
the field says how to use iOS's own **Scan Text** from the keyboard bar, which costs no
bytes and reads the printed digits under the bars. It does not read the bars, and it
is two taps more than pointing a camera.

The candidate is `zxing-wasm` (the ZXing C++ reader compiled to WebAssembly, reader-only
build): about **412 kB** for the `.wasm` plus a small JS glue, and it exposes the same
`detect()` shape as `BarcodeDetector`, so the composable would keep one code path.

Two rules stand against loading it the ordinary way:

- **Rule 7, the bundle budget.** 180 kB gzip for the first meaningful paint. 412 kB
  in the first paint is out of the question.
- **The CSP** (`scripts/csp/policy.mjs`) is `script-src 'self'` plus hashes. Compiling
  WebAssembly needs `'wasm-unsafe-eval'` in `script-src`. That is narrower than
  `'unsafe-eval'` (it allows `WebAssembly.compile`/`instantiate`, not `eval()` of
  strings), but it is a widening of the policy and has to be decided, not slipped in.

## Options

1. **Leave it.** Typing plus Scan Text. Zero bytes, zero policy change.
2. **Lazy zxing-wasm.** A dynamic `import()` inside `useBarcodeScan.start()` and only
   when `BarcodeDetector` is missing. The module and the `.wasm` are self-hosted under
   `/_nuxt/`, never prefetched, never in the precache manifest's first-paint set; the
   service worker caches them at runtime after the first scan so the shop basement
   still works. CSP gains `'wasm-unsafe-eval'`.
3. **A JS-only decoder** (e.g. a Quagga/ZXing JS port). No CSP change, but ~100–200 kB
   of JS, slower on a phone, and worse at the curved, glossy barcode on a shrink-wrapped
   sleeve.

## Proposed decision

Option 2, under these conditions:

- `size-limit` gets an entry that proves the decoder is **not** in the first-paint
  chunk set; a separate, documented ceiling for the lazy chunk.
- The `.wasm` is served from `'self'`; no CDN, no `connect-src` change.
- `'wasm-unsafe-eval'` is added to `script-src` and nothing else; `tests/unit/csp.spec.ts`
  pins exactly that token.
- Loaded only after a tap on "Scan", and only where `BarcodeDetector` is absent.
  Chromium never downloads it.
- If the import fails (offline on first use, blocked), the screen falls back to the
  field and the Scan Text hint that exists today.

## Open for the owner

- Is `'wasm-unsafe-eval'` acceptable in the policy? (Threat model: `docs/21-THREAT-MODEL.md`.)
- Is 412 kB on demand, once, worth two taps saved per record in a shop?

Nothing is implemented until this is decided.
