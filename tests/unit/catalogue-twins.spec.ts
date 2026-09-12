import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { parseCatno as catalogueCatno } from '~~/catalogue/src/etl/catno'
import { norm as catalogueNorm } from '~~/catalogue/src/etl/names'
import { ROLE_TABLE as CATALOGUE_ROLES } from '~~/catalogue/src/etl/roles'
import { ROLE_TABLE } from '#shared/types'
import { parseCatno } from '~~/worker/horizon/pack'
import { norm } from '~~/worker/match/normalize'

/**
 * Two copies, one behaviour (docs/16 §4).
 *
 * The catalogue runs on bare Node and cannot import the app's modules, so it
 * carries its own `parseCatno` and `norm`. A label run computed on the server
 * and one computed in the browser must never disagree on a single number,
 * and the lexicon must fold a name exactly as the app folds the string it
 * asks with — so the two copies are run over the mini-dump's real values
 * here, side by side, and a change to one without the other fails this file.
 */
const golden = <T>(name: string): T =>
  JSON.parse(readFileSync(`catalogue/test/golden/${name}.json`, 'utf8')) as T

describe('the catalogue and the app agree', () => {
  it('on every catalogue number in the mini-dump', () => {
    const rows = golden<{ catno: string }[]>('catnos')
    expect(rows.length).toBeGreaterThan(300)
    for (const { catno } of rows) expect(catalogueCatno(catno)).toEqual(parseCatno(catno))
  })

  it('on the edges of the catalogue number', () => {
    for (const catno of ['BLP 4058', 'blp-4058 lp', 'SK032', '12FJ 002', '', 'none', '0-44555'])
      expect(catalogueCatno(catno)).toEqual(parseCatno(catno))
  })

  it('on every artist name in the mini-dump', () => {
    const rows = golden<{ name: string }[]>('names')
    expect(rows.length).toBeGreaterThan(500)
    for (const { name } of rows) expect(catalogueNorm(name)).toBe(norm(name))
  })

  it('on the letters the fold has to know by name', () => {
    for (const name of [
      'Røyksopp',
      'Die Ärzte',
      'Björk',
      'Nirvana (2)',
      'Simon & Garfunkel',
      'İlhan',
    ])
      expect(catalogueNorm(name)).toBe(norm(name))
  })

  it('on the role table, index for index', () => {
    expect([...CATALOGUE_ROLES]).toEqual([...ROLE_TABLE])
  })
})
