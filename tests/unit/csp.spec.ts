import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { connectHosts, inlineHashes, policy } from '../../scripts/csp/policy.mjs'

/**
 * The Content-Security-Policy is computed from the build (M34.5).
 *
 * A static host cannot hand out nonces, so Nuxt's two inline scripts and the
 * import map are allowed by hash — and the hash has to be of exactly what
 * the browser executes, nothing more. A JSON data block is not a script.
 */
describe('the content security policy', () => {
  const html = [
    '<script type="application/json" id="__NUXT_DATA__">[1,2]</script>',
    '<script type="importmap">{"imports":{"#entry":"/_nuxt/a.js"}}</script>',
    '<script type="module" src="/_nuxt/a.js" crossorigin></script>',
    '<script>window.__NUXT__={}</script>',
  ].join('\n')

  it('hashes what executes and skips data and sources', () => {
    const hashes = inlineHashes(html)
    expect(hashes).toHaveLength(2)
    for (const hash of hashes) expect(hash).toMatch(/^'sha256-[A-Za-z0-9+/]+=*'$/)
    // The same script twice is one hash.
    expect(inlineHashes(html + html)).toHaveLength(2)
  })

  it('forbids what the token must never reach', () => {
    const value = policy(inlineHashes(html))
    expect(value).toContain("default-src 'self'")
    expect(value).toContain("img-src 'self' https://i.discogs.com")
    expect(value).toContain("frame-ancestors 'none'")
    expect(value).toContain("base-uri 'self'")
    // 'wasm-unsafe-eval' (ADR-018) is not this: it compiles WebAssembly, not strings.
    expect(value).not.toContain("'unsafe-eval'")
    expect(value).not.toContain("script-src 'self' 'unsafe-inline'")
  })

  it('lets the origin talk to the hosts it uses and nowhere else', () => {
    // #204: a script running in the origin must not be able to post the token
    // to a host of its choosing. `https:` allowed exactly that.
    const value = policy(inlineHashes(html))
    const connect = value.split('; ').find((directive) => directive.startsWith('connect-src'))
    expect(connect).toBe(
      [
        "connect-src 'self'",
        'https://api.discogs.com',
        // The service worker's cover cache fetches these.
        'https://i.discogs.com',
        // The vault (useVaultCloud.ts, cloud-vault.ts).
        'https://api.dropboxapi.com',
        'https://content.dropboxapi.com',
        'https://oauth2.googleapis.com',
        'https://www.googleapis.com',
        // A hub or catalogue on this machine (hub.discover, catalogue.discover).
        'http://localhost:8787',
        'http://127.0.0.1:8787',
        'http://localhost:8788',
        'http://127.0.0.1:8788',
      ].join(' '),
    )
    expect(connect).not.toMatch(/ https: | https:$| \*/)
  })

  it('adds the hub and catalogue a self-hoster names at build time, and nothing else', () => {
    expect(connectHosts('https://hub.example.org  https://cat.example.org:8443/')).toEqual([
      'https://hub.example.org',
      'https://cat.example.org:8443',
    ])
    expect(connectHosts(undefined)).toEqual([])
    expect(connectHosts('')).toEqual([])
    const value = policy([], connectHosts('https://hub.example.org'))
    expect(value).toMatch(/connect-src [^;]* https:\/\/hub\.example\.org;/)
    // A value that would smuggle in a directive, a wildcard or a path is refused.
    for (const bad of [
      'https://a.test; script-src *',
      'https:',
      '*',
      'https://*.example.org',
      'http://hub.example.org',
      'https://hub.example.org/path',
      'wss://hub.example.org',
    ])
      expect(() => connectHosts(bad), bad).toThrow()
  })

  it('lets the audio preview frame in, and no Google script into the origin', () => {
    // Until #203 the player was driven by YouTube's iframe API, a script from
    // www.youtube.com running with this app's rights, next to the token. The
    // frame is driven by postMessage now, so script-src names no third party.
    const value = policy(inlineHashes(html))
    const script = value.split('; ').find((directive) => directive.startsWith('script-src'))
    expect(script).toMatch(/^script-src 'self' 'wasm-unsafe-eval' 'sha256-/)
    expect(script).not.toMatch(/youtube|google/i)
    expect(value).toContain(
      'frame-src https://www.youtube-nocookie.com https://www.youtube.com',
    )
  })

  it('lets WebAssembly compile, and adds nothing else to script-src (ADR-018)', () => {
    // The barcode reader for Safari is zxing-wasm. 'wasm-unsafe-eval' allows
    // WebAssembly.instantiate, not eval() of strings; it is the one token the
    // ADR accepted, and only exactly that token.
    const hashes = inlineHashes(html)
    const script = policy(hashes)
      .split('; ')
      .find((directive) => directive.startsWith('script-src'))
    expect(script).toBe(`script-src 'self' 'wasm-unsafe-eval' ${hashes.join(' ')}`)
  })

  it('is what both servers send', () => {
    for (const file of ['deploy/.htaccess', 'deploy/nginx.conf']) {
      expect(readFileSync(file, 'utf8')).toContain('Content-Security-Policy "__FIDELITY_CSP__"')
    }
  })
})
