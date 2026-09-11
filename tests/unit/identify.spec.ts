import { readFileSync } from 'node:fs'

import { beforeEach, describe, expect, it } from 'vitest'

import { openFidelityDb } from '~~/db/open'
import { cleanBarcode, identify, identifyByRunout, looksLikeBarcode } from '~~/worker/identify'
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

/**
 * Welche Art Nummer wurde da getippt?
 *
 * Als Funktion geprüft und nicht am Quelltext: eine Mutationsprobe hat
 * gezeigt, dass ein Test, der nur nach `identify.barcode` und
 * `identify.runout` im Template sucht, die Entscheidung gar nicht sieht — auf
 * `true` festgenagelt blieb er grün, und dann wäre jeder Runout als Barcode
 * nachgeschlagen worden.
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
    // Auch eine, die fast nur aus Ziffern besteht.
    expect(looksLikeBarcode('01 BC A1 MPO')).toBe(false)
  })

  it('calls an empty field neither', () => {
    expect(looksLikeBarcode('')).toBe(false)
    expect(looksLikeBarcode('   ')).toBe(false)
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

/**
 * Und der zweite Weg: die Auslaufrille.
 *
 * **Der bessere Ausweis, gemessen am 2026-09-11:** von zwölf Platten einer
 * echten Sammlung hatten zehn einen Barcode, **elf einen Runout**, keine
 * hatte keins von beidem — und die zwei ohne Barcode hatten einen. Bei
 * Club-Vinyl steht der Ausweis im Auslauf, nicht auf der Hülle.
 *
 * Er ist auch genauer: die volle Zeichenkette liefert **einen** Treffer, wo
 * ein Barcode acht liefert.
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
   * Zu kurz ist kein Runout, sondern ein Tippfehler.
   *
   * Gemessen: `SK 032 A1` — neun Zeichen — ergab **3406** Treffer. Eine Suche
   * nach drei oder vier Zeichen holt den halben Katalog und kostet eine
   * Anfrage für nichts.
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

  /**
   * Ein Feld für beides, und es entscheidet selbst.
   *
   * Wer eine Platte in der Hand hält, will nicht erst wählen, welche Art
   * Nummer er gleich abtippt.
   */
  it('takes a barcode or a run-out in one field', () => {
    expect(code(PAGE)).toMatch(/identify\.runout/)
    expect(code(PAGE)).toMatch(/identify\.barcode/)
    expect(code(PAGE)).toMatch(/looksLikeBarcode/)
  })

  /** Die Kamera hört auf, wenn der Bildschirm weg ist. */
  it('turns the camera off again', () => {
    expect(code(SCAN)).toMatch(/onBeforeUnmount\(stop\)/)
    expect(code(SCAN)).toMatch(/getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/)
  })
})
