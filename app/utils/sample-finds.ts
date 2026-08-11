import type { Signal } from '#shared/types'

/**
 * What comes out at the end — to be seen before anybody hands over a key.
 *
 * The setup screen asked for a Discogs personal token and showed nothing at
 * all of what the app produces. Somebody who has never seen Fidelity had to
 * hand over the key to their account on the strength of one sentence, then
 * wait through a sync and a two-minute scan before the first result appeared.
 * That is a lot of trust to ask on credit.
 *
 * These are the app's own sentences. Not screenshots and not prose about the
 * app — the real output of `reasonFor`, which is the whole product: a hit, a
 * number, and why.
 *
 * **No sentence is written here.** Only the signals are, and the setup screen
 * runs `reasonFor` over them like every other list does. That used to be a
 * frozen string with a test asserting the two agreed; since the sentence is
 * built where it is read, the string would only have been a second copy able
 * to drift — and a copy in one language.
 *
 * Ordered by score, because that is how a dig orders its results. Examples
 * that run in a different order than the real list teach the wrong thing about
 * the list.
 */
export interface SampleFind {
  /** Barry score, on the same 0–100 scale the dig shows. */
  score: number
  grade: 'A' | 'B' | 'C'
  /** The evidence. The sentence is made from this, wherever it is shown. */
  signals: Signal[]
}

export const SAMPLE_FINDS: SampleFind[] = [
  {
    score: 92,
    grade: 'A',
    signals: [
      { type: 'WANTLIST_EXACT', confidence: 1, evidence: {} },
      { type: 'ARTIST_KNOWN', confidence: 0.8, evidence: { artist: 'Robag Wruhme', owned: 5 } },
    ],
  },
  {
    score: 74,
    grade: 'A',
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
