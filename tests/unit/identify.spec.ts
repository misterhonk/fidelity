import { readFileSync } from 'node:fs'

import { beforeEach, describe, expect, it } from 'vitest'

import { withoutComments } from '../helpers/german'

import { openFidelityDb } from '~~/db/open'
import { cleanBarcode, identify, identifyByRunout, looksLikeBarcode } from '~~/worker/identify'
import type { CollectionItem } from '#shared/types'

/**
 * Recognising a record you are holding (M13, stage 1).
 *
 * **The finding that shapes this screen: a barcode is not unique.** Measured
 * against the real API on 2026-09-11 — `5012394144777` returns eight releases
 * across five countries, and the release the barcode came from is seventh. A
 * barcode names a release, not a pressing.
 *
 * For "do I already have this?" that is no problem, quite the opposite. It
 * only becomes one the moment the interface shows a single hit as *the*
 * answer — which is why the last block here holds that it does not.
 */
const platte = (releaseId: number, instanceId: number): CollectionItem => ({
  releaseId,
  instanceId,
  folderId: 1,
  masterId: 0,
  title: 'Never Gonna Give You Up',
  artistIds: [],
  artistNames: ['Rick Astley'],
  artistNorms: ['rick astley'],
  labelIds: [],
  labelNames: ['RCA'],
  labelNorms: ['rca'],
  catnos: [],
  genres: [],
  styles: [],
  formats: ['Vinyl'],
  year: 1987,
  rating: 0,
  thumbUrl: '',
  coverUrl: '',
  addedAt: '2020-01-01T00:00:00-00:00',
})

/** The eight real ids from the measurement of 2026-09-11. */
const ACHT = [6778478, 3396037, 3805964, 6154790, 9138092, 12442839, 249504, 1260449]

const client = {
  get: async () => ({
    results: ACHT.map((id, i) => ({
      id,
      title: 'Rick Astley - Never Gonna Give You Up',
      year: 1987,
      country: ['UK', 'Italy', 'France', 'Portugal', 'Europe'][i % 5],
      thumb: '',
      format: ['Vinyl', '7"'],
      label: ['RCA', 'BMG Records (UK) Ltd.'],
      catno: 'PB 41447',
    })),
  }),
} as never

beforeEach(async () => {
  const db = await openFidelityDb()
  await db.clear('collection')
  await db.clear('wantlist')
})

describe('reading a barcode', () => {
  it('keeps only the digits a scanner should have given', () => {
    expect(cleanBarcode('5012394144777')).toBe('5012394144777')
    // Scanners and people hand over spaces and hyphens too.
    expect(cleanBarcode(' 501 239-414 4777 ')).toBe('5012394144777')
  })

  it('refuses what cannot be a barcode on a record', () => {
    expect(cleanBarcode('42')).toBeNull()
    expect(cleanBarcode('kein barcode')).toBeNull()
    expect(cleanBarcode('1'.repeat(20))).toBeNull()
  })
})

/**
 * Which kind of number was typed there?
 *
 * Checked as a function and not against the source: a mutation probe showed
 * that a test only looking for `identify.barcode` and `identify.runout` in the
 * template never sees the decision — nailed to `true` it stayed green, and
 * then every run-out would have been looked up as a barcode.
 */
describe('telling the two apart', () => {
  it('reads digits as a barcode, even written as they stand on the sleeve', () => {
    expect(looksLikeBarcode('807297164718')).toBe(true)
    expect(looksLikeBarcode('8 07297 1647 1 8')).toBe(true)
    expect(looksLikeBarcode(' 501-239-414 ')).toBe(true)
  })

  it('reads anything with letters as a run-out', () => {
    expect(looksLikeBarcode('MPO SK 032 A1')).toBe(false)
    expect(looksLikeBarcode('PHRUPMASTERGENERAL T2T')).toBe(false)
    // Including one that is almost all digits.
    expect(looksLikeBarcode('01 BC A1 MPO')).toBe(false)
  })

  it('calls an empty field neither', () => {
    expect(looksLikeBarcode('')).toBe(false)
    expect(looksLikeBarcode('   ')).toBe(false)
  })
})

