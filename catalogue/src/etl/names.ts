/**
 * The name fold, the same as `norm` in `worker/match/normalize.ts` — and held
 * to it by `tests/unit/catalogue-twins.spec.ts`, for the reason `catno.ts`
 * gives. `artist_name.name_norm` is what `resolve` looks up, and the app asks
 * with a string it folded itself: the two folds have to be one fold.
 */
const STANDALONE: Record<string, string> = {
  ø: 'o',
  æ: 'ae',
  œ: 'oe',
  ß: 'ss',
  đ: 'd',
  ð: 'd',
  ł: 'l',
  þ: 'th',
  ħ: 'h',
  ı: 'i',
}

const LEADING_ARTICLE = /^(the|die|der|das|les|los|la|le)\s+/

export function norm(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[øæœßđðłþħı]/g, (char) => STANDALONE[char] ?? char)
    .replace(LEADING_ARTICLE, '')
    .replace(/[^a-z0-9()& ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
