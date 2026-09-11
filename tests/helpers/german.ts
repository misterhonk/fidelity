import { readFileSync } from 'node:fs'

/**
 * German function words that are **not** also English words.
 *
 * The first version of this list carried `die`, `was`, `hat`, `war`, `also`,
 * `man`, `in` and `so` as well, and needed three distinct hits before it would
 * call a comment German — because with those eight in, one or two hits is an
 * ordinary English sentence. That threshold was the hole: most comments in this
 * codebase are a line or two, a short German one carries one or two function
 * words, and 130 of them sat in the tree while the guard reported none.
 *
 * Dropping the eight ambiguous words buys the threshold back. One unambiguous
 * German function word is decisive, so one is the bar.
 */
export const GERMAN =
  /\b(der|das|dem|den|des|ein|eine|einen|einem|einer|eines|und|oder|aber|nicht|nur|wenn|weil|dass|sich|wer|ist|sind|waren|haben|wird|werden|kann|können|muss|müssen|soll|sollen|darf|dürfen|vom|zum|zur|beim|für|mit|nach|über|unter|durch|gegen|ohne|schon|noch|auch|dann|hier|dort|sonst|damit|deshalb|jede|jeder|jedes|keine|kein|alle|etwas|nichts|immer|wieder)\b/gi

/**
 * Quoted spans do not count.
 *
 * An English comment is allowed to quote German — `worker/dig/scan.ts` says
 * where a "nur das Neue" run stops, and that sentence is English. Without this,
 * a rule strict enough to catch a one-line German comment would punish every
 * comment that names one.
 */
const QUOTED = /„[^“”"]*[“”"]|"[^"]*"|«[^»]*»|`[^`]*`|'[^']*'/g

/** How many different German function words make a comment German. */
export const THRESHOLD = 1

/**
 * An all-capital word is an acronym, not German.
 *
 * `MIT` in the Lucide licence header matched `mit` and made the one English
 * comment in a generated file look German. Nothing in German prose is written
 * in capitals throughout; everything that is, is a name or a constant.
 */
const SHOUTED = (word: string) => word.length > 1 && word === word.toUpperCase()

/** A `/` here starts a regex literal rather than dividing. */
const DIVIDES = /[\w$)\]]/

/**
 * Every comment in a source file, found by walking it once.
 *
 * A regular expression over the raw text gets this wrong, and did twice.
 *
 * **First:** `hono`'s route pattern `'/v1/*'` contains `/*`, which opens a
 * comment that then runs to the next `*\/` and swallows the real code and
 * comments between. That is why this walk knows about strings.
 *
 * **Then, in the same way:** a *regex literal* containing a quote — say
 * `/'([^']*)'/` — opened a phantom string, and everything after it in the file
 * became invisible. Nine German comments hid behind that in four files while
 * the guard was green. So the walk knows about regex literals too, which is
 * the last delimiter kind JavaScript has.
 *
 * Consecutive `//` lines merge into one comment. They are one paragraph to a
 * reader, and counting them separately let a German sentence split across two
 * lines fall under any threshold.
 *
 * `<!--` counts everywhere rather than only in `.vue`, which is what the twelve
 * hand-written strippers this replaces already did. Nothing outside a string or
 * a regex writes it in TypeScript, and the walk skips both.
 */
export function comments(source: string): string[] {
  return spans(source).map(([from, to]) => source.slice(from, to))
}

/**
 * The same file with its comments removed.
 *
 * Twelve specs had their own `code()` doing this with three `.replace()` calls,
 * and every one of them carried the bug above: a `/*` inside a string or a
 * quote inside a regex swallows the code between. They assert `not.toMatch(…)`
 * over the result, so a swallowed span makes them pass — the failure mode that
 * cannot be seen from a green run.
 */
export function withoutComments(source: string): string {
  let out = ''
  let at = 0
  for (const [from, to] of spans(source)) {
    out += source.slice(at, from)
    at = to
  }
  return out + source.slice(at)
}

function spans(source: string): [number, number][] {
  const found: [number, number][] = []
  let i = 0
  let previous = ' '

  while (i < source.length) {
    const two = source.slice(i, i + 2)

    if (two === '//') {
      const end = source.indexOf('\n', i)
      const stop = end === -1 ? source.length : end
      const last = found.at(-1)
      // Only merge with a run directly above — blank lines and code break it.
      if (last && source[last[1]] === '\n' && source.slice(last[1], i).trim() === '') {
        last[1] = stop
      } else {
        found.push([i, stop])
      }
      i = stop
    } else if (two === '/*') {
      const end = source.indexOf('*/', i + 2)
      const stop = end === -1 ? source.length : end + 2
      found.push([i, stop])
      i = stop
    } else if (source.startsWith('<!--', i) && source.includes('-->', i + 4)) {
      // Unterminated, it is not a comment. `/*` without `*/` means a broken
      // file; a stray `<!--` in TypeScript is legal arithmetic, and swallowing
      // the rest of the file for it is the very failure this walk exists to
      // avoid.
      const stop = source.indexOf('-->', i + 4) + 3
      found.push([i, stop])
      i = stop
    } else if (source[i] === "'" || source[i] === '"' || source[i] === '`') {
      i = skipDelimited(source, i, source[i]!)
      previous = 'x'
    } else if (source[i] === '/' && !DIVIDES.test(previous)) {
      i = skipRegex(source, i)
      previous = 'x'
    } else {
      if (!/\s/.test(source[i]!)) previous = source[i]!
      i += 1
    }
  }

  return found
}

/** Past the closing quote, escapes respected. Unterminated runs to the end. */
function skipDelimited(source: string, start: number, quote: string): number {
  let i = start + 1
  while (i < source.length) {
    if (source[i] === '\\') i += 2
    else if (source[i] === quote) return i + 1
    else i += 1
  }
  return source.length
}

/** Past the closing `/`. A `/` inside a character class does not close it. */
function skipRegex(source: string, start: number): number {
  let i = start + 1
  let inClass = false
  while (i < source.length) {
    const c = source[i]
    if (c === '\\') i += 2
    else if (c === '\n') return i
    else if (c === '/' && !inClass) return i + 1
    else {
      if (c === '[') inClass = true
      else if (c === ']') inClass = false
      i += 1
    }
  }
  return source.length
}

/** The German comments in one file, empty when it is clean. */
export function germanComments(path: string): string[] {
  return comments(readFileSync(path, 'utf8')).filter((comment) => {
    const words = (comment.replace(QUOTED, ' ').match(GERMAN) ?? []).filter(
      (word) => !SHOUTED(word),
    )
    return new Set(words.map((word) => word.toLowerCase())).size >= THRESHOLD
  })
}
