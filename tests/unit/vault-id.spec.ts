import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { legacyVaultId, vaultId } from '~~/worker/vault/targets/hub'

/**
 * Wo ein Block liegt, darf niemand ausrechnen können.
 *
 * Bis zum 2026-08-13 war die Kennung `SHA-256("fidelity-vault:" + userId)`.
 * Eine Discogs-User-ID ist öffentlich, also konnte jeder mit dem Geheimnis
 * eines geteilten Hubs den Ablageort jedes Mitbenutzers ausrechnen — lesen
 * nicht, der Block ist verschlüsselt, aber holen und überschreiben schon.
 *
 * Diese Datei hält die drei Eigenschaften fest, an denen die neue Ableitung
 * hängt. Jede einzelne davon wegzunehmen sieht im Quelltext harmlos aus.
 */
describe('the slot a vault lives in', () => {
  /** Zwei Geräte, dieselbe Person, dasselbe Wort — sonst finden sie sich nie. */
  it('is the same on every device of the same person', async () => {
    expect(await vaultId(4711, 'ein langes wort')).toBe(await vaultId(4711, 'ein langes wort'))
  })

  /**
   * Und ohne das Wort nicht zu haben.
   *
   * Das ist der ganze Punkt: die öffentliche User-ID allein reicht nicht mehr.
   */
  it('changes with the passphrase', async () => {
    const one = await vaultId(4711, 'ein langes wort')
    const other = await vaultId(4711, 'ein anderes wort')
    expect(one).not.toBe(other)
  })

  it('changes with the person', async () => {
    expect(await vaultId(4711, 'gleiches wort')).not.toBe(await vaultId(4712, 'gleiches wort'))
  })

  /**
   * Niemals dasselbe wie früher.
   *
   * Wäre es das, wäre die Ableitung wirkungslos und der Umzug ein Leerlauf —
   * und beides sähe von außen genau wie ein Erfolg aus.
   */
  it('is never where it used to be', async () => {
    expect(await vaultId(4711, 'ein langes wort')).not.toBe(await legacyVaultId(4711))
  })

  /** Der alte Weg bleibt, damit ein Gerät seinen Block noch findet. */
  it('still knows the old address, unchanged', async () => {
    // Gemessen, nicht ausgedacht. Ändert sich diese Zahl, findet kein Gerät
    // mehr seinen alten Block, und der Umzug fällt still aus.
    expect(await legacyVaultId(4711)).toBe('b9ea8a05da4c0afd5968ec10a7b7296f')
  })

  /**
   * Eingefroren, weil eine Änderung daran jeden Vault verschiebt.
   *
   * Nicht bloß den eigenen: wer die Ableitung anfasst, schickt jedes Gerät auf
   * der Welt an eine leere Stelle, und die App meldet dort brav „erste
   * Sicherung angelegt". Der Wert ist gemessen, nicht ausgedacht — der erste
   * Anlauf dieser Datei stand mit einer erfundenen Zahl da und fiel sofort um.
   */
  it('lands exactly where it landed yesterday', async () => {
    expect(await vaultId(4711, 'ein langes wort')).toBe('7d3569f8aad7a73e5a8c3d60b6f193e0')
  })

  /** 16 Byte hex, so wie der Hub sie annimmt (`VAULT_ID` in hub/src/app.ts). */
  it('looks like an id the hub accepts', async () => {
    expect(await vaultId(4711, 'ein langes wort')).toMatch(/^[0-9a-f]{32}$/)
    expect(await legacyVaultId(4711)).toMatch(/^[0-9a-f]{32}$/)
  })
})

/**
 * Und die Aufrufstelle nimmt sie auch.
 *
 * Die Ableitung kann tadellos sein, während `runVaultSync` weiter die alte
 * Kennung benutzt — beide Mutationsproben am 2026-08-13 haben genau das
 * überlebt, weil oben nur die Funktionen geprüft wurden und nicht, wer sie
 * ruft. `status.ts` greift beim Laden nach IndexedDB, also wird hier die Form
 * gelesen statt das Verhalten ausgeführt; die Entscheidung ist sichtbar.
 */
describe('the sync that uses it', () => {
  const STATUS = readFileSync('worker/vault/status.ts', 'utf8')

  it('derives the slot from the passphrase', () => {
    expect(STATUS).toMatch(/await vaultId\(identity\.userId, passphrase\)/)
  })

  /**
   * Der Umzug, und in dieser Reihenfolge: lesen, an die neue Stelle legen,
   * die alte räumen. Wer das Räumen weglässt, lässt einen verschlüsselten
   * Block unter einer ausrechenbaren Adresse liegen — also genau das, was
   * diese Änderung abstellt.
   */
  it('moves an old block across and clears the old address', () => {
    expect(STATUS).toMatch(/await legacyVaultId\(identity\.userId\)/)
    expect(STATUS).toMatch(/await client\.vaultWrite\(id, old\)/)
    expect(STATUS).toMatch(/await client\.vaultForget\(legacy\)/)
  })

  /** Und nie wieder dorthin geschrieben. */
  it('never writes to the old address', () => {
    expect(STATUS).not.toMatch(/vaultWrite\(legacy/)
  })

  /**
   * „Da lag nichts" heißt nach dieser Änderung zweierlei, und das teurere
   * davon sieht aus wie eine Erstanlage: eine geänderte Passphrase verschiebt
   * den Ablageort mit. Ohne diese Meldung liefen zwei Geräte auseinander,
   * ohne dass irgendwo etwas kaputt aussieht.
   */
  it('says when an empty slot is not a first sync', () => {
    expect(STATUS).toMatch(
      /emptyThoughSyncedBefore: !report\.hadRemote && Boolean\(prefs\.vaultSyncedAt\)/,
    )
  })
})
