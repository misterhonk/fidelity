import { describe, expect, it } from 'vitest'

import { LISTEN_NAMES, LISTEN_SERVICES, listenUrl } from '#shared/listen'

/**
 * One tap from a find to the music (M31).
 *
 * "I want to hear the music it suggests — Spotify, Apple Music, Tidal, Deezer,
 * and let me choose which." A link, not an integration: Fidelity cannot know
 * Spotify's id for a record without asking Spotify, and asking needs an
 * account, a key and a round trip. It hands over the artist and the title,
 * which is what somebody would type anyway.
 */
describe('a listen link', () => {
  it('takes the artist and the title to the chosen service', () => {
    expect(listenUrl('spotify', 'Moderat', 'II')).toBe(
      'https://open.spotify.com/search/Moderat%20II',
    )
    expect(listenUrl('apple', 'Moderat', 'II')).toBe(
      'https://music.apple.com/search?term=Moderat%20II',
    )
    expect(listenUrl('tidal', 'Moderat', 'II')).toBe('https://tidal.com/search?q=Moderat%20II')
    expect(listenUrl('deezer', 'Moderat', 'II')).toBe(
      'https://www.deezer.com/search/Moderat%20II',
    )
    expect(listenUrl('youtube', 'Moderat', 'II')).toBe(
      'https://music.youtube.com/search?q=Moderat%20II',
    )
  })

  it('is nothing at all until a service is chosen', () => {
    expect(listenUrl('none', 'Moderat', 'II')).toBeNull()
  })

  /*
   * Discogs disambiguates identical names with a trailing number — "Nirvana
   * (2)" is a different band from Nirvana, and the matcher is careful never to
   * strip it (docs/04). A streaming service has never heard of it.
   */
  it('drops the Discogs disambiguation on the way out', () => {
    expect(listenUrl('spotify', 'Nirvana (2)', 'Local Anaesthetic')).toBe(
      'https://open.spotify.com/search/Nirvana%20Local%20Anaesthetic',
    )
  })

  /*
   * A search for a bare title lands on somebody else's record, and a button
   * that promises the music and delivers a stranger's is worse than none.
   */
  it('refuses where there is nothing to ask', () => {
    expect(listenUrl('spotify', '', 'II')).toBeNull()
    expect(listenUrl('spotify', 'Moderat', '')).toBeNull()
    expect(listenUrl('spotify', null, null)).toBeNull()
    expect(listenUrl('spotify', '   ', 'II')).toBeNull()
  })

  it('escapes what a title can contain', () => {
    const url = listenUrl('deezer', 'Aphex Twin', 'Come to Daddy / Flim')
    expect(url).toBe(
      'https://www.deezer.com/search/Aphex%20Twin%20Come%20to%20Daddy%20%2F%20Flim',
    )
  })

  it('has a name for every service the picker can offer', () => {
    for (const service of LISTEN_SERVICES) {
      if (service === 'none') continue
      expect(LISTEN_NAMES[service], service).toBeTruthy()
      expect(listenUrl(service, 'Moderat', 'II'), service).toMatch(/^https:\/\//)
    }
  })
})
