import { describe, expect, it } from 'vitest'

import { StaleStockCounter } from '~~/worker/dig/stale'

const NOW = Date.parse('2026-11-02T12:00:00Z')

describe('counting stale stock (#244)', () => {
  it('counts listings put up more than five years before the dig', () => {
    const counter = new StaleStockCounter(NOW)
    counter.add('2021-11-01T10:00:00-07:00') // a day past five years
    counter.add('2016-03-14T10:00:00-07:00')
    counter.add('2021-11-03T10:00:00-07:00') // a day short of it
    counter.add('2026-10-30T10:00:00-07:00')

    expect(counter.build()).toEqual({ old: 2, dated: 4, asOf: NOW })
  })

  it('leaves listings without a date out of the denominator', () => {
    const counter = new StaleStockCounter(NOW)
    counter.add('2010-01-01T00:00:00Z')
    counter.add(undefined)
    counter.add('not a date')

    expect(counter.build()).toEqual({ old: 1, dated: 1, asOf: NOW })
  })

  it('says nothing rather than 0 of 0', () => {
    expect(new StaleStockCounter(NOW).build()).toBeNull()
  })
})
