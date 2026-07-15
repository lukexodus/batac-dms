const baseConfig = require('@batac/config/eslint.base.js');
const reactPlugin = require('eslint-plugin-react');
const reactHooksPlugin = require('eslint-plugin-react-hooks');

module.exports = [
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
      'react/prop-types': 'off', // TypeScript handles this
      'react/react-in-jsx-scope': 'off', // React 17+ JSX transform
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn', // Warn, not error, for complex deps
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } }, // Allow async onClick handlers
      ],
      '@typescript-eslint/explicit-module-boundary-types': 'off', // Only required for packages, not apps
    },
  },
  {
    files: ['src/pages/dev/**/*'],
    rules: {
      'no-console': 'off', // Allowed in dev preview pages
    },
  },
];
