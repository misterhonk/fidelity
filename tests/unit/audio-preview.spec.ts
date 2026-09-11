import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { videoId } from '~/composables/useAudioPreview'

/**
 * Die Hörprobe und die Bedingungen, unter denen ADR-012 sie erlaubt.
 *
 * Die wichtigste davon ist unsichtbar: **vor dem ersten bewussten Tippen geht
 * kein Byte an Google** — kein Skript, kein Rahmen, keine Anfrage, auch dann
 * nicht, wenn der Schalter längst umgelegt ist. Das ist der Unterschied
 * zwischen einer benannten Ausnahme und einer Hintertür, und einer laufenden
 * App sieht man ihn nicht an.
 */
const COMPOSABLE = readFileSync('app/composables/useAudioPreview.ts', 'utf8')
const PAGE = readFileSync('app/pages/stack.vue', 'utf8')
const CARD = readFileSync('app/components/StackCard.vue', 'utf8')
const DEFAULTS = readFileSync('db/meta.ts', 'utf8')
const LEGAL = readFileSync('app/i18n/legal.ts', 'utf8')

const code = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/<!--[\s\S]*?-->/g, '')

describe('nothing reaches Google before somebody asks', () => {
  /**
   * Das Skript wird **im Rumpf einer Funktion** angelegt, nicht beim Import.
   *
   * Ein `<script src>` auf Modulebene oder ein `<iframe>` im Template würde
   * laden, sobald der Bildschirm erscheint — und dann wäre die Ausnahme keine
   * Entscheidung mehr, sondern eine Vorgabe.
   */
  it('creates the script only inside the function that a tap calls', () => {
    const bare = code(COMPOSABLE)
    expect(bare).toMatch(/function boot\(/)

    const boot = bare.slice(bare.indexOf('function boot('))
    expect(boot).toMatch(/createElement\('script'\)/)

    // Und nirgends sonst — vor `boot` darf nichts angelegt werden.
    const before = bare.slice(0, bare.indexOf('function boot('))
    expect(before).not.toMatch(/createElement|document\.head|new .*Player/)
  })

  /** Im Template steht ein leeres div und kein `<iframe>`. */
  it('has no iframe in the markup', () => {
    expect(code(PAGE)).not.toMatch(/<iframe/i)
    expect(code(CARD)).not.toMatch(/<iframe/i)
    expect(code(PAGE)).toMatch(/ref="mount"/)
  })

  /**
   * Und der Knopf erscheint nur, wenn beides stimmt: Schalter an **und**
   * Hörproben vorhanden. Ein Knopf, der nichts abspielt, lädt trotzdem.
   */
  it('offers the button only when the switch is on and there is something to play', () => {
    expect(code(PAGE)).toMatch(/audioOn\.value && !audio\.failed\.value/)
    expect(code(PAGE)).toMatch(/card\.value\?\.videos\?\.length \?\? 0\) > 0/)
  })
})

/**
 * Und der Bildschirm behauptet nicht, es sei *die* Platte.
 *
 * Discogs' Videos tragen Leute ein: unter einer 12" liegt auch mal ein
 * Album-Rip, eine Live-Fassung oder eine andere Platte. Der Spieler zeigt
 * YouTubes eigenes Bild und seinen eigenen Titel — ohne die Zeile darunter
 * sieht das aus, als gehöre beides zusammen. Am 2026-09-11 aufgefallen, weil
 * genau dieser Eindruck entstand (an einem Fixture, das drei Clips reihum an
 * alle Treffer hängte — aber der Eindruck war echt).
 */
describe('what is actually playing', () => {
  it('names the clip, not the record on the card', () => {
    expect(code(PAGE)).toMatch(/card\.value\?\.videos\?\.\[0\]\?\.title/)
    expect(code(PAGE)).toMatch(/v-if="hearing"/)
  })
})

describe('the switch', () => {
  it('is off to begin with', () => {
    expect(code(DEFAULTS)).toMatch(/audioPreview: false/)
  })

  /** Nichts hängt daran: der Stapel läuft ohne Ton vollständig. */
  it('leaves the stack working without it', () => {
    // Die Karte weiß nichts von Ton — sie zeigt Cover, Grund und Preis.
    expect(code(CARD)).not.toMatch(/audio|youtube/i)
  })
})

describe('the promise that had to change', () => {
  /**
   * Das Versprechen wird **geändert**, nicht still gedehnt.
   *
   * Ein eigener Abschnitt mit eigener Überschrift, nicht ein Halbsatz im
   * Absatz darüber — sonst wäre es versteckt, und ADR-012 erlaubt die
   * Ausnahme genau unter dieser Bedingung.
   */
  it('says so on the privacy page, in both languages', () => {
    const hits = [...LEGAL.matchAll(/^\s{4}audioBody:$/gm)]
    expect(hits).toHaveLength(2)

    expect(LEGAL).toMatch(/YouTube/)
    // Und nennt beim Namen, was *nicht* passiert — sonst klingt die Ausnahme
    // größer, als sie ist.
    expect(LEGAL).toMatch(/collection, wantlist and token stay here/)
    expect(LEGAL).toMatch(/Sammlung, Wantlist und Token bleiben hier/)
  })

  it('is a heading of its own on the page', () => {
    const page = readFileSync('app/pages/privacy.vue', 'utf8')
    expect(page).toMatch(/l\.privacy\.audio\b/)
    expect(page).toMatch(/l\.privacy\.audioBody/)
  })
})

/**
 * Und die eine Rechnung in dem Modul: aus einer Discogs-Adresse eine Kennung.
 *
 * Discogs speichert, was Leute eingetragen haben — mal `watch?v=`, mal
 * `youtu.be`. Was nicht passt, muss `null` geben: eine geratene Kennung
 * spielte irgendein fremdes Video ab.
 */
describe('reading a video address', () => {
  it('reads the two shapes Discogs actually stores', () => {
    expect(videoId('https://www.youtube.com/watch?v=MpmbntGDyNE')).toBe('MpmbntGDyNE')
    expect(videoId('https://youtu.be/Cawyll0pOI4')).toBe('Cawyll0pOI4')
  })

  it('refuses anything that is not YouTube', () => {
    expect(videoId('https://evil.test/watch?v=abc')).toBeNull()
    // Der naive Test `includes('youtube.com')` fällt auf beide herein.
    expect(videoId('https://www.youtube.com.evil.test/watch?v=abc')).toBeNull()
    expect(videoId('https://evil.test/?a=https://www.youtube.com/watch?v=abc')).toBeNull()
  })

  it('gives null instead of a guess', () => {
    expect(videoId('nicht mal eine adresse')).toBeNull()
    expect(videoId('https://www.youtube.com/')).toBeNull()
  })
})
