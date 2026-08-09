#!/usr/bin/env node
/**
 * DTCG tokens (tokens/*.json) → Tailwind 4 `@theme` block.
 *
 *   tokens/core.json      raw values
 *   tokens/semantic.json  roles, resolved per colour scheme via light-dark()
 *   tokens/component.json component-level decisions
 *
 * Output: app/assets/css/tokens.css, generated and git-ignored. Run via
 * `pnpm tokens:build`; `pnpm postinstall` does it for you.
 *
 * Two things DTCG cannot express and this build fills in:
 *
 *   fluid type   `$extensions["de.fidelity.fluid"]` carries the clamp() terms.
 *                The rem term is mandatory — a bare vw font-size breaks browser
 *                zoom (WCAG 1.4.4), so a missing one fails the build.
 *   colour scheme `$extensions["de.fidelity.dark"]` holds the dark counterpart
 *                of a role. Emitted as light-dark(), one declaration per token
 *                instead of a duplicated .dark block.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import StyleDictionary from 'style-dictionary'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const outFile = resolve(root, 'app/assets/css/tokens.css')

/**
 * Tailwind only generates utilities for variables sitting in one of its
 * namespaces, so a themed token is called `--<namespace>-fid-<path>`:
 * `--color-fid-sig-credit` yields `bg-fid-sig-credit`, `text-fid-sig-credit`
 * and the rest.
 *
 * `drop` removes the redundant leading group — `color.sig.credit` would
 * otherwise become `--color-fid-color-sig-credit`. `alias` does the same for
 * the short spelling used throughout docs/05-DESIGN-SYSTEM.md.
 *
 * Groups that are absent here (space, motion, chip, row, cover) are plain
 * custom properties: they generate no useful utility.
 */
const NAMESPACE = {
  color: { ns: 'color', drop: true, alias: true },
  role: { ns: 'color', drop: true, alias: true },
  radius: { ns: 'radius', drop: true, alias: false },
  font: { ns: 'font', drop: true, alias: false },
  text: { ns: 'text', drop: true, alias: false },
  elev: { ns: 'shadow', drop: false, alias: false },
}

/** Tailwind-namespaced name, e.g. `--color-fid-n-50`. */
const cssName = (token) => {
  const spec = NAMESPACE[token.path[0]]
  if (!spec) return `--fid-${token.path.join('-')}`
  const rest = spec.drop ? token.path.slice(1) : token.path
  return rest.length ? `--${spec.ns}-fid-${rest.join('-')}` : `--${spec.ns}-fid`
}

/** Documented short name, e.g. `--fid-n-50`, `--fid-bg`, `--fid-radius-sm`. */
const aliasName = (token) => {
  const spec = NAMESPACE[token.path[0]]
  const rest = spec?.alias ? token.path.slice(1) : token.path
  return rest.length ? `--fid-${rest.join('-')}` : '--fid'
}

const round = (n) => Number(n.toFixed(4))

function oklch({ components: [l, c, h], alpha }) {
  const base = `${round(l)} ${round(c)} ${round(h)}`
  return alpha === undefined || alpha === 1 ? `oklch(${base})` : `oklch(${base} / ${round(alpha)})`
}

const dimension = ({ value, unit }) => `${round(value)}${unit}`

StyleDictionary.registerTransform({
  name: 'fidelity/color',
  type: 'value',
  transitive: true,
  filter: (token) => token.$type === 'color' && typeof token.$value === 'object',
  transform: (token) => {
    if (token.$value.colorSpace !== 'oklch') {
      throw new Error(
        `${token.path.join('.')}: colour space "${token.$value.colorSpace}" — the system is OKLCH only.`,
      )
    }
    return oklch(token.$value)
  },
})

