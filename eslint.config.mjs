// @ts-check
/**
 * @file ESLint flat configuration.
 * @module eslint.config
 *
 * @description
 * Flat config (ESLint 9+). Pairs `eslint:recommended` with Node-specific rules
 * (`eslint-plugin-n`) and JSDoc enforcement (`eslint-plugin-jsdoc`) per ADR-0001.
 * Prettier governs formatting; this file avoids any rule that conflicts with it.
 *
 * @see docs/adr/0001-project-conventions.md
 */

// SECTION: Imports
import js from '@eslint/js';
import n from 'eslint-plugin-n';
import jsdoc from 'eslint-plugin-jsdoc';
import globals from 'globals';

// SECTION: Configuration
/** @type {import('eslint').Linter.Config[]} */
export default [
  // ANCHOR: IgnorePatterns — paths never linted
  {
    ignores: [
      'node_modules/**',
      'output/**',
      'logs/**',
      '.auth/**',
      'coverage/**',
      'test/.tmp/**',
      'test/fixtures/static-site/**',
      'src/types/**', // generated
      'package-lock.json',
      'spikes/**', // Phase-0 throwaway spikes with their own pinned deps; not toolkit source
    ],
  },

  // ANCHOR: BaseRules — recommended JS rules
  js.configs.recommended,

  // ANCHOR: NodeRules — recommended Node rules
  n.configs['flat/recommended-module'],

  // ANCHOR: JSDocRules — recommended JSDoc rules
  jsdoc.configs['flat/recommended'],

  // ANCHOR: ProjectRules — our customisations
  {
    files: ['**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2023,
      },
    },
    settings: {
      jsdoc: {
        mode: 'typescript',
      },
    },
    rules: {
      // JSDoc is required on every exported symbol, optional on internal helpers.
      'jsdoc/require-jsdoc': [
        'warn',
        {
          publicOnly: true,
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
            ArrowFunctionExpression: false,
            FunctionExpression: false,
          },
        },
      ],
      'jsdoc/require-param-description': 'off',
      'jsdoc/require-returns-description': 'off',
      'jsdoc/tag-lines': ['warn', 'any', { startLines: 1 }],
      'jsdoc/no-undefined-types': 'off', // typescript mode handles this via @ts-check

      // Node-plugin rule tuning.
      // NOTE: unpublished dev deps (prettier, typescript, etc.) must not appear in source.
      'n/no-missing-import': 'off', // @ts-check + Node's own resolver is enough
      'n/no-unpublished-import': 'off', // dev files routinely import dev deps

      // Base-rule tuning.
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off', // commands still use console during Layer 0; replaced by pino in Layer 1
    },
  },

  // ANCHOR: TestRules — relaxed JSDoc for tests
  {
    files: ['test/**/*.mjs'],
    rules: {
      'jsdoc/require-jsdoc': 'off',
    },
  },
];
