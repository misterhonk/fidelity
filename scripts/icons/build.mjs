#!/usr/bin/env node
/**
 * App icons, rendered from the design tokens.
 *
 * The icon is a record on a dark sleeve: the neutral ramp for the sleeve and
 * the disc, the Shellac accent for the label. Deriving the colours from
 * tokens/core.json rather than hard-coding them means the icon cannot drift
 * away from the rest of the system.
 *
 * Written by hand rather than with a rasteriser because the whole toolchain
 * for one static icon is not worth a dependency: a few circles into an RGBA
 * buffer and a PNG encoder over node:zlib do the job (`pnpm icons:build`,
 * also run by postinstall).
 *
 * Output: public/icons/*.png and public/icon.svg — generated, git-ignored.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

import { oklchToRgb, toHex } from '../tokens/color.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const outDir = resolve(root, 'public/icons')

// --- colour ----------------------------------------------------------------

// Shared with the contrast test, so the icon can never be drawn from a
// different interpretation of the tokens than the one we assert on.
// --- PNG encoding ----------------------------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // truecolour with alpha

  // One filter byte (0 = none) per scanline.
  const raw = Buffer.alloc(height * (1 + width * 4))
  for (let y = 0; y < height; y++) {
    const from = y * width * 4
    rgba.copy(raw, y * (1 + width * 4) + 1, from, from + width * 4)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// --- drawing ---------------------------------------------------------------

const SUPERSAMPLE = 4

/**
 * Renders the concentric circles at 4× and averages down. Anti-aliasing by
 * supersampling is the cheapest correct answer at these sizes.
 */
function render(size, discs, background) {
  const big = size * SUPERSAMPLE
  const centre = big / 2
  const sample = Buffer.alloc(big * big * 3)

  for (let y = 0; y < big; y++) {
    for (let x = 0; x < big; x++) {
      const distance = Math.hypot(x - centre + 0.5, y - centre + 0.5)
      let colour = background
      for (const disc of discs) {
        if (distance <= disc.radius * big) {
          colour = disc.colour
          break
        }
      }
      sample.set(colour, (y * big + x) * 3)
    }
  }

  const rgba = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const totals = [0, 0, 0]
      for (let dy = 0; dy < SUPERSAMPLE; dy++) {
        for (let dx = 0; dx < SUPERSAMPLE; dx++) {
          const at = ((y * SUPERSAMPLE + dy) * big + x * SUPERSAMPLE + dx) * 3
          totals[0] += sample[at]
          totals[1] += sample[at + 1]
          totals[2] += sample[at + 2]
        }
      }
      const n = SUPERSAMPLE * SUPERSAMPLE
      const at = (y * size + x) * 4
      rgba[at] = Math.round(totals[0] / n)
      rgba[at + 1] = Math.round(totals[1] / n)
      rgba[at + 2] = Math.round(totals[2] / n)
      rgba[at + 3] = 255
    }
  }

  return rgba
}

// --- main ------------------------------------------------------------------

const core = JSON.parse(await readFile(resolve(root, 'tokens/core.json'), 'utf8'))
const token = (group, step) => oklchToRgb(core.color[group][step].$value.components)

const sleeve = token('n', '990')
const disc = token('n', '900')
const groove = token('n', '800')
const label = token('accent', '500')

/**
 * Radii as a fraction of the icon. `scale` shrinks the artwork into the safe
 * zone a maskable icon needs — Android crops up to 20% off every edge.
 */
const artwork = (scale) => [
  { radius: 0.055 * scale, colour: sleeve }, // spindle hole
  { radius: 0.155 * scale, colour: label },
  { radius: 0.26 * scale, colour: disc },
  { radius: 0.275 * scale, colour: groove },
  { radius: 0.4 * scale, colour: disc },
]

const outputs = [
  { file: 'icon-192.png', size: 192, scale: 1 },
  { file: 'icon-512.png', size: 512, scale: 1 },
  { file: 'icon-maskable-512.png', size: 512, scale: 0.75 },
  { file: 'apple-touch-icon.png', size: 180, scale: 0.85 },
]

await mkdir(outDir, { recursive: true })

for (const { file, size, scale } of outputs) {
  const png = encodePng(size, size, render(size, artwork(scale), sleeve))
  await writeFile(resolve(outDir, file), png)
}

const circles = artwork(1)
  .slice()
  .reverse()
  .map(
    (d) =>
      `  <circle cx="256" cy="256" r="${(d.radius * 512).toFixed(1)}" fill="${toHex(d.colour)}"/>`,
  )
  .join('\n')

await writeFile(
  resolve(root, 'public/icon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Fidelity">
  <rect width="512" height="512" fill="${toHex(sleeve)}"/>
${circles}
</svg>
`,
  'utf8',
)

console.log(`icons → public/icons/ (${outputs.map((o) => o.file).join(', ')}), public/icon.svg`)
