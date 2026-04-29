// @ts-check
/**
 * @file Tests for `sortFindings` — Layer 4 R3 deterministic sort contract.
 * @module test/unit/reporters-sort
 *
 * @description
 * Locks the 2-key contract for finding ordering used by every reporter:
 *   1. impact desc — critical > serious > moderate > minor > null
 *   2. ruleId asc tiebreak
 *
 * The function MUST NOT mutate its input. Non-array input returns an empty
 * array (defensive — reporters trust the helper not to throw on malformed
 * summary objects).
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortFindings, IMPACT_ORDER } from '../../src/reporters/_sort.mjs';

// SECTION: Tests

test('sortFindings: impact desc — critical first, minor last', () => {
  const input = [
    { id: 'a', impact: 'minor' },
    { id: 'b', impact: 'critical' },
    { id: 'c', impact: 'moderate' },
    { id: 'd', impact: 'serious' },
  ];
  const out = sortFindings(input);
  assert.deepEqual(
    out.map((f) => f.impact),
    ['critical', 'serious', 'moderate', 'minor'],
  );
});

test('sortFindings: ruleId asc tiebreak when impact is equal', () => {
  const input = [
    { id: 'zebra', impact: 'serious' },
    { id: 'alpha', impact: 'serious' },
    { id: 'mango', impact: 'serious' },
  ];
  const out = sortFindings(input);
  assert.deepEqual(
    out.map((f) => f.id),
    ['alpha', 'mango', 'zebra'],
  );
});

test('sortFindings: null impact sorts last (lowest priority)', () => {
  const input = [
    { id: 'b', impact: null },
    { id: 'a', impact: 'minor' },
    { id: 'c', impact: 'critical' },
  ];
  const out = sortFindings(input);
  assert.deepEqual(
    out.map((f) => f.id),
    ['c', 'a', 'b'],
  );
});

test('sortFindings: pure — input array is unchanged + new array is returned', () => {
  const input = [
    { id: 'b', impact: 'minor' },
    { id: 'a', impact: 'critical' },
  ];
  const inputSnapshot = JSON.stringify(input);
  const out = sortFindings(input);
  assert.notStrictEqual(out, input, 'returns a different array reference');
  assert.equal(JSON.stringify(input), inputSnapshot, 'input is byte-equal to its pre-call state');
  assert.deepEqual(
    out.map((f) => f.id),
    ['a', 'b'],
  );
});

test('sortFindings: defensive — non-array input returns []', () => {
  // Reporters trust this helper; throwing on malformed summary would
  // propagate as a reporter error and bump exit code to 1 even when
  // the underlying summary is fine.
  assert.deepEqual(sortFindings(/** @type {any} */ (null)), []);
  assert.deepEqual(sortFindings(/** @type {any} */ (undefined)), []);
  assert.deepEqual(sortFindings(/** @type {any} */ ('not-an-array')), []);
});

test('sortFindings: IMPACT_ORDER is frozen + matches the canonical priority', () => {
  // IMPACT_ORDER is exported so ADR-0008 + tests can reference the exact
  // ordering instead of duplicating the constants. Freezing prevents
  // accidental mutation by future code.
  assert.ok(Object.isFrozen(IMPACT_ORDER), 'IMPACT_ORDER must be frozen');
  assert.equal(IMPACT_ORDER.critical, 4);
  assert.equal(IMPACT_ORDER.serious, 3);
  assert.equal(IMPACT_ORDER.moderate, 2);
  assert.equal(IMPACT_ORDER.minor, 1);
  assert.equal(IMPACT_ORDER.null, 0);
});
