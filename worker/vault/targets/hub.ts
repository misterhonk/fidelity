import type { VaultTargetPort } from '#shared/ports'

import type { HubClient } from '../../hub/client'
import { KDF_ITERATIONS, type SealedVault } from '../crypto'

/**
 * The hub as a destination.
 *
 * The one that works everywhere — a phone, a laptop, a tablet, all of them
 * reach an address over HTTPS, which is more than can be said for the File
 * System Access API. It is also the only one with no third party in it.
 *
 * The hub cannot read what it holds. That is not a detail of the
 * implementation, it is the condition ADR-008 attaches to this existing.
 */

/**
 * Wo der Block liegt — und warum das nicht auszurechnen sein darf.
 *
 * Bis zum 2026-08-13 war die Kennung `SHA-256("fidelity-vault:" + userId)`.
 * Eine Discogs-User-ID ist öffentlich, also konnte jeder, der das Geheimnis
 * eines geteilten Hubs kennt, den Ablageort jedes Mitbenutzers ausrechnen. Zu
 * lesen war da nichts — der Block ist mit der Passphrase verschlüsselt —, aber
 * herunterladen und überschreiben schon. Auf einem Hub, den man mit Freunden
 * teilt, soll niemand den Platz des anderen auch nur kennen.
 *
 * Also aus der Passphrase mitabgeleitet. Zwei Dinge daran sind Absicht:
 *
 * **PBKDF2 und nicht SHA-256.** Ein schneller Hash über eine Passphrase macht
 * die Kennung zum Orakel: wer sie sieht, kann offline Passphrasen durchprobieren
 * und weiß bei jedem Treffer, dass er richtig liegt. 600.000 Runden machen
 * daraus eine Rechnung, die sich nicht lohnt.
 *
 * **Ein eigener, fester Salzwert.** Die Verschlüsselung nimmt einen zufälligen,
 * der neben dem Block liegt — der taugt hier nicht, denn man müsste den Block
 * schon gefunden haben, um ihn zu kennen. Das Präfix trennt die beiden
 * Ableitungen sauber: aus der Kennung folgt kein Schlüsselmaterial.
 *
 * Der Preis ist eine dritte teure Ableitung je Abgleich — auf einem Pfad, der
 * mit `seal` und `open` ohnehin schon zwei davon hat.
 *
 * **Und der Haken, der beim alten Weg nicht bestand:** eine geänderte
 * Passphrase verschiebt jetzt auch den Ablageort. Vorher war ein falsches Wort
 * ein „lässt sich nicht öffnen", jetzt ist es ein „da liegt nichts" — was
 * gefährlicher aussieht, als es ist, und deshalb in `status.ts` ausdrücklich
 * benannt wird, statt als Erstanlage durchzugehen.
 */
export async function vaultId(userId: number, passphrase: string): Promise<string> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits'],
  )

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode(`fidelity-vault-id:${userId}`) as BufferSource,
      iterations: KDF_ITERATIONS,
      hash: 'SHA-256',
    },
    material,
    128,
  )

  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Wo er bis zum 2026-08-13 lag.
 *
 * Bleibt, damit ein Gerät seinen alten Block noch findet und umziehen kann —
 * und nur dafür. Geschrieben wird dorthin nie wieder.
 */
export async function legacyVaultId(userId: number): Promise<string> {
  const bytes = new TextEncoder().encode(`fidelity-vault:${userId}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)]
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function hubTarget(client: HubClient, id: string, where: string): VaultTargetPort {
  return {
    available: () => true,

    async read() {
      return client.vaultRead(id)
    },

    async write(sealed) {
      await client.vaultWrite(id, sealed as SealedVault)
    },

    describe: () => where,
  }
}
