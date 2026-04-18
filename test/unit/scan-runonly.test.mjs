// @ts-check
/**
 * @file Unit tests for `isValidRunOnly` predicate.
 * @module test/unit/scan-runonly
 *
 * @description
 * Regression cover for the runtime guard in `src/commands/scan.mjs` that
 * keeps malformed `runOnly` shapes away from `AxeBuilder.options()`. The
 * Ajv schema already rejects bad shapes at config-load; this predicate
 * protects programmatic callers who skip validation.
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidRunOnly } from '../../src/lib/axe-utils.mjs';

// SECTION: Tests

test('accepts a well-formed tag runOnly', () => {
  assert.strictEqual(isValidRunOnly({ type: 'tag', values: ['wcag2a'] }), true);
});

test('rejects runOnly missing values', () => {
  assert.strictEqual(isValidRunOnly({ type: 'tag' }), false);
});

test('rejects runOnly missing type', () => {
  assert.strictEqual(isValidRunOnly({ values: ['wcag2a'] }), false);
});

test('rejects runOnly with non-array values', () => {
  assert.strictEqual(isValidRunOnly({ type: 'tag', values: 'wcag2a' }), false);
});

test('rejects null runOnly', () => {
  assert.strictEqual(isValidRunOnly(null), false);
});

test('rejects string runOnly', () => {
  assert.strictEqual(isValidRunOnly('tag'), false);
});
