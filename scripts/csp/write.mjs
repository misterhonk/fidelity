/**
 * After `nuxt build`: the policy for this build, written into the two server
 * configurations. `.output/htaccess` still carries `__FIDELITY_BASE__`, which
 * the deploy workflow fills in; `.output/nginx.conf` is complete and is what
 * the app image copies.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'

import { connectHosts, inlineHashes, policy } from './policy.mjs'

const out = '.output'
const html = readdirSync(`${out}/public`).filter((name) => name.endsWith('.html'))
if (html.length === 0)
  throw new Error('no built html under .output/public — run nuxt build first')

const hashes = new Set()
for (const name of html)
  for (const hash of inlineHashes(readFileSync(`${out}/public/${name}`, 'utf8')))
    hashes.add(hash)
const value = policy([...hashes], connectHosts(process.env.FIDELITY_CONNECT_SRC))

const fill = (from, to) =>
  writeFileSync(to, readFileSync(from, 'utf8').replace('__FIDELITY_CSP__', value))
fill('deploy/.htaccess', `${out}/htaccess`)
fill('deploy/nginx.conf', `${out}/nginx.conf`)
writeFileSync(`${out}/csp.txt`, value + '\n')
/*
 * The e2e suite's preview (`npx serve public`, from `nuxt preview`) sends the
 * same header, so a test that trips the policy fails (#204). Only on request:
 * `serve.json` in the docroot is nothing a real host should be handed. The
 * `report-uri` is how the suite hears a violation inside the Web Worker,
 * whose event no page listener sees (tests/e2e/support/test.ts).
 */
if (process.env.FIDELITY_PREVIEW_CSP)
  writeFileSync(
    `${out}/public/serve.json`,
    JSON.stringify({
      headers: [
        {
          source: '**',
          headers: [
            { key: 'Content-Security-Policy', value: `${value}; report-uri /__csp-report` },
          ],
        },
      ],
    }),
  )
console.log(
  `csp → ${out}/htaccess, ${out}/nginx.conf (${hashes.size} inline hashes from ${html.join(', ')})`,
)
