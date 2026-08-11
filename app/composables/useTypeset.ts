/**
 * Which of the three type sets is in use.
 *
 * All three stayed in after the choice was made, deliberately: a collection
 * looks different on a Tuesday than it did the afternoon somebody picked, and
 * there is no cost to keeping the switch beyond the CSS that is already there.
 *
 * Kept in localStorage rather than IndexedDB: it is a display preference, it
 * has to be readable before the first paint, and it has no business travelling
 * to another device in the vault.
 */
/*
 * The name and the faces stay here; the sentence describing each set lives in
 * the message packs (`m.appearance.type`). "Presswerk" is a name, not a word to
 * be translated, and a list of typefaces reads the same in every language.
 */
export const TYPESETS = [
  { key: 'presswerk', label: 'Presswerk', hint: 'Switzer · Chivo Mono · Array' },
  { key: 'kontor', label: 'Kontor', hint: 'General Sans · Chivo Mono · Clash Display' },
  { key: 'schweiz', label: 'Schweiz', hint: 'Switzer · JetBrains Mono' },
] as const

export type TypesetKey = (typeof TYPESETS)[number]['key']

const STORAGE_KEY = 'fidelity:typeset'
const DEFAULT: TypesetKey = 'presswerk'

export function useTypeset() {
  const current = useState<TypesetKey>('typeset', () => DEFAULT)

  function apply(key: TypesetKey) {
    current.value = key
    if (typeof document === 'undefined') return
    document.documentElement.dataset.type = key
    localStorage.setItem(STORAGE_KEY, key)
  }

  function restore() {
    if (typeof document === 'undefined') return
    const saved = localStorage.getItem(STORAGE_KEY) as TypesetKey | null
    const key = TYPESETS.some((set) => set.key === saved) ? saved! : DEFAULT
    current.value = key
    document.documentElement.dataset.type = key
  }

  return { current, apply, restore, sets: TYPESETS }
}
