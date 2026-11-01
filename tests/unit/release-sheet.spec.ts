import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

/*
 * The cover grows into the sheet and shrinks back into the list (#226). A
 * view-transition name may stand on one element per picture, so the list's
 * cover holds it for the old picture only on the way in, and for the new one
 * only on the way out — the sheet's own cover holds it the rest of the time.
 */
describe('the cover the sheet grows out of', () => {
  const sheet = useReleaseSheet()
  const img = { style: { viewTransitionName: '' } }
  const card = { querySelector: () => img } as unknown as HTMLElement
  let update: () => Promise<void> = async () => {}
  let names: string[] = []

  beforeEach(() => {
    names = []
    vi.stubGlobal('document', {
      startViewTransition(cb: () => Promise<void>) {
        names.push(img.style.viewTransitionName)
        update = cb
        return { ready: Promise.resolve(), finished: new Promise(() => {}) }
      },
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('is named for the picture before the sheet opens, and not after', async () => {
    sheet.show('dig-1', 20, card)
    expect(names).toEqual(['fid-cover'])
    await update()
    expect(img.style.viewTransitionName).toBe('')
    expect(sheet.open.value).toEqual({ digId: 'dig-1', listingId: 20 })
  })

  it('is named for the picture after the sheet closes, and not before', async () => {
    sheet.show('dig-1', 20, card)
    await update()
    sheet.hide()
    expect(names.at(-1)).toBe('')
    await update()
    expect(img.style.viewTransitionName).toBe('fid-cover')
  })

  it('is left alone on the way out once the sheet has walked to another record', async () => {
    sheet.show('dig-1', 20, card)
    await update()
    sheet.step('dig-1', 30)
    await update()
    img.style.viewTransitionName = ''
    sheet.hide()
    await update()
    expect(img.style.viewTransitionName).toBe('')
  })
})
