import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', '.data/**', 'brand/generated/**', '**/test-results/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // The compositions' scripts run as classic scripts in Chrome (preview and render), not as modules.
    files: ['packages/templates/project/scripts/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: { window: 'readonly', document: 'readonly' },
    },
  },
  {
    // The browser-safe catalog is shared by the web app: no Node built-ins in it.
    files: ['packages/templates/src/catalog.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [{ group: ['node:*'], message: 'catalog.ts runs in the browser too.' }] }] },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ['apps/web/**/*.tsx'],
    ...jsxA11y.flatConfigs.recommended,
  },
  {
    // Option labels wrap their input and a name nested in spans (label > span > b > text).
    files: ['apps/web/**/*.tsx'],
    rules: { 'jsx-a11y/label-has-associated-control': ['error', { depth: 3 }] },
  },
);
