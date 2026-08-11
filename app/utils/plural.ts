/**
 * Ein Wort, zur Zahl davor passend.
 *
 * There were five of these, each written where it was needed and three of them
 * wrong: "about 1 minutes", "1 postage tiers", "1 entries". Nobody
 * writes that on purpose — it happens because a template interpolates a number
 * in front of a word somebody typed in the plural, and the singular case only
 * shows up on the one screen where the number happens to be one.
 *
 * German needs no library for this. What it needs is one place, so a count and
 * its noun are decided together rather than five times over.
 */
export function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many
}

/** The count and its noun, which is what almost every call site wants. */
export function counted(count: number, one: string, many: string): string {
  return `${count} ${plural(count, one, many)}`
}
