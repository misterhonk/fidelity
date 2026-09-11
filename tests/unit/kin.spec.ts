import { describe, expect, it } from 'vitest'

import { expandEntity, kinOf, MAX_KIN } from '~~/worker/horizon/expand'

/**
 * The lexicon (docs/06 M19 #6): every other name an artist goes by, fetched
 * with the discography so that "Miss Dinky*" in an inventory reads as Dinky.
 *
 * One request per artist and none for anything else — that is the cost, and
 * the test pins it, because a second request per label would be four hundred
 * more on a real shelf.
 */

function fakeClient(answers: Record<string, unknown>) {
  const paths: string[] = []
  return {
    paths,
    client: {
      get: async (path: string, schema: { parse: (v: unknown) => unknown }) => {
        paths.push(path)
        const answer = answers[path]
        if (answer === undefined) throw new Error(`unexpected ${path}`)
        return schema.parse(answer)
      },
    } as never,
  }
}

const releases = {
  pagination: { page: 1, pages: 1, items: 2 },
  releases: [
    { id: 10, type: 'release', role: 'Main', year: 2003 },
    { id: 11, type: 'release', role: 'Main', year: 2005 },
  ],
}

describe('expanding an artist', () => {
  it('asks who else they are, once, after the discography', async () => {
    const { client, paths } = fakeClient({
      '/artists/100/releases': releases,
      '/artists/100': {
        id: 100,
        namevariations: ['Miss Dinky'],
        aliases: [{ id: 101, name: 'Dinky Lopez' }],
        members: [],
        groups: [{ id: 102, name: 'Los Dinkys' }],
      },
    })

    const result = await expandEntity(
      { kind: 'artist', id: 100, name: 'Dinky', owned: 4 },
      { client, now: () => 0 },
    )

    expect(paths).toEqual(['/artists/100/releases', '/artists/100'])
    expect(result.requests).toBe(2)
    expect(result.chunk.kin).toEqual([
      { name: 'Miss Dinky', relation: 'alias' },
      { name: 'Dinky Lopez', relation: 'alias' },
      { name: 'Los Dinkys', relation: 'group' },
    ])
  })

  it('stores an empty lexicon for an artist with nobody else — that is complete, not missing', async () => {
    const { client } = fakeClient({
      '/artists/100/releases': releases,
      '/artists/100': { id: 100 },
    })

    const result = await expandEntity(
      { kind: 'artist', id: 100, name: 'Dinky', owned: 4 },
      { client, now: () => 0 },
    )

    expect(result.chunk.kin).toEqual([])
  })

  it('costs a label nothing extra', async () => {
    const { client, paths } = fakeClient({
      '/labels/5/releases': {
        pagination: { page: 1, pages: 1, items: 1 },
        releases: [{ id: 10, catno: 'X 1' }],
      },
    })

    const result = await expandEntity(
      { kind: 'label', id: 5, name: 'Perlon', owned: 3 },
      { client, now: () => 0 },
    )

    expect(paths).toEqual(['/labels/5/releases'])
    expect(result.chunk.kin).toBeUndefined()
  })
})

describe('the lexicon itself', () => {
  it('puts the same person first and keeps who is part of whom', () => {
    const kin = kinOf({
      id: 1,
      groups: [{ id: 2, name: 'Can' }],
      members: [{ id: 3, name: 'Jaki Liebezeit' }],
      aliases: [{ id: 4, name: 'Holger Czukay' }],
      namevariations: ['H. Czukay'],
    })

    expect(kin.map((k) => k.relation)).toEqual(['alias', 'alias', 'member', 'group'])
    expect(kin[0]).toEqual({ name: 'H. Czukay', relation: 'alias' })
  })

  it('takes a name once, whatever the case, and never an empty one', () => {
    const kin = kinOf({
      id: 1,
      namevariations: ['Dinky ', '', 'DINKY'],
      aliases: [{ id: 2, name: 'dinky' }],
    })
    expect(kin).toEqual([{ name: 'Dinky', relation: 'alias' }])
  })

  it('stops at a roster', () => {
    const kin = kinOf({
      id: 1,
      aliases: [{ id: 2, name: 'The One Alias' }],
      members: Array.from({ length: 200 }, (_, i) => ({ id: 10 + i, name: `Player ${i}` })),
    })
    expect(kin).toHaveLength(MAX_KIN)
    expect(kin[0]?.relation).toBe('alias')
  })
})
