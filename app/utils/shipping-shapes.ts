/**
 * Die Formen, die der Versand-Parser lesen kann.
 *
 * `worker/basket/parse-shipping.ts` has carried this list since it was written,
 * with the comment "for the interface to show when it fails". No interface ever
 * showed it — the list sat there, exported, unread, and a fourth entry was
 * added to it without anybody noticing that nobody would see it.
 *
 * Where the parser gives up, the screen says "trag die Staffel ein" and leaves
 * somebody to guess what it was hoping for. These are what it was hoping for.
 *
 * Kept here rather than imported from the worker because the worker's modules
 * are loaded on demand inside a Web Worker, and pulling one across the boundary
 * to read four strings would cost a chunk for a caption. Guarded by a test that
 * the two lists stay identical.
 */
export const UNDERSTOOD_SHAPES = [
  '1 LP: 6,00 €, 2-3 LP: 9,00 €, ab 4 LP: 12,00 €',
  '1 record 5 EUR, each additional 1 EUR',
  'Porto: 1-2 LPs 7,50 / 3-5 LPs 10,-',
  'Up to 15 records: 6 EUR',
]
