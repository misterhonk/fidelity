import { shallowRef } from 'vue'

import en, { type Messages } from '~/i18n/en'

/**
 * Which language the interface speaks, and the words it speaks it in.
 *
 * English is the base and lives in the first paint; every other language is a
 * separate chunk fetched when somebody actually wants it (ADR-010). Nobody pays
 * for a language they do not read.
 *
 * There is no i18n library under this. What the app needs from one is a lookup
 * and a plural form, and the budget for the first paint has 6.8 kB left of 120
 * — vue-i18n does not fit in that, and would buy a message compiler, a locale
 * matcher and a directive that nothing here would call.
 *
 * Kept in localStorage rather than IndexedDB, for the same reason as the theme
 * and the typeface: it has to be readable before the first paint, and it has no
 * business travelling to another device in the vault. Somebody's phone is
 * allowed to be in German while their laptop is in English.
 */

/**
 * Every language, named in itself.
 *
 * Endonyms on purpose. Somebody looking for German in a list scans for
 * "Deutsch"; "German" is the word for people who already read English, which
 * is exactly the group that does not need the switch.
 */
export const LANGUAGES = {
  en: 'English',
  de: 'Deutsch',
} as const

export type Language = keyof typeof LANGUAGES

const DEFAULT: Language = 'en'
const STORAGE_KEY = 'fidelity:language'

const packs: Record<Language, () => Promise<Messages>> = {
  // Already in the bundle — this is the language the app boots in.
  en: () => Promise.resolve(en),
  de: () => import('~/i18n/de').then((module) => module.default),
}

/*
 * Module scope rather than `useState`.
 *
 * The active language is not only a component concern: the `Intl` formatters in
 * `app/utils/` are plain modules with no Nuxt context, and they need to know
 * which locale to print a price in. There is nothing to hydrate either — this
 * app does not render on a server.
 *
 * `shallowRef` is imported by name even though Nuxt auto-imports it, so this
 * module also loads in a plain Vitest process. That is not tidiness: the test
 * that catches a translation dropping its number imports this file directly.
 */
const language = shallowRef<Language>(DEFAULT)
const messages = shallowRef<Messages>(en)

/**
 * The words. Call it in `<script setup>` and read it in the template:
 *
 * ```vue
 * const m = useMessages()
 * // <h1>{{ m.appearance.title }}</h1>
 * ```
 *
 * A `shallowRef` holding the whole pack, so switching replaces one object and
 * every template that reads it re-renders. Deep reactivity over a few hundred
 * frozen strings would cost setup time and buy nothing — nothing ever writes to
 * a single message.
 */
export function useMessages() {
  return messages
}

/**
 * Which language is active, for the area packs.
 *
 * A plain read rather than the ref, so an area pack can call it inside its own
 * `computed()` without importing Vue's reactivity twice over. It is still a ref
 * underneath, so the dependency is tracked.
 */
export function activeLanguage(): Language {
  return language.value
}

/**
 * The tag to hand `Intl`.
 *
 * Not the language code: `de` and `de-DE` differ on nothing this app shows, but
 * `en` alone leaves the date order to the browser's guess, and that guess is
 * usually American. Each pack names its own tag.
 */
export function activeLocale(): string {
  return messages.value.meta.locale
}

let pending = 0

/**
 * Switch, and remember it.
 *
 * The counter guards the one race there is: two quick taps in the switch, the
 * slower fetch landing last and overwriting the newer choice.
 */
async function apply(next: Language) {
  await adopt(next)
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, next)
}

async function adopt(next: Language) {
  const attempt = ++pending
  const pack = await packs[next]()
  if (attempt !== pending) return

  messages.value = pack
  language.value = next
  if (typeof document !== 'undefined') document.documentElement.lang = next
}

/**
 * What the device asks for, in the order it asks.
 *
 * `navigator.languages` is a preference list: somebody with `['fr', 'de', 'en']`
 * would rather have German than English, and gets it. The region is dropped —
 * `de-AT` and `de-CH` read the same pack.
 */
function fromDevice(): Language {
  if (typeof navigator === 'undefined') return DEFAULT

  const asked = navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const tag of asked) {
    const base = tag.toLowerCase().split('-')[0]
    if (base && base in LANGUAGES) return base as Language
  }
  return DEFAULT
}

/**
 * The language for this visit: what was chosen before, else what the device
 * asks for, else English.
 *
 * Awaited by the plugin before the app mounts, so a German reader never sees a
 * frame of English. That costs them one small fetch before the first paint;
 * English readers, who are the default, pay nothing.
 */
async function restore() {
  const saved = typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY)
  await adopt(saved && saved in LANGUAGES ? (saved as Language) : fromDevice())
}

export function useLanguage() {
  return { current: language, apply, restore, languages: LANGUAGES }
}
