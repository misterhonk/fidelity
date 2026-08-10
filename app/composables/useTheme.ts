/**
 * Hell, dunkel, oder was das Gerät sagt.
 *
 * The whole mechanism is already in the tokens: every semantic role is a
 * `light-dark()` pair and `:root` carries `color-scheme: light dark`, so the
 * palette follows the OS on its own. @nuxtjs/color-mode (which ships with Nuxt
 * UI) puts `.light` / `.dark` on <html>, main.css bridges those to
 * `color-scheme`, and that is the entire override.
 *
 * So this composable adds no colour logic. It names the three choices, and it
 * keeps the browser's own chrome — the address bar on Android, the status bar
 * in a standalone PWA — from staying dark when the app is not.
 */

export const THEMES = [
  {
    key: 'system',
    label: 'System',
    about: 'Folgt dem Gerät, samt automatischem Wechsel am Abend.',
  },
  { key: 'light', label: 'Hell', about: 'Für Tageslicht und für Papierlisten daneben.' },
  {
    key: 'dark',
    label: 'Dunkel',
    about: 'Die Voreinstellung. Cover leuchten auf dunklem Grund.',
  },
] as const

export type ThemeKey = (typeof THEMES)[number]['key']

/**
 * The two ends of the neutral ramp, as hex.
 *
 * `<meta name="theme-color">` is parsed before any stylesheet is applied, so it
 * cannot be a `var()` and cannot be `oklch()` on older WebKit. These are
 * `{color.n.50}` and `{color.n.990}` converted once; the token test keeps them
 * honest if the ramp ever moves.
 */
export const THEME_COLORS = { light: '#faf8f6', dark: '#050402' } as const

export function useTheme() {
  const mode = useColorMode()

  const preference = computed<ThemeKey>({
    get: () =>
      THEMES.some((t) => t.key === mode.preference) ? (mode.preference as ThemeKey) : 'system',
    set: (key) => {
      mode.preference = key
    },
  })

  /** What is actually on screen — 'system' resolved against the OS. */
  const resolved = computed<'light' | 'dark'>(() => (mode.value === 'light' ? 'light' : 'dark'))

  return { preference, resolved, themes: THEMES }
}
