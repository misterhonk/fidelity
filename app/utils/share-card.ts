import type { SharedFind } from '#shared/types'

import { labelColour } from './sleeve'

/**
 * One find as a picture (#250): the label sleeve, the record and why it fits.
 *
 * Drawn on the device, from shapes and words only. **No cover art, ever**: a
 * Discogs image may not travel into a chat history, and a cover fetched for a
 * picture would be the active image fetch the app never makes (docs/02). The
 * sleeve from #220 stands in, coloured from the label name as everywhere else.
 *
 * What it is handed is a `SharedFind` — what the worker already cleaned for a
 * link (`worker/share.ts`): no price, no condition, no seller. The licence
 * notice is drawn into the picture, since a picture carries no link; the link
 * goes into the text that travels beside it.
 */

export const CARD_SIZE = 1080
const MARGIN = 72
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif'
const BACKGROUND = '#f4f1ea'
const INK = '#1b1a18'
const MUTED = '#5c5852'
const SLEEVE = '#26241f'

export interface CardText {
  /** The reason sentence, in the reader's language. */
  reason: string
  /** "Data provided by Discogs", in the reader's language. */
  credit: string
  brand: string
}

type Context = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

/** Breaks text into lines no wider than `width`, at spaces. */
function wrap(ctx: Context, text: string, width: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word
    if (line && ctx.measureText(next).width > width) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

/** Draws lines from `y` down, at most `max` of them, and says where it stopped. */
function lines(ctx: Context, text: string, y: number, size: number, max: number): number {
  const width = CARD_SIZE - 2 * MARGIN
  const all = wrap(ctx, text, width)
  const shown = all.slice(0, max)
  if (all.length > max) shown[max - 1] = `${shown[max - 1]} …`
  for (const line of shown) {
    ctx.fillText(line, MARGIN, y, width)
    y += size * 1.25
  }
  return y
}

export function drawShareCard(ctx: Context, find: SharedFind, text: CardText): void {
  ctx.fillStyle = BACKGROUND
  ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE)

  // The sleeve: a dark square with the label showing through its round cut.
  const side = 440
  const cx = CARD_SIZE / 2
  const cy = MARGIN + side / 2
  ctx.fillStyle = SLEEVE
  ctx.fillRect(cx - side / 2, MARGIN, side, side)
  const colour = labelColour(find.label)
  ctx.fillStyle = colour.paper
  ctx.beginPath()
  ctx.arc(cx, cy, side * 0.32, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = colour.ink
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const labelWidth = side * 0.5
  if (find.label) {
    ctx.font = `600 30px ${FONT}`
    ctx.fillText(find.label, cx, cy - (find.catno ? 20 : 0), labelWidth)
  }
  if (find.catno) {
    ctx.font = `24px ${FONT}`
    ctx.fillText(find.catno, cx, cy + (find.label ? 22 : 0), labelWidth)
  }

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  let y = MARGIN + side + 90
  ctx.fillStyle = INK
  ctx.font = `700 48px ${FONT}`
  y = lines(ctx, [find.artist, find.title].filter(Boolean).join(' – '), y, 48, 2)

  ctx.fillStyle = MUTED
  ctx.font = `28px ${FONT}`
  const facts = [find.format, find.year].filter(Boolean).join(' · ')
  if (facts) y = lines(ctx, facts, y, 28, 1)

  ctx.fillStyle = INK
  ctx.font = `36px ${FONT}`
  lines(ctx, text.reason, y + 24, 36, 4)

  // The licence notice, in the picture: it travels wherever the picture does.
  ctx.fillStyle = MUTED
  ctx.font = `26px ${FONT}`
  ctx.fillText(text.credit, MARGIN, CARD_SIZE - MARGIN)
  ctx.textAlign = 'right'
  ctx.font = `600 26px ${FONT}`
  ctx.fillText(text.brand, CARD_SIZE - MARGIN, CARD_SIZE - MARGIN)
}

/** The card as a PNG file, ready for the share sheet. Null where canvas fails. */
export async function shareCardFile(find: SharedFind, text: CardText): Promise<File | null> {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = CARD_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  drawShareCard(ctx, find, text)
  const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/png'))
  return blob ? new File([blob], 'sleeveside-find.png', { type: 'image/png' }) : null
}
