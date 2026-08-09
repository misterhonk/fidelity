import { describe, expect, it } from 'vitest'

import { explain } from '~/utils/explain'

class Coded extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message)
  }
}

describe('explaining the four ways this fails', () => {
  it('says a revoked token can be replaced without losing anything', () => {
    const result = explain(new Coded('Invalid token', 'unauthorized'))
    expect(result.title).toContain('nimmt den Token nicht mehr an')
    expect(result.action).toContain('deine Daten hier bleiben')
  })

  it('says waiting is the whole fix for a rate limit', () => {
    const result = explain(new Coded('too many requests', 'rate-limited'))
    expect(result.title).toContain('bremst')
    expect(result.action).toContain('warten')
    // What was already scanned is kept — the reason it is safe to wait.
    expect(result.action).toContain('gespeichert')
  })

  it('says what still works when there is no network', () => {
    const result = explain(new Coded('network down', 'offline'))
    expect(result.action).toContain('funktionieren weiter')
  })

  it('recognises a dead network without a code, too', () => {
    // Not every failure comes through the worker's error shape.
    expect(explain(new Error('Failed to fetch')).title).toContain('nicht erreichbar')
    expect(explain(new Error('Load failed')).title).toContain('nicht erreichbar')
  })

  it('says deleting is the answer when the disk is full', () => {
    const result = explain(new DOMException('QuotaExceededError', 'QuotaExceededError'))
    expect(result.title).toContain('Kein Platz')
    expect(result.action).toContain('Alles löschen')
  })

  it('keeps an unknown failure in its own words', () => {
    // A friendly wrapper here would hide the only clue there is.
    const result = explain(new Error('Kaputt auf eine ganz neue Art'))
    expect(result.title).toBe('Kaputt auf eine ganz neue Art')
    expect(result.action).toBeNull()
    expect(result.detail).toBeNull()
  })

  it('always keeps the raw message reachable for the known cases', () => {
    expect(explain(new Coded('HTTP 429 from /users/x', 'rate-limited')).detail).toBe(
      'HTTP 429 from /users/x',
    )
  })

  it('survives being handed something that is not an error at all', () => {
    expect(explain(null).title).toBe('Etwas ist schiefgegangen.')
    expect(explain('kaputt').title).toBe('kaputt')
  })
})
