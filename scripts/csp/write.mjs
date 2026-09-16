/**
 * After `nuxt build`: the policy for this build, written into the two server
 * configurations. `.output/htaccess` still carries `__FIDELITY_BASE__`, which
 * the deploy workflow fills in; `.output/nginx.conf` is complete and is what
 * the app image copies.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'

import { inlineHashes, policy } from './policy.mjs'

const out = '.output'
const html = readdirSync(`${out}/public`).filter((name) => name.endsWith('.html'))
if (html.length === 0)
  throw new Error('no built html under .output/public — run nuxt build first')

const hashes = new Set()
for (const name of html)
  for (const hash of inlineHashes(readFileSync(`${out}/public/${name}`, 'utf8')))
    hashes.add(hash)
const value = policy([...hashes])

const fill = (from, to) =>
  writeFileSync(to, readFileSync(from, 'utf8').replace('__FIDELITY_CSP__', value))
fill('deploy/.htaccess', `${out}/htaccess`)
fill('deploy/nginx.conf', `${out}/nginx.conf`)
writeFileSync(`${out}/csp.txt`, value + '\n')
console.log(
  `csp → ${out}/htaccess, ${out}/nginx.conf (${hashes.size} inline hashes from ${html.join(', ')})`,
)
