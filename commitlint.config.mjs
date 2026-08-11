/**
 * Conventional Commits, mapped to Keep a Changelog by release-please
 * (docs/07-DEV-PIPELINE.md §2).
 *
 * @type {import('@commitlint/types').UserConfig}
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', // → Added,   minor
        'fix', // → Fixed,   patch
        'perf', // → Changed, patch
        'refactor', // → Changed, patch
        'revert', // → Removed
        'deprecate', // → Deprecated
        'docs',
        'test',
        'chore',
        'ci',
        'style',
      ],
    ],
    // A scope is optional — repo-wide changes have none — but if one is given
    // it has to be from the list.
    // The list from CLAUDE.md, plus 'deps' for Renovate's semantic commits.
    'scope-enum': [
      2,
      'always',
      [
        'dig',
        'match',
        'discogs',
        'horizon',
        'auth',
        'basket',
        'watch',
        // The dealer import and everything that keeps the shop list.
        'dealers',
        'hub',
        // Fidelity without a token: the demonstration on one or two records.
        'demo',
        'sync',
        // Managing what is on your own shelf: ratings, condition, in and out.
        'collection',
        'ui',
        // Languages: message packs, the switch, translated routes (ADR-010).
        'i18n',
        'db',
        'pwa',
        'deploy',
        'deps',
      ],
    ],
    'subject-case': [2, 'never', ['upper-case', 'pascal-case', 'start-case']],
    'body-max-line-length': [1, 'always', 100],
  },
}
