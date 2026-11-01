import { describe, expect, it } from 'vitest'

import { isDiscogsImage } from '~~/worker/hub/client'

/**
 * The client does not trust the hub.
 *
 * A hub is somebody's spare machine: it will be an old version, misconfigured,
 * or someone else's entirely. The hub pools no covers any more (#206), but a
 * shop's sign still comes from it and still goes straight into an `<img src>`
 * — so a hub able to answer freely would be a hub able to make every screen
 * fetch whatever it liked. These are the checks on the way *out*.
 */
describe('where a cover may come from', () => {
  it('takes Discogs’ image host', () => {
    expect(isDiscogsImage('https://i.discogs.com/abc/rs:fit/x.jpeg')).toBe(true)
  })

  it('takes the empty string — which means “there is none”', () => {
    expect(isDiscogsImage('')).toBe(true)
  })

  it('lehnt alles andere ab', () => {
    // The middle two survive a naive `includes('i.discogs.com')`.
    expect(isDiscogsImage('https://evil.test/pixel.gif')).toBe(false)
    expect(isDiscogsImage('https://i.discogs.com.evil.test/x.jpeg')).toBe(false)
    expect(isDiscogsImage('https://evil.test/?a=https://i.discogs.com')).toBe(false)
    expect(isDiscogsImage('http://i.discogs.com/x.jpeg')).toBe(false)
    expect(isDiscogsImage('javascript:alert(1)')).toBe(false)
    expect(isDiscogsImage('data:image/gif;base64,R0lGOD')).toBe(false)
  })
})
