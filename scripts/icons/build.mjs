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

/** Linear blend between two RGB triples. */
function mix(from, to, t) {
  const k = Math.max(0, Math.min(1, t))
  return [
    from[0] + (to[0] - from[0]) * k,
    from[1] + (to[1] - from[1]) * k,
    from[2] + (to[2] - from[2]) * k,
  ]
}

/** `over` laid on `under` at the given alpha. */
function over(under, colour, alpha) {
  return mix(under, colour, alpha)
}

const WHITE = [255, 255, 255]

/**
 * Renders at 4× and averages down. Anti-aliasing by supersampling is still the
 * cheapest correct answer at these sizes, and still needs no dependency.
 *
 * What changed on 2026-08-11 is what gets drawn. The icon used to be a black
 * record on a black tile, which measured 1.09 contrast between the disc and
 * its background — on a phone's home screen, usually a photograph, all that
 * survived was an orange dot in the void. Near-black on near-black cannot be
 * rescued by nudging greys, so figure and ground swapped: the tile carries the
 * accent, the record is the dark shape on it, and the label is a window back
 * to the tile.
 *
 * The colours still come from tokens/core.json. That was always the point of
 * generating this rather than drawing it once in an editor.
 */
function render(size, scale) {
  const big = size * SUPERSAMPLE
  const centre = big / 2
  const sample = Buffer.alloc(big * big * 3)

  const discR = 0.367 * scale * big
  const labelR = 0.148 * scale * big
  const holeR = 0.039 * scale * big
  // Four grooves, evenly spaced across the playing surface.
  const grooves = [0.328, 0.293, 0.258, 0.223].map((r) => r * scale * big)

  for (let y = 0; y < big; y++) {
    for (let x = 0; x < big; x++) {
      const dx = x - centre + 0.5
      const dy = y - centre + 0.5
      const distance = Math.hypot(dx, dy)

      // 1 — the tile: a diagonal fall across the accent, so it has a direction.
      let colour = mix(tileFrom, tileTo, (x / big) * 0.45 + (y / big) * 0.55)

      if (distance <= discR) {
        // 2 — the record, and the rings cut into it.
        colour = discColour
        for (const groove of grooves) {
          const off = Math.abs(distance - groove)
          if (off < 1.6 * SUPERSAMPLE) {
            colour = over(colour, WHITE, 0.07 * (1 - off / (1.6 * SUPERSAMPLE)))
          }
        }

        // 3 — the rim, where the edge of the disc turns to the light.
        const fromEdge = discR - distance
        if (fromEdge < 2.5 * SUPERSAMPLE) {
          colour = over(colour, WHITE, 0.14 * (1 - fromEdge / (2.5 * SUPERSAMPLE)))
        }

        // 4 — the sheen. Off-centre and very quiet: it is what makes vinyl
        // look like vinyl rather than like a black circle.
        const sx = x - big * 0.34
        const sy = y - big * 0.28
        const sheen = Math.max(0, 1 - Math.hypot(sx, sy) / (big * 0.62))
        colour = over(colour, WHITE, 0.16 * sheen * sheen)

        // 5 — the label, and the spindle hole through it.
        if (distance <= labelR) {
          colour = mix(labelFrom, labelTo, distance / labelR)
        }
        if (distance <= holeR) colour = discColour
      }

      sample.set(
        colour.map((c) => Math.round(c)),
        (y * big + x) * 3,
      )
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

/*
 * The tile runs from the light end of the accent to the dark one, so the icon
 * has a direction rather than a flat fill. The record is the neutral ramp's
 * darkest step — warm black, hue 70, the same black the app's own surfaces
 * are made of.
 */
const tileFrom = token('accent', '400')
const tileTo = token('accent', '700')
const discColour = token('n', '950')
const labelFrom = token('accent', '400')
const labelTo = token('accent', '600')

const outputs = [
  { file: 'icon-192.png', size: 192, scale: 1 },
  { file: 'icon-512.png', size: 512, scale: 1 },
  // Android crops up to 20% off every edge of a maskable icon, and the crop
  // shape is the launcher's choice. The tile survives it; the record must not
  // have to.
  { file: 'icon-maskable-512.png', size: 512, scale: 0.78 },
  { file: 'apple-touch-icon.png', size: 180, scale: 0.92 },
]

await mkdir(outDir, { recursive: true })

for (const { file, size, scale } of outputs) {
  await writeFile(resolve(outDir, file), encodePng(size, size, render(size, scale)))
}

/*
 * The SVG is the same drawing said declaratively — it is what the favicon and
 * the in-app wordmark use, where a gradient costs nothing and a 512×512 PNG
 * would be absurd.
 */
const hex = (c) => toHex(c.map((v) => Math.round(v)))

await writeFile(
  resolve(root, 'public/icon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Fidelity">
  <defs>
    <linearGradient id="tile" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${hex(tileFrom)}"/>
      <stop offset="1" stop-color="${hex(tileTo)}"/>
    </linearGradient>
    <radialGradient id="sheen" cx="0.34" cy="0.28" r="0.75">
      <stop offset="0" stop-color="#fff" stop-opacity="0.16"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="label" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${hex(labelFrom)}"/>
      <stop offset="1" stop-color="${hex(labelTo)}"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" fill="url(#tile)"/>
  <circle cx="256" cy="256" r="188" fill="${hex(discColour)}"/>
  <g fill="none" stroke="#fff" stroke-opacity="0.07" stroke-width="2">
    <circle cx="256" cy="256" r="168"/>
    <circle cx="256" cy="256" r="150"/>
    <circle cx="256" cy="256" r="132"/>
    <circle cx="256" cy="256" r="114"/>
  </g>
  <circle cx="256" cy="256" r="187" fill="none" stroke="#fff" stroke-opacity="0.14" stroke-width="2"/>
  <circle cx="256" cy="256" r="188" fill="url(#sheen)"/>
  <circle cx="256" cy="256" r="76" fill="url(#label)"/>
  <circle cx="256" cy="256" r="20" fill="${hex(discColour)}"/>
</svg>
`,
  'utf8',
)

console.log(`icons → public/icons/ (${outputs.map((o) => o.file).join(', ')}), public/icon.svg`)
