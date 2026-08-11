import { describe, expect, it } from 'vitest'

import { readVaultFile } from '~~/app/utils/vault-file'

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
    expect(() => readVaultFile('{kaputt')).toThrow('no readable vault')
    expect(() => readVaultFile('nicht mal json')).toThrow('no readable vault')
  })

  it('refuses a perfectly good file that is not ours', () => {
    // Somebody picks the wrong file in the dialog. They should hear that,
    // not "falsche Passphrase" three seconds later.
    expect(() => readVaultFile('{"hallo":"welt"}')).toThrow('kein Fidelity-Tresor')
    expect(() => readVaultFile('null')).toThrow('kein Fidelity-Tresor')
    expect(() => readVaultFile('[]')).toThrow('kein Fidelity-Tresor')
  })

  it('refuses a half-written block', () => {
    // An interrupted write leaves something that parses and is not a vault.
    for (const missing of ['version', 'iv', 'salt', 'cipher']) {
      const partial = Object.fromEntries(
        Object.entries(sealed).filter(([key]) => key !== missing),
      )
      expect(() => readVaultFile(JSON.stringify(partial)), missing).toThrow(
        'kein Fidelity-Tresor',
      )
    }
  })
})
