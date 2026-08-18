const baseConfig = require('@batac/config/eslint.base.js');
const reactPlugin = require('eslint-plugin-react');
const reactHooksPlugin = require('eslint-plugin-react-hooks');

module.exports = [
  {
    ignores: ['**/.next/**', '**/dist/**', '**/node_modules/**', '**/build/**', '**/.turbo/**'],
  },
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } }, // Allow async onSubmit/onClick handlers
      ],
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },
  {
    files: ['src/app/layout.tsx'],
    rules: {
      'import/order': 'off',
    },
  },
  {
    files: ['src/config/env.portal.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
];
