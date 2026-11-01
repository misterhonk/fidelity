import { describe, expect, it } from 'vitest'

import {
  drainLookups,
  lookupKind,
  queueLookup,
  readQueue,
  type QueuedLookup,
} from '~/utils/lookup'

describe('the one field (#225)', () => {
  it('tells barcode, catalogue number and text apart', () => {
    expect(lookupKind('5012394144777')).toBe('barcode')
    expect(lookupKind(' 5 012394 144777 ')).toBe('barcode')
    expect(lookupKind('0602557150995')).toBe('barcode')
    // Digits, but too few for any barcode: Go! Beat's catalogue number.
    expect(lookupKind('828 553-1')).toBe('catno')
    expect(lookupKind('828 553-1 A1 TOWNHOUSE')).toBe('catno')
    expect(lookupKind('SHVL 804')).toBe('catno')
    expect(lookupKind('Portishead')).toBe('text')
    expect(lookupKind('dummy')).toBe('text')
    expect(lookupKind('   ')).toBeNull()
  })
})

describe('lookups without signal (#225)', () => {
  const ean: QueuedLookup = { code: '5012394144777', kind: 'barcode' }
  const runout: QueuedLookup = { code: '828 553-1 A1', kind: 'catno' }

  it('reads back only what is a lookup', () => {
    expect(readQueue(JSON.stringify([ean, { code: 'Portishead' }, { code: 4 }, null]))).toEqual(
      [ean],
    )
    expect(readQueue('not json')).toEqual([])
    expect(readQueue(null)).toEqual([])
  })

  it('queues each code once', () => {
    expect(queueLookup(queueLookup([], ean), ean)).toEqual([ean])
    expect(queueLookup([ean], runout)).toEqual([ean, runout])
  })

  it('resolves the queue after reconnect, one at a time, in order', async () => {
    let connected = false
    const asked: string[] = []
    const lookUp = async (entry: QueuedLookup) => {
      asked.push(entry.code)
      if (!connected) throw new TypeError('Failed to fetch')
      return `found ${entry.code}`
    }

    // Still in the basement: nothing resolves, nothing is lost.
    const offline = await drainLookups([ean, runout], lookUp)
    expect(offline.done).toEqual([])
    expect(offline.left).toEqual([ean, runout])
    expect(asked).toEqual([ean.code])

    connected = true
    const back = await drainLookups(offline.left, lookUp)
    expect(back.done).toEqual([
      { entry: ean, result: `found ${ean.code}` },
      { entry: runout, result: `found ${runout.code}` },
    ])
    expect(back.left).toEqual([])
  })

  it('keeps what is left when the signal drops halfway', async () => {
    const lookUp = async (entry: QueuedLookup) => {
      if (entry === runout) throw new TypeError('Failed to fetch')
      return entry.code
    }
    const result = await drainLookups([ean, runout], lookUp)
    expect(result.done).toEqual([{ entry: ean, result: ean.code }])
    expect(result.left).toEqual([runout])
  })
})
