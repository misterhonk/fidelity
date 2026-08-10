import type { Signal } from '#shared/types'

/**
 * Was am Ende herauskommt — zu sehen, bevor man einen Schlüssel hergibt.
 *
 * The setup screen asked for a Discogs personal token and showed nothing at
 * all of what the app produces. Somebody who has never seen Fidelity had to
 * hand over the key to their account on the strength of one sentence, then
 * wait through a sync and a two-minute scan before the first result appeared.
 * That is a lot of trust to ask on credit.
 *
 * These are the app's own sentences. Not screenshots and not prose about the
 * app — the actual output of `buildReason`, which is the whole product: a hit,
 * a number, and why.
 *
 * **The sentences are not written here, they are results.** Each entry carries
 * the signals that produce it, and a test runs the real `buildReason` over
 * them and asserts it says exactly this (tests/unit/sample-finds.spec.ts). An
 * example that drifts from what the app says would be worse than none.
 *
 * The worker's module is not imported: it would be pulled into the chunk that
 * paints the very first screen, and the bundle budget for that is 120 KB
 * (docs/12). A constant plus a test costs nothing and cannot lie.
 *
 * Ordered by score, because that is how a dig orders its results. Examples
 * that run in a different order than the real list teach the wrong thing about
 * the list.
 */
export interface SampleFind {
  /** Barry score, on the same 0–100 scale the dig shows. */
  score: number
  grade: 'A' | 'B' | 'C'
  /** What `buildReason(signals)` returns. Asserted, never typed by hand. */
  reason: string
  /** The evidence behind it, so the test can reproduce the sentence. */
  signals: Signal[]
}

export const SAMPLE_FINDS: SampleFind[] = [
  {
    score: 92,
    grade: 'A',
    reason: 'Steht genau so auf deiner Wantlist. Außerdem: Künstler bekannt (Robag Wruhme).',
    signals: [
      { type: 'WANTLIST_EXACT', confidence: 1, evidence: {} },
      { type: 'ARTIST_KNOWN', confidence: 0.8, evidence: { artist: 'Robag Wruhme', owned: 5 } },
    ],
  },
  {
    score: 74,
    grade: 'A',
    reason:
      'Wighnomy Brothers hat hier mitgewirkt – du hast 3 Platten von ihm. ' +
      'Außerdem: Label Freude Am Tanzen, Katalogserie FAT.',
    signals: [
      {
        type: 'CREDIT_GRAPH',
        confidence: 1,
        evidence: { person: 'Wighnomy Brothers', owned: 3 },
      },
      {
        type: 'LABEL_AFFINITY',
        confidence: 0.79,
        evidence: { label: 'Freude Am Tanzen', owned: 3 },
      },
      { type: 'CATALOG_RUN', confidence: 0.5, evidence: { prefix: 'FAT', number: 16 } },
    ],
  },
  {
    score: 61,
    grade: 'B',
    reason:
      'Du hast 2 Platten von Monkey Maffia – diese nicht. ' +
      'Außerdem: Label Freude Am Tanzen, nur 8 im Angebot.',
    signals: [
      {
        type: 'ARTIST_KNOWN',
        confidence: 0.9,
        evidence: { artist: 'Monkey Maffia', owned: 2 },
      },
      {
        type: 'LABEL_AFFINITY',
        confidence: 0.6,
        evidence: { label: 'Freude Am Tanzen', owned: 3 },
      },
      { type: 'SCARCITY', confidence: 0.7, evidence: { numForSale: 8 } },
    ],
  },
]
