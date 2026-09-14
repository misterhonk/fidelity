/**
 * One tap from a find to the music (M31).
 *
 * "I want to hear the music it suggests." The stack has had a preview since
 * M15 — YouTube, off by default, ADR-012 — and that ADR already names this as
 * what happens without the switch: *"Only link out. No embed, no Google on our
 * page; the user goes there themselves."* It rejected link-out as the *stack's*
 * behaviour, because leaving the app for every card ends the swiping. Away
 * from the stack it is exactly right, and it is what somebody deciding about a
 * record on the detail sheet wants.
 *
 * **A search, and the screen says so.** Fidelity cannot know Spotify's id for a
 * record without asking Spotify, and asking needs an account, a key and a
 * round trip. What it can do is hand over the artist and the title, which is
 * what somebody would type anyway. No request, no key, no account, and nothing
 * leaves the device until a link is tapped — the same standing as the "at
 * Discogs" link that has always been there.
 */

export const LISTEN_SERVICES = [
  'none',
  'spotify',
  'apple',
  'tidal',
  'deezer',
  'youtube',
] as const

export type ListenService = (typeof LISTEN_SERVICES)[number]

/** What each one calls itself, for the picker and for the button. */
export const LISTEN_NAMES: Record<Exclude<ListenService, 'none'>, string> = {
  spotify: 'Spotify',
  apple: 'Apple Music',
  tidal: 'TIDAL',
  deezer: 'Deezer',
  youtube: 'YouTube Music',
}

/**
 * Where each service takes a search.
 *
 * Public addresses, not API endpoints: nothing here is authenticated and
 * nothing here is fetched. A service that changes its search path breaks one
 * link and nothing else, which is the whole reason this is six lines rather
 * than six integrations.
 */
const SEARCH: Record<Exclude<ListenService, 'none'>, (query: string) => string> = {
  spotify: (q) => `https://open.spotify.com/search/${encodeURIComponent(q)}`,
  apple: (q) => `https://music.apple.com/search?term=${encodeURIComponent(q)}`,
  tidal: (q) => `https://tidal.com/search?q=${encodeURIComponent(q)}`,
  deezer: (q) => `https://www.deezer.com/search/${encodeURIComponent(q)}`,
  youtube: (q) => `https://music.youtube.com/search?q=${encodeURIComponent(q)}`,
}

/**
 * The search address for one record, or `null` where there is nothing to ask.
 *
 * Null rather than a bare artist or a bare title: a search for "Various" or for
 * "Untitled" lands on somebody else's record, and a button that promises the
 * music and delivers a stranger's is worse than no button.
 */
export function listenUrl(
  service: ListenService,
  artist: string | null | undefined,
  title: string | null | undefined,
): string | null {
  if (service === 'none') return null

  /*
   * Discogs disambiguates identical names with a trailing number — "Nirvana
   * (2)" is a different band from Nirvana, and the app is careful never to
   * strip that (docs/04). A streaming service has never heard of it, so it
   * comes off here and only here, on the way out.
   */
  const name = (artist ?? '').replace(/\s*\(\d+\)\s*$/, '').trim()
  const album = (title ?? '').trim()
  if (name.length === 0 || album.length === 0) return null

  return SEARCH[service](`${name} ${album}`)
}

/**
 * Which clip belongs to which track (M31.5).
 *
 * Discogs' video titles almost always carry the track's name — "Caribou -
 * Can't Do Without You (Extended Mix) [HD]" under the track "Can't Do Without
 * You". Hanging the clips on the tracklist instead of listing them beside it
 * is what turns a page of facts into a record: the tracks that have something
 * to hear get a play control, and the rest of the list still reads as a
 * tracklist.
 *
 * **Whole words, longest title first, each clip used once.** Substring
 * matching would give "Love" the clip for "Our Love"; going from the longest
 * title down means the longer name claims its clip before the shorter one can,
 * and a clip that has been taken is out of the running. What is left over is
 * handed back rather than dropped — a live take or an album rip is still worth
 * offering, just not as a track.
 */
function plain(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
}

/** `haystack` contains `needle` as a run of whole words. */
function runs(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0) return false
  for (let start = 0; start + needle.length <= haystack.length; start += 1) {
    if (needle.every((word, offset) => haystack[start + offset] === word)) return true
  }
  return false
}

/**
 * Four letters at least, across the whole title.
 *
 * "A1", "II" and "Intro" are positions and conventions rather than names, and
 * a two-letter title matches half the clips on any record.
 */
const SHORTEST = 4

export interface Clip {
  title: string
  uri: string
}

export interface ClipsOnTracks {
  /** One entry per track, in the tracklist's order. `null` where nothing fits. */
  perTrack: (Clip | null)[]
  /** Everything no track claimed — offered underneath, as recordings. */
  rest: Clip[]
}

export function clipsOnTracks(tracks: { title: string }[], clips: Clip[]): ClipsOnTracks {
  const perTrack: (Clip | null)[] = tracks.map(() => null)
  const taken = new Set<number>()

  const words = clips.map((clip) => plain(clip.title))
  const byLength = tracks
    .map((track, index) => ({ index, needle: plain(track.title) }))
    .sort((a, b) => b.needle.join(' ').length - a.needle.join(' ').length)

  for (const { index, needle } of byLength) {
    if (needle.join('').length < SHORTEST) continue

    const found = words.findIndex((clip, at) => !taken.has(at) && runs(clip, needle))
    if (found < 0) continue

    taken.add(found)
    perTrack[index] = clips[found] ?? null
  }

  return { perTrack, rest: clips.filter((_, at) => !taken.has(at)) }
}
