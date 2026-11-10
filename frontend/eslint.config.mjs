import globals from 'globals';
import pluginJs from '@eslint/js';
import daStyle from 'eslint-config-dicodingacademy';

export default [
  pluginJs.configs.recommended,
  daStyle,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
  },
  // ignore line-ending issues
  {
    rules: {
      'linebreak-style': 'off',
    },
  },
];