StyleDictionary.registerTransform({
  name: 'fidelity/dimension',
  type: 'value',
  transitive: true,
  filter: (token) =>
    (token.$type === 'dimension' || token.$type === 'duration') &&
    typeof token.$value === 'object' &&
    'unit' in token.$value,
  transform: (token) => {
    const fluid = token.$extensions?.['de.fidelity.fluid']
    if (!fluid) return dimension(token.$value)

    const { min, grow, slope } = fluid
    if (!(grow > 0)) {
      throw new Error(
        `${token.path.join('.')}: fluid step without a rem term. A vw-only font-size breaks browser zoom (WCAG 1.4.4).`,
      )
    }
    return `clamp(${round(min)}rem, ${round(grow)}rem + ${round(slope)}vw, ${dimension(token.$value)})`
  },
})

StyleDictionary.registerTransform({
  name: 'fidelity/font-family',
  type: 'value',
  filter: (token) => token.$type === 'fontFamily',
  transform: (token) =>
    [token.$value]
      .flat()
      .map((family) => (/\s/.test(family) ? `"${family}"` : family))
      .join(', '),
})

StyleDictionary.registerTransform({
  name: 'fidelity/shadow',
  type: 'value',
  filter: (token) => token.$type === 'shadow',
  transform: (token) =>
    [token.$value]
      .flat()
      .map(
        (s) =>
          `${dimension(s.offsetX)} ${dimension(s.offsetY)} ${dimension(s.blur)}` +
          `${s.spread && s.spread.value !== 0 ? ` ${dimension(s.spread)}` : ''} ${oklch(s.color)}`,
      )
      .join(', '),
})

const declaration = (token) => `  ${cssName(token)}: ${token.$value};`

StyleDictionary.registerFormat({
  name: 'fidelity/tailwind-theme',
  format: ({ dictionary }) => {
    const byName = new Map(dictionary.allTokens.map((t) => [t.path.join('.'), t]))
    const isRole = (t) => t.path[0] === 'role'

    /** `{color.n.990}` → `var(--color-fid-n-990)` */
    const varRef = (reference, owner) => {
      const path = reference.replace(/[{}]/g, '')
      const target = byName.get(path)
      if (!target) throw new Error(`${owner}: unknown reference {${path}}`)
      return `var(${cssName(target)})`
    }

    const themeTokens = dictionary.allTokens.filter((t) => NAMESPACE[t.path[0]])
    const looseTokens = dictionary.allTokens.filter((t) => !NAMESPACE[t.path[0]])

    const theme = themeTokens.map((token) => {
      if (!isRole(token)) return declaration(token)
      const dark = token.original.$extensions?.['de.fidelity.dark']
      if (!dark) throw new Error(`${token.path.join('.')}: role without a dark counterpart`)
      const light = varRef(token.original.$value, token.path.join('.'))
      return `  ${cssName(token)}: light-dark(${light}, ${varRef(dark, token.path.join('.'))});`
    })

    // Documented aliases. docs/05-DESIGN-SYSTEM.md spells these `--fid-n-50`,
    // `--fid-bg`, `--fid-radius-sm`; Tailwind needs its namespace prefixes.
    // Both spellings resolve to the same value.
    const aliases = themeTokens.map((t) => `  ${aliasName(t)}: var(${cssName(t)});`)

    return [
      '/* GENERATED by scripts/tokens/build.mjs from tokens/*.json. Do not edit. */',
      '',
      '@theme static {',
      ...theme,
      '}',
      '',
      ':root {',
      '  /* Dark first. The roles above resolve through this. */',
      '  color-scheme: light dark;',
      '',
      ...aliases,
      ...(looseTokens.length ? ['', ...looseTokens.map(declaration)] : []),
      '}',
      '',
    ].join('\n')
  },
})

const sd = new StyleDictionary({
  source: [resolve(root, 'tokens/*.json')],
  preprocessors: ['tokens-studio'],
  platforms: {
    css: {
      transforms: ['fidelity/color', 'fidelity/dimension', 'fidelity/font-family', 'fidelity/shadow'],
      files: [{ destination: 'tokens.css', format: 'fidelity/tailwind-theme' }],
    },
  },
  log: { verbosity: 'silent', warnings: 'warn' },
})

const [{ output }] = await sd.formatPlatform('css')
await mkdir(dirname(outFile), { recursive: true })
await writeFile(outFile, output, 'utf8')
console.log(`tokens → ${outFile.replace(`${root}/`, '')}`)
