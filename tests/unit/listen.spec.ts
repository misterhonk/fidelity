import { describe, expect, it } from 'vitest'

import { clipsOnTracks, LISTEN_NAMES, LISTEN_SERVICES, listenUrl } from '#shared/listen'

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

/**
 * The clips hang on the tracklist (M31.5).
 *
 * Discogs' video titles almost always carry the track's name, so the tracks
 * that have something to hear can carry a play control — which is what turns a
 * page of facts into a record.
 */
describe('clips on tracks', () => {
  const OUR_LOVE = [
    { title: "Can't Do Without You" },
    { title: 'Silver' },
    { title: 'All I Ever Need' },
    { title: 'Our Love' },
    { title: 'Dive' },
  ]

  it('puts each clip on the track it names', () => {
    const { perTrack, rest } = clipsOnTracks(OUR_LOVE, [
      { title: "Caribou - Can't Do Without You (Extended Mix) [HD]", uri: 'a' },
      { title: 'Caribou - Silver', uri: 'b' },
      { title: 'CARIBOU - Dive', uri: 'c' },
    ])

    expect(perTrack.map((clip) => clip?.uri ?? null)).toEqual(['a', 'b', null, null, 'c'])
    expect(rest).toEqual([])
  })

  /**
   * The trap this is built around: "Our Love" contains "Love", and a plain
   * substring match would hand the album's title track to whichever row asked
   * first. Longest title first, and a taken clip is out of the running.
   */
  it('gives a clip to the longest title that fits it', () => {
    const { perTrack } = clipsOnTracks(
      [{ title: 'Love' }, { title: 'Our Love' }],
      [{ title: 'Caribou - Our Love', uri: 'x' }],
    )

    expect(perTrack[1]?.uri).toBe('x')
    expect(perTrack[0]).toBeNull()
  })

  /** What no track claimed is handed back, not dropped. */
  it('hands back the recordings that belong to no track', () => {
    const { perTrack, rest } = clipsOnTracks(OUR_LOVE, [
      { title: 'Caribou - Silver', uri: 'b' },
      { title: 'Caribou live at Primavera 2015', uri: 'live' },
    ])

    expect(perTrack[1]?.uri).toBe('b')
    expect(rest.map((clip) => clip.uri)).toEqual(['live'])
  })

  /** Positions and conventions are not names. */
  it('refuses to match on a title too short to be one', () => {
    const { perTrack, rest } = clipsOnTracks(
      [{ title: 'A1' }, { title: 'II' }],
      [{ title: 'Some Artist - A1 Something', uri: 'a' }],
    )

    expect(perTrack).toEqual([null, null])
    expect(rest).toHaveLength(1)
  })

  it('reads through punctuation and accents', () => {
    const { perTrack } = clipsOnTracks(
      [{ title: 'Où est la femme' }],
      [{ title: 'Various — "Ou est la femme" (1979)', uri: 'u' }],
    )

    expect(perTrack[0]?.uri).toBe('u')
  })

  it('has nothing to say about a record with no tracklist', () => {
    expect(clipsOnTracks([], [{ title: 'x', uri: 'x' }])).toEqual({
      perTrack: [],
      rest: [{ title: 'x', uri: 'x' }],
    })
  })
})
