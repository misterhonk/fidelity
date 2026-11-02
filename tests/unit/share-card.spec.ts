import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import type { SharedFind } from '#shared/types'
import { CARD_SIZE, drawShareCard } from '~/utils/share-card'

import { withoutComments } from '../helpers/german'

/**
 * A find as a picture (#250): the reason sentence and the label sleeve, drawn
 * on the device. No cover art — a Discogs image may not travel into somebody's
 * chat history — and the notice sits in the picture itself.
 */

const FIND: SharedFind = {
  releaseId: 1001,
  listingId: 1,
  score: 87,
  artist: 'John Coltrane',
  title: 'Blue Train',
  label: 'Blue Note',
  catno: 'BLP 1577',
  format: 'LP',
  year: 1957,
  signals: [{ type: 'WANTLIST_EXACT', confidence: 1, evidence: {} }],
}

const TEXT = {
  reason:
    "That's on your wantlist, and it has been on there for a very long time indeed, longer than most.",
  credit: 'Data provided by Discogs',
  brand: 'Sleeveside',
}

/** A 2D context that records what is drawn and measures every letter 10 px wide. */
function recorder() {
  const calls: { name: string; args: unknown[] }[] = []
  const ctx = new Proxy(
    {},
    {
      get(_, name: string) {
        if (name === 'measureText') return (text: string) => ({ width: text.length * 10 })
        return (...args: unknown[]) => calls.push({ name, args })
      },
      set: () => true,
    },
  ) as CanvasRenderingContext2D
  drawShareCard(ctx, FIND, TEXT)
  const drawn = calls.filter((c) => c.name === 'fillText').map((c) => String(c.args[0]))
  return { calls, drawn }
}

describe('the share card', () => {
  it('never draws an image, so never one from i.discogs.com', () => {
    expect(recorder().calls.map((c) => c.name)).not.toContain('drawImage')

    const source = withoutComments(readFileSync('app/utils/share-card.ts', 'utf8'))
    for (const banned of [
      'drawImage',
      'new Image',
      '<img',
      'createImageBitmap',
      'discogs.com',
    ]) {
      expect(source).not.toContain(banned)
    }
  })

  it('carries the sleeve, the record, the reason and the notice', () => {
    const { calls, drawn } = recorder()
    const text = drawn.join(' ')
    for (const words of ['Blue Note', 'BLP 1577', 'John Coltrane', 'Blue Train', 'wantlist']) {
      expect(text).toContain(words)
    }
    expect(drawn).toContain('Data provided by Discogs')
    expect(calls.some((c) => c.name === 'arc')).toBe(true)
  })

  it('wraps the reason inside the card', () => {
    const { drawn } = recorder()
    expect(drawn.filter((line) => /wantlist|most\./.test(line))).toHaveLength(2)
    for (const line of drawn) expect(line.length * 10).toBeLessThanOrEqual(CARD_SIZE - 2 * 72)
  })
})
