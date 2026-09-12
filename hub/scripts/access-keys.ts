/*
 * The issuer's half, by hand — for the beta, where keys are handed out one
 * by one, and for a self-hoster who wants keys without an access service.
 *
 *   node scripts/access-keys.ts generate [pem path]       → writes the private half to the
 *                                                          file (default ./issuer.pem, mode
 *                                                          0600) and prints the public half
 *   node scripts/access-keys.ts issue <sub> <tier> [days] → prints a key, signed with
 *                                                          HUB_ACCESS_PRIVATE_KEY (the PEM)
 *
 * A command-line tool talking to whoever ran it; the no-console rule is
 * written for browser code.
 */
/* eslint-disable no-console */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

import { generateAccessKeyPair, issueKey, TIERS, type Tier } from '../src/access.ts'

const [command, sub, tier, days] = process.argv.slice(2)

if (command === 'generate') {
  const pemPath = sub ?? './issuer.pem'
  if (existsSync(pemPath)) {
    console.error(
      `${pemPath} exists — a second pair would make every key of the first one worthless`,
    )
    process.exit(2)
  }
  const pair = generateAccessKeyPair()
  writeFileSync(pemPath, pair.privateKeyPem, { mode: 0o600 })
  console.log(`HUB_ACCESS_PUBLIC_KEY=${pair.publicKey}`)
  console.log(`private key written to ${pemPath} — for the issuer only, never on the hub`)
  console.log(
    `next: HUB_ACCESS_PRIVATE_KEY=${pemPath} node scripts/access-keys.ts issue <sub> beta 90`,
  )
} else if (command === 'issue' && sub && tier && TIERS.includes(tier as Tier)) {
  const pemPath = process.env.HUB_ACCESS_PRIVATE_KEY
  if (!pemPath || !existsSync(pemPath)) {
    console.error(
      pemPath
        ? `${pemPath} does not exist — run \`access-keys.ts generate ${pemPath}\` once, and keep the file`
        : 'HUB_ACCESS_PRIVATE_KEY must point at the private key PEM — `access-keys.ts generate` makes one',
    )
    process.exit(2)
  }
  console.log(
    issueKey({
      privateKeyPem: readFileSync(pemPath, 'utf8'),
      sub,
      tier: tier as Tier,
      days: days ? Number(days) : undefined,
    }),
  )
} else {
  console.error(`usage: access-keys.ts generate | issue <sub> <${TIERS.join('|')}> [days]`)
  process.exit(2)
}