describe('what a barcode answers', () => {
  /**
   * **A list, not an answer.**
   *
   * The number comes from the measurement: eight pressings, one barcode.
   * Returning a single one here would mean picking one — and being wrong in
   * seven cases out of eight.
   */
  it('gives every pressing that shares the code', async () => {
    const found = await identify(client, '5012394144777')
    expect(found.candidates).toHaveLength(8)
    expect(found.candidates.map((c) => c.releaseId)).toEqual(ACHT)
    // What is printed on the record, so the pressings can be told apart.
    expect(found.candidates[0]).toMatchObject({ label: 'RCA', catno: 'PB 41447' })
  })

  /**
   * And your own record is found, **wherever in the list it stands**.
   *
   * In the measurement it was seventh. Checking only the first candidate
   * against the collection says "you do not have it" about a record on the
   * shelf — the most expensive mistake this screen can make.
   */
  it('finds a copy that is not the first candidate', async () => {
    const db = await openFidelityDb()
    await db.put('collection', platte(249504, 1))

    const found = await identify(client, '5012394144777')
    expect(found.owned.map((o) => o.releaseId)).toEqual([249504])
  })

  it('says when it is on the wantlist instead', async () => {
    const db = await openFidelityDb()
    await db.put('wantlist', { ...platte(1260449, 0), note: '', want: 0 } as never)

    const found = await identify(client, '5012394144777')
    expect(found.owned).toEqual([])
    expect(found.wanted.map((w) => w.releaseId)).toEqual([1260449])
  })

  it('asks Discogs nothing when the code is not one', async () => {
    const never = {
      get: async () => {
        throw new Error('should not be called')
      },
    } as never
    const found = await identify(never, 'kein barcode')
    expect(found.candidates).toEqual([])
  })
})

/**
 * And the second route: the run-out groove.
 *
 * **The better identifier, measured 2026-09-11:** of twelve records from a
 * real collection, ten had a barcode, **eleven had a run-out**, none had
 * neither — and the two without a barcode had one. On club vinyl the
 * identifier is in the run-out, not on the sleeve.
 *
 * It is also more precise: the full string returns **one** hit where a barcode
 * returns eight.
 */
describe('reading a run-out', () => {
  it('finds the pressing and checks every candidate against the shelf', async () => {
    const db = await openFidelityDb()
    await db.put('collection', platte(249504, 1))

    const found = await identifyByRunout(client, 'MPO SK 032 A1 G PHRUPMASTERGENERAL')
    expect(found.candidates).toHaveLength(8)
    expect(found.owned.map((o) => o.releaseId)).toEqual([249504])
  })

  /**
   * Too short is not a run-out but a typo.
   *
   * Measured: `SK 032 A1` — nine characters — gave **3,406** hits. A search
   * for three or four characters fetches half the catalogue and costs a
   * request for nothing.
   */
  it('does not search for a fragment that would match everything', async () => {
    const never = {
      get: async () => {
        throw new Error('should not be called')
      },
    } as never
    expect((await identifyByRunout(never, 'A1')).candidates).toEqual([])
    expect((await identifyByRunout(never, '   ')).candidates).toEqual([])
  })
})

describe('the screen that shows it', () => {
  const PAGE = readFileSync('app/pages/in-store.vue', 'utf8')
  const SCAN = readFileSync('app/composables/useBarcodeScan.ts', 'utf8')

  /** It says there are several — or the first is taken for *the* one. */
  it('says that several pressings share the code', () => {
    expect(withoutComments(PAGE)).toMatch(/scanPressings/)
    expect(withoutComments(PAGE)).toMatch(/identified\.candidates\.length > 1/)
  })

  /**
   * And on an iPhone no button is offered that can do nothing.
   *
   * `BarcodeDetector` is missing in WebKit. A camera that shows a picture and
   * recognises nothing is worse than a sentence saying: you type here.
   */
  it('offers the camera only where it can read', () => {
    expect(withoutComments(PAGE)).toMatch(/v-if="canScan"/)
    expect(withoutComments(PAGE)).toMatch(/scanNotHere/)
    expect(withoutComments(SCAN)).toMatch(/'BarcodeDetector' in globalThis/)
  })

  /**
   * And no library for it.
   *
   * A decoder in JavaScript weighs over a hundred kilobytes, and rule 7
   * demands that every dependency justify its place. Typed digits cost
   * nothing.
   */
  it('adds no decoder to the bundle', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
    expect(deps.filter((d) => /zxing|quagga|barcode|jsqr/i.test(d))).toEqual([])
  })

  /**
   * One field for both, and it decides for itself.
   *
   * Somebody holding a record does not want to choose first which kind of
   * number they are about to type.
   */
  /** And the pressings are a list to pick from, each read against the family. */
  it('lets you pick the pressing in your hand', () => {
    expect(withoutComments(PAGE)).toMatch(/v-for="candidate in identified\.candidates"/)
    expect(withoutComments(PAGE)).toMatch(/pressing\.family/)
  })

  it('takes a barcode or a run-out in one field', () => {
    expect(withoutComments(PAGE)).toMatch(/identify\.runout/)
    expect(withoutComments(PAGE)).toMatch(/identify\.barcode/)
    expect(withoutComments(PAGE)).toMatch(/looksLikeBarcode/)
  })

  /** The camera stops when the screen is gone. */
  it('turns the camera off again', () => {
    expect(withoutComments(SCAN)).toMatch(/onBeforeUnmount\(stop\)/)
    expect(withoutComments(SCAN)).toMatch(
      /getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/,
    )
  })
})
