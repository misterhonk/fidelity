import { afterEach, describe, expect, it, vi } from 'vitest'

import { discoverCatalogue } from '../../worker/catalogue/probe'
import { onThisMachine } from '../../worker/loopback'

/**
 * A public deployment never probes this machine (#204): Chromium's Local
 * Network Access would ask the visitor for a permission nobody wanted.
 */
describe('probing localhost for a hub or a catalogue', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('only happens when the app itself runs on this machine', () => {
    expect(onThisMachine('localhost')).toBe(true)
    expect(onThisMachine('127.0.0.1')).toBe(true)
    expect(onThisMachine('sleeveside.app')).toBe(false)
    expect(onThisMachine('localhost.example.com')).toBe(false)
    expect(onThisMachine(undefined)).toBe(false)
  })

  async function asked(href: string): Promise<string[]> {
    const urls: string[] = []
    vi.stubGlobal('location', new URL(href))
    vi.stubGlobal('fetch', (url: string) => {
      urls.push(url)
      return Promise.reject(new TypeError('refused'))
    })
    await discoverCatalogue()
    return urls
  }

  it('leaves loopback alone on a public origin', async () => {
    const urls = await asked('https://sleeveside.app/settings')
    expect(urls.some((url) => /localhost|127\.0\.0\.1/.test(url))).toBe(false)
  })

  it('asks this machine when served from it', async () => {
    const urls = await asked('http://localhost:3000/settings')
    expect(urls).toContain('http://127.0.0.1:8788/v1/catalogue/health')
  })
})
