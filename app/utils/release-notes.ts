/**
 * Breaking a release's hand-written lead into something drawable.
 *
 * **Why not `v-html`, and why no Markdown library.** A parser weighs thirty
 * kilobytes and can do everything; what is needed is the four things that
 * actually occur in these paragraphs: bold runs, code in backticks, links and
 * bullet points. And `v-html` on text that goes through a build is a door
 * there is no need to open — this structures instead of inserting.
 *
 * **The text comes from `CHANGELOG.md`, at build time** (`nuxt.config.ts`),
 * and only the paragraph between the version heading and the first `###`. The
 * commit lists below it are written for the repository.
 */

export type Piece =
  | { kind: 'text'; text: string }
  | { kind: 'strong'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'link'; text: string; href: string }

/**
 * `action`: a paragraph that begins "What to do:" — the one line a release
 * may add that asks something of the reader (M24). Drawn as a call-out on
 * the what's-new screen, so it is not lost between two paragraphs of news.
 */
export type Block = { kind: 'paragraph' | 'bullet' | 'action'; pieces: Piece[] }

const ACTION = /^\*{0,2}(?:What to do|Was zu tun ist):\*{0,2}\s*/i

/**
 * Bold, code and links — in one pass, so that the order comes out right.
 *
 * Searched one after another, `**[text](url)**` would come out wrong: the bold
 * run would swallow the brackets. One expression, one round, no nesting —
 * there is none in these paragraphs, and if it ever occurred it would show up
 * as a visible asterisk rather than being silently wrong.
 */
const INLINE = /\*\*(.+?)\*\*|`(.+?)`|\[(.+?)\]\((\S+?)\)/g

export function pieces(line: string): Piece[] {
  const out: Piece[] = []
  let last = 0

  for (const hit of line.matchAll(INLINE)) {
    const at = hit.index
    if (at > last) out.push({ kind: 'text', text: line.slice(last, at) })

    const [whole, strong, code, linkText, href] = hit
    if (strong !== undefined) out.push({ kind: 'strong', text: strong })
    else if (code !== undefined) out.push({ kind: 'code', text: code })
    else if (linkText !== undefined && href !== undefined) {
      out.push({ kind: 'link', text: linkText, href })
    }

    last = at + whole.length
  }

  if (last < line.length) out.push({ kind: 'text', text: line.slice(last) })
  return out
}

/**
 * Paragraphs and bullet points.
 *
 * Line breaks inside a paragraph are pure typesetting in the changelog — the
 * file is wrapped at a hundred characters. They become spaces, because a
 * screen breaks differently from an editor.
 */
export function blocks(lead: string): Block[] {
  if (!lead.trim()) return []

  const out: Block[] = []
  let paragraph: string[] = []

  const closeParagraph = () => {
    if (paragraph.length > 0) {
      const text = paragraph.join(' ')
      out.push(
        ACTION.test(text)
          ? { kind: 'action', pieces: pieces(text.replace(ACTION, '')) }
          : { kind: 'paragraph', pieces: pieces(text) },
      )
      paragraph = []
    }
  }

  let bullet: string[] = []
  const closeBullet = () => {
    if (bullet.length > 0) {
      out.push({ kind: 'bullet', pieces: pieces(bullet.join(' ')) })
      bullet = []
    }
  }

  for (const line of lead.split('\n')) {
    const raw = line.trim()

    if (raw === '') {
      closeParagraph()
      closeBullet()
      continue
    }

    const bulletStart = raw.match(/^[-*]\s+(.*)$/)
    if (bulletStart) {
      closeParagraph()
      closeBullet()
      bullet.push(bulletStart[1]!)
      continue
    }

    // An indented continuation belongs to the bullet in progress, not to a new
    // paragraph — otherwise every multi-line bullet falls apart.
    if (bullet.length > 0 && /^\s/.test(line)) {
      bullet.push(raw)
      continue
    }

    closeBullet()
    paragraph.push(raw)
  }

  closeParagraph()
  closeBullet()
  return out
}

const SECTION = /^<!--\s*([a-z]{2})\s*-->\s*$/m

/**
 * The lead in the reader's language (#190).
 *
 * A lead may be written once per language, each part under a line
 * `<!-- en -->` or `<!-- de -->` — invisible on GitHub, so the changelog still
 * reads as one entry. Without such a part for the language, English; a lead
 * with no parts at all is shown as it is, which is how every lead before this
 * was written.
 */
export function leadIn(lead: string, language: string): string {
  const parts = lead.split(SECTION)
  if (parts.length === 1) return lead.trim()

  const byLanguage = new Map<string, string>()
  // split() with a group: [untagged, lang, text, lang, text, …]
  for (let i = 1; i < parts.length; i += 2) byLanguage.set(parts[i]!, parts[i + 1]!.trim())
  return byLanguage.get(language) ?? byLanguage.get('en') ?? ''
}
