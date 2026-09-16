import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { inlineHashes, policy } from '../../scripts/csp/policy.mjs'

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
    expect(value).toContain("connect-src 'self' https:")
    expect(value).toContain("img-src 'self' https://i.discogs.com")
    expect(value).toContain("frame-ancestors 'none'")
    expect(value).toContain("base-uri 'self'")
    expect(value).not.toContain('unsafe-eval')
    expect(value).not.toContain("script-src 'self' 'unsafe-inline'")
  })

  it('is what both servers send', () => {
    for (const file of ['deploy/.htaccess', 'deploy/nginx.conf']) {
      expect(readFileSync(file, 'utf8')).toContain('Content-Security-Policy "__FIDELITY_CSP__"')
    }
  })
})
