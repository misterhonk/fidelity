import { readFileSync } from 'node:fs'

import { beforeEach, describe, expect, it } from 'vitest'

import { openFidelityDb } from '~~/db/open'
import { cleanBarcode, identify } from '~~/worker/identify'
import type { CollectionItem } from '#shared/types'

/**
 * Eine Platte in der Hand erkennen (M13, Stufe 1).
 *
 * **Der Fund, der diesen Bildschirm formt: ein Barcode ist nicht eindeutig.**
 * Am 2026-09-11 gegen die echte API gemessen — `5012394144777` liefert acht
 * Releases in fünf Ländern, und das Release, aus dem der Barcode stammt,
 * steht auf Platz sieben. Ein Barcode benennt eine Veröffentlichung, keine
 * Pressung.
 *
 * Für „habe ich die schon?" ist das kein Problem, im Gegenteil. Es wird nur
 * eines, sobald die Oberfläche einen einzelnen Treffer als *die* Antwort
 * zeigt — deshalb hält der letzte Block hier fest, dass sie es nicht tut.
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

/** Die acht echten IDs aus der Messung vom 2026-09-11. */
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
    // Scanner und Menschen liefern Leerzeichen und Bindestriche mit.
    expect(cleanBarcode(' 501 239-414 4777 ')).toBe('5012394144777')
  })

  it('refuses what cannot be a barcode on a record', () => {
    expect(cleanBarcode('42')).toBeNull()
    expect(cleanBarcode('kein barcode')).toBeNull()
    expect(cleanBarcode('1'.repeat(20))).toBeNull()
  })
})

describe('what a barcode answers', () => {
  /**
   * **Eine Liste, keine Antwort.**
   *
   * Die Zahl kommt aus der Messung: acht Pressungen, ein Barcode. Wer hier
   * eine einzelne zurückgäbe, müsste sich eine aussuchen — und läge in sieben
   * von acht Fällen daneben.
   */
  it('gives every pressing that shares the code', async () => {
    const found = await identify(client, '5012394144777')
    expect(found.candidates).toHaveLength(8)
    expect(found.candidates.map((c) => c.releaseId)).toEqual(ACHT)
  })

  /**
   * Und die eigene Platte wird gefunden, **egal an welcher Stelle sie steht**.
   *
   * In der Messung war es Platz sieben. Wer nur den ersten Kandidaten gegen
   * die Sammlung prüft, sagt „hast du nicht" zu einer Platte, die im Regal
   * steht — der teuerste Fehler, den dieser Bildschirm machen kann.
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

describe('the screen that shows it', () => {
  const PAGE = readFileSync('app/pages/in-store.vue', 'utf8')
  const SCAN = readFileSync('app/composables/useBarcodeScan.ts', 'utf8')

  const code = (source: string) =>
    source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
      .replace(/<!--[\s\S]*?-->/g, '')

  /** Es sagt, dass es mehrere sind — sonst hält man die erste für *die*. */
  it('says that several pressings share the code', () => {
    expect(code(PAGE)).toMatch(/scanPressings/)
    expect(code(PAGE)).toMatch(/identified\.candidates\.length > 1/)
  })

  /**
   * Und auf einem iPhone wird kein Knopf angeboten, der nichts kann.
   *
   * `BarcodeDetector` fehlt in WebKit. Eine Kamera, die ein Bild zeigt und
   * nichts erkennt, ist schlimmer als ein Satz, der sagt: hier wird getippt.
   */
  it('offers the camera only where it can read', () => {
    expect(code(PAGE)).toMatch(/v-if="canScan"/)
    expect(code(PAGE)).toMatch(/scanNotHere/)
    expect(code(SCAN)).toMatch(/'BarcodeDetector' in globalThis/)
  })

  /**
   * Und keine Bibliothek dafür.
   *
   * Ein Decoder in JavaScript wiegt über hundert Kilobyte, und Regel 7
   * verlangt, dass jede Abhängigkeit ihren Platz rechtfertigt. Getippte
   * Ziffern kosten null.
   */
  it('adds no decoder to the bundle', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
    expect(deps.filter((d) => /zxing|quagga|barcode|jsqr/i.test(d))).toEqual([])
  })

  /** Die Kamera hört auf, wenn der Bildschirm weg ist. */
  it('turns the camera off again', () => {
    expect(code(SCAN)).toMatch(/onBeforeUnmount\(stop\)/)
    expect(code(SCAN)).toMatch(/getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/)
  })
})
