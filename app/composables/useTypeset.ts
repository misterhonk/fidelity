/**
 * Choosing a typeface in front of the thing it affects.
 *
 * A specimen answers the wrong question. What decides this is a hit list at
 * 13px, a shelf of catalogue numbers, and a headline over a dark screen — so
 * all three sets ship and the switch is reachable while browsing.
 *
 * Kept in localStorage rather than IndexedDB: it is a display preference, it
 * has to be readable before the first paint, and it has no business travelling
 * to another device in the vault.
 */
export const TYPESETS = [
  {
    key: 'kontor',
    label: 'Kontor',
    hint: 'General Sans · Chivo Mono · Clash Display',
    about: 'Warm und modern. Am nächsten an myplastic.app.',
  },
  {
    key: 'schweiz',
    label: 'Schweiz',
    hint: 'Switzer · JetBrains Mono',
    about: 'Ohne Display-Schrift. Hierarchie über Gewicht und Weißraum – die Rams-Antwort.',
  },
  {
    key: 'presswerk',
    label: 'Presswerk',
    hint: 'Switzer · Chivo Mono · Array',
    about: 'Technisch. Array ist schmal wie die Schrift auf einem Plattenrücken.',
  },
] as const

export type TypesetKey = (typeof TYPESETS)[number]['key']

const STORAGE_KEY = 'fidelity:typeset'
const DEFAULT: TypesetKey = 'kontor'

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
