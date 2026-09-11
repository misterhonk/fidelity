import { readFileSync } from 'node:fs'

/**
 * Finding German in a comment, well enough to hold a rule to.
 *
 * Not a language detector — a word list. German function words are short,
 * frequent and almost all absent from English; three *different* ones inside
 * one comment is not something an English sentence does by accident. The few
 * that overlap ("die", "was", "hat", "war", "also", "man", "in", "so") are
 * either left out or carried by the three-word threshold.
 *
 * The threshold is the whole design. A stricter test would flag "Der Wächter"
 * in an English sentence; a looser one would miss a one-line German comment.
 * Three catches every comment in `german-comments.txt` and none of the English
 * ones beside them — checked against the whole tree, which is the only way to
 * check a heuristic.
 */
const GERMAN =
  /\b(der|die|das|dem|den|des|ein|eine|einen|einem|einer|eines|und|oder|aber|nicht|nur|wenn|weil|dass|sich|wer|ist|sind|war|waren|hat|haben|wird|werden|kann|können|muss|müssen|soll|sollen|darf|dürfen|vom|zum|zur|beim|für|mit|nach|über|unter|durch|gegen|ohne|schon|noch|auch|dann|hier|dort|sonst|damit|deshalb|jede|jeder|jedes|keine|kein|alle|etwas|nichts|immer|wieder)\b/gi

/** How many different German function words make a comment German. */
export const THRESHOLD = 3

/**
 * Every comment in a source file.
 *
 * Line comments have to start the line — otherwise every `https://` inside a
 * string would be a comment. Block comments and HTML comments are taken as
 * they come; a `/* *\/` inside a template literal would be a false hit, and in
 * this tree there is none.
 */
export function comments(source: string, path: string): string[] {
  const found = [
    ...(source.match(/\/\*[\s\S]*?\*\//g) ?? []),
    ...(source.match(/^[ \t]*\/\/.*(?:\n[ \t]*\/\/.*)*/gm) ?? []),
  ]
  if (path.endsWith('.vue')) found.push(...(source.match(/<!--[\s\S]*?-->/g) ?? []))
  return found
}

/** The German comments in one file, empty when it is clean. */
export function germanComments(path: string): string[] {
  return comments(readFileSync(path, 'utf8'), path).filter((comment) => {
    const words = comment.match(GERMAN) ?? []
    return new Set(words.map((word) => word.toLowerCase())).size >= THRESHOLD
  })
}
