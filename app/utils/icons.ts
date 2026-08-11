import { GLYPHS } from './glyphs'
import { LUCIDE } from './lucide.generated'

/**
 * One set, two origins.
 *
 * Lucide for the verbs every app shares — go back, search, download, throw
 * away — and hand-drawn glyphs for the nouns only this one has. Merging them
 * here means no caller has to know which is which, which is the point: to
 * somebody using the app it is one set or it is a mess.
 */
export const ICONS = { ...LUCIDE, ...GLYPHS }

export type IconName = keyof typeof ICONS
