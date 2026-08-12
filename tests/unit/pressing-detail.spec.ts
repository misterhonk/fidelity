import { describe, expect, it } from 'vitest'

import { basicInformationSchema } from '~~/worker/discogs/schemas'
import { toItem } from '~~/worker/sync/library'

/**
 * What the sync already paid for and used to throw away.
 *
 * `basic_information` carries how many discs a release has and the free line
 * the submitter typed — "Blue Translucent", "Etched" — and both were parsed
 * off. A double LP therefore looked exactly like a single one, on a screen
 * whose whole job is to tell one pressing from another.
 *
 * Measured against the live API on 2026-08-12: `qty` is a *string*, and
 * `identifiers` and a full `released` date are **not** in this response —
 * those cost a request to `/releases/{id}` and are not part of this.
 */

function info(formats: unknown[]) {
  return basicInformationSchema.parse({
    id: 1,
    title: 'Selected Ambient Works',
    formats,
  })
}

const itemFrom = (formats: unknown[]) =>
  toItem(1, info(formats), '2024-01-01T00:00:00-00:00', 0)

describe('what the shelf knows about a pressing', () => {
  it('counts the discs, however Discogs spells the number', () => {
    expect(itemFrom([{ name: 'Vinyl', qty: '2', descriptions: ['LP'] }]).discs).toBe(2)
  })

  /*
   * A 2×LP with a bonus 7" is three discs in two blocks.
   *
   * Taking the first `qty` would give two, which is not a rounding error but
   * the wrong half of the answer — and the half that makes a boxed set look
   * like an ordinary record.
   */
  it('adds up the blocks rather than believing the first', () => {
    expect(
      itemFrom([
        { name: 'Vinyl', qty: '2', descriptions: ['LP'] },
        { name: 'Vinyl', qty: '1', descriptions: ['7"'] },
      ]).discs,
    ).toBe(3)
  })

  it('reads one disc when Discogs says nothing', () => {
    expect(itemFrom([{ name: 'Vinyl' }]).discs).toBe(1)
  })

  it('keeps the line the submitter typed', () => {
    expect(itemFrom([{ name: 'Vinyl', text: 'Blue Translucent' }]).formatText).toEqual([
      'Blue Translucent',
    ])
  })

  /*
   * The one that earns the file.
   *
   * `formats` is what the matching engine compares a listing against, and it
   * must stay a list of *kinds* of record. Folding the colour in would have it
   * comparing "Blue Translucent" as though it were a format — a pressing
   * detail quietly turned into a matching signal, which is the kind of change
   * that moves scores without anybody deciding to.
   */
  it('never lets a colour into the list the engine matches on', () => {
    const item = itemFrom([
      { name: 'Vinyl', qty: '2', text: 'Blue Translucent', descriptions: ['LP', 'Album'] },
    ])

    expect(item.formats).toEqual(['Vinyl', 'LP', 'Album'])
    expect(item.formats).not.toContain('Blue Translucent')
    expect(item.formats.join(' ')).not.toMatch(/\d/)
  })

  it('leaves the free line out when there is none', () => {
    expect(itemFrom([{ name: 'CD' }]).formatText).toEqual([])
  })
})
