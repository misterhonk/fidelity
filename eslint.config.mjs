import prettier from 'eslint-config-prettier'

// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    files: ['**/*.{ts,vue}'],
    rules: {
      // External data crosses a Zod schema at the boundary. Inside, `any` is a
      // hole in the type system, not a shortcut.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Node-side tooling: scripts and config files run outside Nuxt.
    files: ['scripts/**/*.mjs', '*.config.{ts,mjs}'],
    rules: { 'no-console': 'off' },
  },
  {
    // The one module allowed to reach the console. Everything else goes
    // through it, because that is where the token redaction happens.
    files: ['worker/log.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    // Every spec fails on a CSP violation (#204), but only if it imports the
    // fixture that listens. The smoke run goes against a deployed site whose
    // policy this build did not write.
    files: ['tests/e2e/**/*.spec.ts'],
    ignores: ['tests/e2e/smoke/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@playwright/test',
              message: "Import from './support/test' — it fails the spec on a CSP violation.",
            },
          ],
        },
      ],
      // A hand-made write that navigates before `oncomplete` is cancelled by
      // WebKit now and then (#264, #271). The helpers in seed.ts wait for it.
      'no-restricted-properties': [
        'error',
        {
          object: 'indexedDB',
          property: 'open',
          message:
            'Use signIn/seed/putRows/readRows from ./seed — they wait for the transaction.',
        },
      ],
    },
  },
  {
    ignores: ['app/assets/css/tokens.css', 'server/db/migrations/**', 'docs/**', '*.html'],
  },
  // Must stay last: switches off everything Prettier already decides.
  prettier,
)
