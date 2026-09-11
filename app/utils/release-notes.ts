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

export type Block = { kind: 'paragraph' | 'bullet'; pieces: Piece[] }

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
      out.push({ kind: 'paragraph', pieces: pieces(paragraph.join(' ')) })
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
