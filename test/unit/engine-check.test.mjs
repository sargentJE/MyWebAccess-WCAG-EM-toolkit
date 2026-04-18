// @ts-check
/**
 * @file Unit tests for `isNodeVersionSupported`.
 * @module test/unit/engine-check
 *
 * @description
 * Locks in the Node >=22.11.0 boundary that the CLI's inline engine guard
 * enforces. Six boundary cases cover the accept/reject edge and malformed
 * input. If this suite drifts from the inline check at
 * `bin/wcag-em.mjs:22-33`, one of the two is wrong.
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isNodeVersionSupported } from '../../src/lib/engine-check.mjs';

// SECTION: Tests

test('accepts the current runtime (22.22.0)', () => {
  assert.strictEqual(isNodeVersionSupported('22.22.0'), true);
});

test('accepts the boundary exactly (22.11.0)', () => {
  assert.strictEqual(isNodeVersionSupported('22.11.0'), true);
});

test('rejects below the boundary (22.10.9)', () => {
  assert.strictEqual(isNodeVersionSupported('22.10.9'), false);
});

test('rejects a previous major (20.19.6)', () => {
  assert.strictEqual(isNodeVersionSupported('20.19.6'), false);
});

test('accepts a future major (23.4.0)', () => {
  assert.strictEqual(isNodeVersionSupported('23.4.0'), true);
});

test('accepts leading-v form (v22.11.0)', () => {
  assert.strictEqual(isNodeVersionSupported('v22.11.0'), true);
});
