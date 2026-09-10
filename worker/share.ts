import { seal, open } from './vault/crypto'
import { createHubClient } from './hub/client'
import { getPreferences } from '~~/db/meta'
import type { DigWithMatches } from '#shared/protocol'
import type { SharedDig } from '#shared/types'

/**
 * Eine Fundliste verschicken, ohne sie irgendwo abzulegen, wo sie jemand
 * lesen kann.
 *
 * Der Hub trägt einen versiegelten Umschlag unter einer zufälligen Kennung.
 * Der Schlüssel steht im `#`-Fragment des Links — und ein Fragment schickt
 * **kein** Browser an einen Server. Wer den Link hat, kann lesen; wer die
 * Datenbank des Hubs hat, hat eine Zeichenkette.
 *
 * **Warum überhaupt der Hub.** Eine Fundliste mit hundert Treffern passt nicht
 * in eine Adresse, und es gibt nichts anderes, worauf beide Seiten zugreifen
 * können. Nach Regel 8 hängt kein Feature am Hub — dieses hier ist die
 * Ausnahme, die die Regel bestätigt: ohne Hub gibt es den Knopf nicht, und
 * alles andere funktioniert weiter.
 */

/** Version des Schnappschusses, damit ein alter Link an einem neuen Client
 *  nicht still falsch gelesen wird. */
const SHARE_VERSION = 1

/**
 * Wie viele Treffer mitreisen.
 *
 * Die Liste ist nach Punktzahl sortiert; wer über hundert hinausliest, liest
 * nicht mehr, er scrollt. Die Gesamtzahl reist mit, damit der Schnappschuss
 * nicht behauptet, das sei alles gewesen.
 */
const MAX_SHARED_MATCHES = 100

/** 128 Bit als Hex — Kennung und Schlüssel haben dieselbe Form und beide
 *  kommen aus `crypto.getRandomValues`, nicht aus `Math.random`. */
function randomHex(bytes: number): string {
  return [...crypto.getRandomValues(new Uint8Array(bytes))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export interface ShareCreated {
  id: string
  /** Gehört ins `#`-Fragment und nirgendwo sonst hin. */
  key: string
  /** Wann sie verfällt — die Uhr des Digs, nicht die des Teilens. */
  expiresAt: number
  matches: number
}

/**
 * Nimmt entgegen, was der Bildschirm ohnehin geladen hat.
 *
 * Absichtlich nicht `digId`: `loadDig()` wendet `bestPerRelease()` an und
 * faltet doppelte Exemplare weg. Hier dieselbe Liste noch einmal aus der
 * Datenbank zu holen hieße, diese Auswahl ein zweites Mal zu treffen — und
 * die zweite Fassung wäre die, die niemand pflegt. Geteilt wird, was auf dem
 * Schirm steht.
 */
export async function createShare(loaded: DigWithMatches): Promise<ShareCreated> {
  const preferences = await getPreferences()
  const hub = createHubClient({ baseUrl: preferences.hubUrl, secret: preferences.hubSecret })
  if (!hub) throw new Error('no hub configured')

  const dig = loaded.dig

  /*
   * Abgelaufenes wird nicht geteilt.
   *
   * Sechs Stunden nach dem Scan dürfen Preise und Zustände nicht mehr gezeigt
   * werden (Regel 4). Einen abgelaufenen Dig zu teilen hieße, jemand anderem
   * genau das zu zeigen — und die Sperre auf dem eigenen Bildschirm zu
   * umgehen, indem man einen zweiten aufmacht.
   */
  if (Date.now() >= dig.expiresAt) throw new Error('dig expired')

  const snapshot: SharedDig = {
    version: SHARE_VERSION,
    dealer: dig.dealer,
    scannedAt: dig.startedAt,
    expiresAt: dig.expiresAt,
    coverage: dig.coverage,
    listingsTotal: dig.listingsTotal,
    matchesTotal: loaded.matches.length,
    matches: loaded.matches.slice(0, MAX_SHARED_MATCHES),
  }

  const id = randomHex(16)
  const key = randomHex(16)
  const sealed = await seal(snapshot, key)

  await hub.shareWrite(id, sealed, dig.expiresAt)
  return { id, key, expiresAt: dig.expiresAt, matches: snapshot.matches.length }
}

/**
 * Und die andere Seite: einen Link öffnen.
 *
 * Läuft **ohne Token und ohne Anmeldung**. Wer den Link bekommt, hat
 * Fidelity vielleicht noch nie geöffnet, und ihn erst zur Einrichtung zu
 * schicken wäre die schlechteste Art, eine App vorzustellen.
 */
export async function readShare(
  hubUrl: string,
  id: string,
  key: string,
): Promise<SharedDig | null> {
  /*
   * Ohne Secret gebaut, mit Absicht.
   *
   * Der Empfänger hat keins. Selbst wenn er zufällig eines für einen *anderen*
   * Hub hinterlegt hätte, hätte es hier nichts zu suchen — ein Geheimnis geht
   * nicht an einen Server, nur weil ein Link auf ihn zeigt.
   */
  const hub = createHubClient({ baseUrl: hubUrl, secret: null })
  if (!hub) return null

  const found = await hub.shareRead(id)
  if (!found) return null

  const snapshot = await open<SharedDig>(found.sealed, key)

  /*
   * Die Ablaufzeit wird hier noch einmal geprüft, und diesmal ist es kein
   * toter Code: der Server hat seine eigene Uhr, das Gerät hat eine andere,
   * und was gezeigt werden darf, entscheidet die, vor der jemand sitzt.
   */
  if (Date.now() >= snapshot.expiresAt) return null
  if (snapshot.version > SHARE_VERSION) return null

  return snapshot
}
