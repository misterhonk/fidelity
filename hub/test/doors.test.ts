import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { hubDoors } from '../src/doors.ts'

/** What `openssl rand -base64 32` prints is 44; the floor is 32. */
const LONG = 'x'.repeat(32)

/**
 * Starting without a door (2026-10-21): refused, unless somebody wrote down
 * that they mean it.
 */
describe('the doors at startup', () => {
  test('no secret and no key is refused', () => {
    assert.ok(hubDoors({}).refusal)
  })

  test('an empty secret is no secret', () => {
    const doors = hubDoors({ HUB_SECRET: '  ' })
    assert.equal(doors.secret, null)
    assert.ok(doors.refusal)
  })

  test('an open hub is allowed when it is asked for', () => {
    const doors = hubDoors({ HUB_OPEN: '1' })
    assert.equal(doors.open, true)
    assert.equal(doors.refusal, null)
  })

  test('a secret or an access key is a door', () => {
    assert.equal(hubDoors({ HUB_SECRET: LONG }).refusal, null)
    assert.equal(hubDoors({ HUB_SECRET: LONG }).secret, LONG)
    assert.equal(hubDoors({ HUB_ACCESS_PUBLIC_KEY: 'abc' }).refusal, null)
  })

  /** A word somebody can remember is a word somebody can guess (#206). */
  test('a secret shorter than 32 characters is refused', () => {
    assert.match(hubDoors({ HUB_SECRET: 'geheim' }).refusal ?? '', /32/)
    assert.ok(hubDoors({ HUB_SECRET: LONG.slice(1) }).refusal)
    // A key beside it does not excuse a weak secret: the secret still opens everything.
    assert.ok(hubDoors({ HUB_SECRET: 'geheim', HUB_ACCESS_PUBLIC_KEY: 'abc' }).refusal)
    // Nor does HUB_OPEN, which is about having no door, not a flimsy one.
    assert.ok(hubDoors({ HUB_SECRET: 'geheim', HUB_OPEN: '1' }).refusal)
  })
})
