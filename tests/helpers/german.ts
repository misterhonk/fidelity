import { readFileSync } from 'node:fs'

/**
 * Finding German in a comment, well enough to hold a rule to.
 *
 * Not a language detector — a word list. German function words are short,
 * frequent and almost all absent from English; three *different* ones inside
 * one comment is not something an English sentence writes by accident.
 *
 * The threshold is the whole design. A stricter one would flag an English
 * sentence that happens to quote a German phrase; a looser one would miss a
 * one-line German comment. Three catches every comment in
 * `german-comments.txt` and none of the English ones beside them — checked
 * against the whole tree, which is the only way to check a heuristic.
 */
/**
 * The handful that are also English words live in `OVERLAPPING` below rather
 * than in this comment — because a comment naming three of them is, by this
 * file's own rule, German. It flagged itself on 2026-09-11, which is a
 * cheerful way to learn the threshold works.
 */
const GERMAN =
  /\b(der|die|das|dem|den|des|ein|eine|einen|einem|einer|eines|und|oder|aber|nicht|nur|wenn|weil|dass|sich|wer|ist|sind|war|waren|hat|haben|wird|werden|kann|können|muss|müssen|soll|sollen|darf|dürfen|vom|zum|zur|beim|für|mit|nach|über|unter|durch|gegen|ohne|schon|noch|auch|dann|hier|dort|sonst|damit|deshalb|jede|jeder|jedes|keine|kein|alle|etwas|nichts|immer|wieder)\b/gi

/**
 * Words that are German *and* English. Some are in the list above and some are
 * not; either way, none of them alone may flag a comment, which is what the
 * threshold is for and what `english-comments.spec.ts` checks.
 *
 * As data rather than prose, so the scanner never reads them — a comment
 * naming three would, by this file's own rule, be German.
 */
export const OVERLAPPING = ['die', 'was', 'hat', 'war', 'also', 'man', 'in', 'so'] as const

/** How many different German function words make a comment German. */
export const THRESHOLD = 3

/**
 * Every comment in a source file, found by scanning rather than by matching.
 *
 * A regular expression over the raw text gets this wrong, and did: `hono`'s
 * route pattern `'/v1/*'` contains `/*`, which opens a comment that then runs
 * to the next `*\/` and swallows the real code and comments between. Found on
 * 2026-09-11 in `hub/src/app.ts`, where the invented span happened to contain
 * a German comment — so it was right for the wrong reason, which is the kind
 * of luck that runs out.
 *
 * So this walks the file once and knows which of four places it is in: code,
 * a string, a line comment, a block comment. Nothing inside a string is ever
 * a comment, and nothing inside a comment ever opens a string.
 */
export function comments(source: string, path: string): string[] {
  const found: string[] = []
  const html = path.endsWith('.vue')
  let i = 0

  while (i < source.length) {
    const two = source.slice(i, i + 2)

    if (two === '//') {
      const end = source.indexOf('\n', i)
      found.push(source.slice(i, end === -1 ? source.length : end))
      i = end === -1 ? source.length : end
    } else if (two === '/*') {
      const end = source.indexOf('*/', i + 2)
      found.push(source.slice(i, end === -1 ? source.length : end + 2))
      i = end === -1 ? source.length : end + 2
    } else if (html && source.startsWith('<!--', i)) {
      const end = source.indexOf('-->', i + 4)
      found.push(source.slice(i, end === -1 ? source.length : end + 3))
      i = end === -1 ? source.length : end + 3
    } else if (two[0] === "'" || two[0] === '"' || two[0] === '`') {
      i = skipString(source, i)
    } else {
      i += 1
    }
  }

  return found
}

/** Past the closing quote, escapes respected. Unterminated runs to the end. */
function skipString(source: string, start: number): number {
  const quote = source[start]
  let i = start + 1

  while (i < source.length) {
    if (source[i] === '\\') i += 2
    else if (source[i] === quote) return i + 1
    else i += 1
  }
  return source.length
}

/** The German comments in one file, empty when it is clean. */
export function germanComments(path: string): string[] {
  return comments(readFileSync(path, 'utf8'), path).filter((comment) => {
    const words = comment.match(GERMAN) ?? []
    return new Set(words.map((word) => word.toLowerCase())).size >= THRESHOLD
  })
}
