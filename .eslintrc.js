// @ts-check
const { defineConfig } = require('eslint-define-config');

module.exports = defineConfig({
  env: {
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
      },
    },
  },
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-var-requires': 'off',
    'import/order': [
      'error',
      {
        groups: [
          'builtin',
          'external',
          'internal',
          'parent',
          'index',
          'sibling',
          'type',
          'object',
        ],
        'newlines-between': 'always',
      },
    ],
  },
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      rules: {},
    },
  ],
});
