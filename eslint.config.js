import eslint from '@eslint/js';
import globals from 'globals';

export default [
  eslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      // ===== CRITICAL ERRORS (Phai fix) =====
      'no-empty': ['error', { allowEmptyCatch: false }],
      'no-unexpected-multiline': 'off',
      'no-extra-semi': 'off',
      'no-extra-parens': 'off',
      
      // ===== POTENTIAL BUGS (Nen fix) =====
      'no-unused-vars': 'off',
      'no-shadow': 'off',
      'no-global-assign': 'off',
      
      // ===== BEST PRACTICES =====
      'eqeqeq': 'off',
      'prefer-const': 'warn',
      'no-var': 'warn',
      
      // ===== DISABLED (Khong bat buoc) =====
      'no-console': 'off',
      'consistent-return': 'off',
      'strict': 'off',
      'no-implicit-globals': 'off',
      'no-extra-parens': 'off',
      'no-cond-assign': 'off',
      'no-undef': 'off',
      'quotes': 'off',
      'semi': 'off',
      'comma-dangle': 'off',
      'indent': 'off',
      'keyword-spacing': 'off',
      'space-before-blocks': 'off',
      'object-curly-spacing': 'off',
      'array-bracket-spacing': 'off',
      'space-in-parens': 'off',
      'key-spacing': 'off',
      'linebreak-style': 'off',
      'camelcase': 'off',
      'no-underscore-dangle': 'off',
    },
    ignores: [
      'node_modules/',
      'dist/',
      'client/dist/',
      'web/assets/i18n/',
      'data/',
      '.git/',
      '.vibe/',
      '.kilo/',
    ],
  },
  {
    files: ['web/assets/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        document: 'readonly',
        window: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
      },
    },
  },
];
