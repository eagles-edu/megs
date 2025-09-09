// This config is designed to be used with ESLint v8.0.0 or later
// It provides a base configuration that includes recommended rules from ESLint and Prettier.
// It also sets up the environment for modern JavaScript, allowing the use of ES modules and the latest ECMAScript features.
// The rules are configured to be less strict, allowing for a more flexible coding style while still catching common issues like unused variables and undefined variables.
// The configuration is modular, allowing for easy extension or modification as needed.
// It is suitable for projects that want to maintain a clean and consistent codebase while leveraging the power of ESLint and Prettier together.

// @ts-nocheck
import js from '@eslint/js'
import eslintConfigPrettier from 'eslint-config-prettier'

export default [
  // Recommended JS rules
  js.configs.recommended,

  // Project-wide tweaks
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        jQuery: 'readonly',
        Joomla: 'readonly',
        define: 'readonly',
        document: 'readonly',
        window: 'readonly',
        module: 'readonly',
      },
    },
    rules: {
      // Typical mild defaults
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-console': 'off',
    },
  },

  // Turn off formatting-related rules so Prettier owns formatting
  eslintConfigPrettier,

  // Ignore patterns
  {
    ignores: [
      'node_modules',
      'dist',
      'build',
      'coverage',
      '**/.sto/**',
      '**/sto/**',
      '**/_notes/**',
      '.hts-cache',
      '**/media/**',
      '**/modules/**',
      '**/templates/**',
      '**/*.min.js',
      '**/*.min.js.map',
      '**/*.bundle.js',
      '**/*.vendor.js',
      '**/*.cjs',
      '.stylelintrc.cjs',
      // Non-script assets migrated from .eslintignore
      '**/*.html',
      '**/*.htm',
      '**/*.css',
      '**/*.scss',
      '**/*.less',
    ],
  },
]
