# ADR-018 – A barcode decoder for Safari, loaded only when asked for

**Status:** Accepted — option 2, owner decision of 2026-11-01 (#301)
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

## Decision

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

## Decided by the owner (2026-11-01)

Both open questions were answered yes: `'wasm-unsafe-eval'` is acceptable in the policy
(threat-model note in `docs/21-THREAT-MODEL.md` §2.2), and ~415 kB on demand, once, is
worth two taps saved per record.

## As built (#301)

- `zxing-wasm` **3.1.5**, pinned exactly, reader build only (`zxing-wasm/reader`). Measured:
  415.1 kB gzip `.wasm` + 12.3 kB gzip glue. The full build (reader + writer) would be
  roughly twice that and is refused by a unit test.
- `app/composables/scan/zxing.ts` is reached only by `import()` in
  `useBarcodeScan.start()`, and only when `BarcodeDetector` is absent. It points zxing's
  `locateFile` at the hashed `.wasm` Vite emits under `/_nuxt/` instead of jsDelivr.
- The decoder loads **before** the camera opens: without a reader, the camera would show a
  picture and read nothing. If the import or the `.wasm` fails, `failure` is
  `'unavailable'` and the screen shows the field and the Scan Text hint.
- **Service worker:** the glue chunk is precached like every other lazy chunk (`**/*.js`,
  12 kB); the `.wasm` is **not** (no `.wasm` in `globPatterns`), so a fresh install does not
  carry 415 kB that Chromium never uses. `app/sw/sw.ts` caches it CacheFirst on first use
  (`fidelity-decoder`, one entry), so a second scan works in the basement.
- `.size-limit.js` throws if the glue or the `.wasm` is among the first-paint files or is
  named anywhere in `index.html` (prefetch included), and holds the lazy pair under 440 kB.
- The scanned digits are also written into the field, so a misread is visible and fixable.

## Follow-ups (#304)

- **Decoding runs in a worker of its own.** `app/composables/scan/zxing.ts` is now only a
  launcher: it fetches the `.wasm` (so the request stays the page's, cached by the service
  worker and routable in tests in every engine), starts `worker/scan/zxing.ts` with
  `new Worker(new URL(...))`, hands it the bytes once and then one frame at a time. Copying
  the video frame into an `ImageData` stays on the main thread, because only it has the
  `<video>`; `readBarcodes` runs only in the worker. The worker is separate from the Discogs
  worker, makes no requests and is started at most once per page. `.size-limit.js` tells the
  two workers apart by the launcher, the one chunk that names the hashed `.wasm`.
- **No retry after a failed load, by design.** When the reader cannot load, `failure` is
  `'unavailable'` and the scan button stays hidden until the page is reloaded. The usual
  cause is being offline on first use, where a second tap fails the same way; and a failed
  `import()` of the launcher chunk is remembered by some browsers' module maps, so a retry
  would not even reach the network. The field and the Scan Text hint cover the meantime.
  The launcher itself forgets a failed start, so the next attempt after a reload is a clean
  one.
- **Delivery.** Apache now sends `application/wasm` (`AddType`), compresses it and marks it
  immutable like every hashed file; without the type, Emscripten falls back to the slower
  non-streaming compile. nginx had both already through `mime.types` and its `/_nuxt/` rule.
  Since #304 the bytes reach the worker as an `ArrayBuffer`, so the compile is not streamed
  either way; the type still matters for anything that fetches the file directly.
- **Guards.** The size-limit prefetch check also reads `200.html`, the service worker's
  navigation fallback; `tests/unit/identify.spec.ts` pins the `.wasm` runtime route, its
  absence from `globPatterns`, the Apache type and that `readBarcodes` stays out of the
  launcher; `tests/e2e/barcode-scan.spec.ts` finds the decoder's files by content in the
  build instead of by a name pattern that missed the hashed launcher chunk.
