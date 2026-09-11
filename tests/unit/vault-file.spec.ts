import { describe, expect, it } from 'vitest'

import { readVaultFile } from '~~/app/utils/vault-file'
import en from '~~/app/i18n/en'

/*
 * Checked against the language pack, not against a copied sentence.
 *
 * Two of these promises stood here as German wording — `'kein
 * Fidelity-Tresor'` — and went red on 2026-09-10 when the message moved to
 * where it belongs. That was the test doing its job, and at the same time a
 * coupling to a phrasing: what should be checked is *which* message arrives,
 * not how it currently reads.
 */
const words = en.error

/**
 * The moment before a file gets overwritten.
 *
 * Everything else about the file target is glue around a browser API. This is
 * the one decision in it, and getting it wrong loses data rather than
 * inconveniencing somebody.
 */
const sealed = { version: 1, iv: 'aa', salt: 'bb', cipher: 'cc' }

describe('reading a vault file', () => {
  it('treats an empty file as the first run', () => {
    // A file the picker just created has nothing in it, and that is not a
    // problem — it is what "set this up" looks like.
    expect(readVaultFile('')).toBeNull()
    expect(readVaultFile('   \n ')).toBeNull()
  })

  it('hands back a sealed block untouched', () => {
    expect(readVaultFile(JSON.stringify(sealed))).toEqual(sealed)
  })

  it('refuses rather than treating unreadable as empty', () => {
    /*
     * The failure worth preventing. Returning null here would mean the next
     * step writes over the file — turning "I cannot read this" into "this is
     * gone", and the file is the only copy another device has.
     */
    expect(() => readVaultFile('{kaputt')).toThrow(words.fileUnreadable)
    expect(() => readVaultFile('nicht mal json')).toThrow(words.fileUnreadable)
  })

  it('refuses a perfectly good file that is not ours', () => {
    // Somebody picks the wrong file in the dialog. They should hear that,
    // not "falsche Passphrase" three seconds later.
    expect(() => readVaultFile('{"hallo":"welt"}')).toThrow(words.notAVault)
    expect(() => readVaultFile('null')).toThrow(words.notAVault)
    expect(() => readVaultFile('[]')).toThrow(words.notAVault)
  })

  it('refuses a half-written block', () => {
    // An interrupted write leaves something that parses and is not a vault.
    for (const missing of ['version', 'iv', 'salt', 'cipher']) {
      const partial = Object.fromEntries(
        Object.entries(sealed).filter(([key]) => key !== missing),
      )
      expect(() => readVaultFile(JSON.stringify(partial)), missing).toThrow(words.notAVault)
    }
  })
})
