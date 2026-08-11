import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const config = readFileSync('deploy/nginx.conf', 'utf8')

/**
 * The two ways this file has already been wrong.
 *
 * Neither showed up as an error anywhere: nginx started, every page loaded,
 * and the only symptom was a shell that would not update and headers that
 * quietly went missing. Both were found by measuring the running container,
 * and both are cheap to prevent from coming back.
 */

/** Everything between `location ... {` and its closing brace. */
function locationBlocks(): string[] {
  const blocks: string[] = []
  const pattern = /location\s+[^{]*\{/g

  for (const match of config.matchAll(pattern)) {
    let depth = 1
    let index = match.index + match[0].length
    const from = index

    while (depth > 0 && index < config.length) {
      if (config[index] === '{') depth += 1
      if (config[index] === '}') depth -= 1
      index += 1
    }
    blocks.push(config.slice(from, index))
  }

  return blocks
}

describe('the nginx config', () => {
  it('sets no header inside a location', () => {
    /*
     * In nginx an `add_header` inside a location *replaces* every header
     * inherited from the server block. When `/_nuxt/` set its own cache
     * directive it silently lost nosniff, DENY and the referrer policy —
     * measured on the running image, not deduced.
     */
    for (const block of locationBlocks()) {
      expect(block, `add_header in einer location:\n${block}`).not.toMatch(/add_header/)
    }
  })

  it('decides the cache by URI rather than by file extension', () => {
    /*
     * `location ~* \.html$` never matched a single route. Nuxt serves
     * /settings from settings/index.html, and the *request* has no
     * extension — so the shell went out with no cache directive at all, free
     * for any browser to keep and then ask for asset hashes that were gone.
     */
    expect(config).not.toMatch(/location\s+~\*?\s*\\?\.html\$/)
    expect(config).toMatch(/map\s+\$uri\s+\$fidelity_cache/)
  })

  it('caches hashed assets forever and everything else not at all', () => {
    const map = /map\s+\$uri\s+\$fidelity_cache\s*\{([^}]*)\}/.exec(config)?.[1] ?? ''

    expect(map).toMatch(/default\s+"no-cache"/)
    expect(map).toMatch(/\^\/_nuxt\/\s+"public, max-age=31536000, immutable"/)
  })

  it('serves routes without a redirect', () => {
    // `$uri/` answers 301 to a trailing slash, which is a different URL to the
    // router, to the precache and to whoever bookmarked it.
    expect(config).toMatch(/try_files\s+\$uri\s+\$uri\.html\s+\$uri\/index\.html\s+\/200\.html/)
  })
})
