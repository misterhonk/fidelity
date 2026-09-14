import { beforeEach, describe, expect, it } from 'vitest'

import { useReleaseSheet } from '~/composables/useReleaseSheet'

/**
 * Walking the list from inside the sheet (M31.13), and the one flag that
 * decides whether the app reads ahead (M31.15).
 *
 * The arithmetic is small and the consequences are not: an order belonging to
 * one dig must never walk another one's sheet, and a record that has dropped
 * out of the list — filtered away while the sheet stood open — has no
 * neighbours rather than the wrong ones.
 */
describe('the release sheet', () => {
  const sheet = useReleaseSheet()

  beforeEach(() => {
    sheet.hide()
    sheet.setOrder(null)
  })

  it('has no arrows until a list says what its order is', () => {
    sheet.show('dig-1', 20)
    expect(sheet.walk.value).toBeNull()
  })

  it('knows where a record stands, and what is either side of it', () => {
    sheet.setOrder({ digId: 'dig-1', ids: [10, 20, 30] })
    sheet.show('dig-1', 20)

    expect(sheet.walk.value).toEqual({ index: 1, total: 3, previous: 10, next: 30 })
  })

  it('has no way back from the first and no way on from the last', () => {
    sheet.setOrder({ digId: 'dig-1', ids: [10, 20, 30] })

    sheet.show('dig-1', 10)
    expect(sheet.walk.value?.previous).toBeNull()
    sheet.show('dig-1', 30)
    expect(sheet.walk.value?.next).toBeNull()
  })

  /*
   * The dig id is the guard. Two digs of the same shop half an hour apart hold
   * different listing ids for the same records, and an order from one would
   * walk the other one's sheet to a record that is not there.
   */
  it('will not walk one dig with another dig-s order', () => {
    sheet.setOrder({ digId: 'dig-1', ids: [10, 20, 30] })
    sheet.show('dig-2', 20)

    expect(sheet.walk.value).toBeNull()
  })

  it('has no neighbours for a record that has dropped out of the list', () => {
    sheet.setOrder({ digId: 'dig-1', ids: [10, 30] })
    sheet.show('dig-1', 20)

    expect(sheet.walk.value).toBeNull()
  })

  /*
   * Reading ahead is for somebody who is reading along. Opening one record is
   * no evidence that anybody wants a second; pressing the arrow is.
   */
  it('reads ahead only after an arrow, and forgets on the way out', () => {
    sheet.setOrder({ digId: 'dig-1', ids: [10, 20, 30] })

    sheet.show('dig-1', 10)
    expect(sheet.stepped.value).toBe(false)

    sheet.step('dig-1', 20)
    expect(sheet.stepped.value).toBe(true)

    sheet.hide()
    expect(sheet.stepped.value).toBe(false)

    sheet.step('dig-1', 20)
    sheet.show('dig-1', 30)
    expect(sheet.stepped.value).toBe(false)
  })
})
