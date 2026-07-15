const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const importPlugin = require('eslint-plugin-import');
const boundariesPlugin = require('eslint-plugin-boundaries');
const jsdocPlugin = require('eslint-plugin-jsdoc');

module.exports = [
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/build/**', '**/.turbo/**'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: true,
        tsconfigRootDir: process.cwd(),
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
      boundaries: boundariesPlugin,
      jsdoc: jsdocPlugin,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      'no-console': 'error',
      'no-debugger': 'error',
      'no-warning-comments': ['warn', { terms: ['todo', 'fixme', 'hack'], location: 'start' }],
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', ['internal', 'parent', 'sibling', 'index'], 'type'],
          pathGroups: [{ pattern: '@batac/**', group: 'internal', position: 'before' }],
          pathGroupsExcludedImportTypes: ['type'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import/no-duplicates': 'error',
      'import/no-cycle': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'MemberExpression[object.name="process"][property.name="env"]',
          message:
            'Access env variables through the package config/env module, not process.env directly.',
        },
      ],
    },
  },
];
