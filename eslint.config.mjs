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
    ignores: ['app/assets/css/tokens.css', 'server/db/migrations/**', 'docs/**', '*.html'],
  },
  // Must stay last: switches off everything Prettier already decides.
  prettier,
)
