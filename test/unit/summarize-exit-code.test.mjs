// @ts-check
/**
 * @file Tests for `computeExitCode` — Layer 3a's threshold-based exit code.
 * @module test/unit/summarize-exit-code
 *
 * @description
 * Pa11y-compatible semantics: a summary is "clean" (exit 0) unless the
 * number of findings matching `impacts` OR `classifications` meets the
 * configured `threshold`, in which case the process exits 2. This
 * contract is exercised as a pure function with in-memory summary
 * fixtures — no fixture server required.
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeExitCode } from '../../src/commands/summarize.mjs';

// SECTION: Fixtures

const defaultPolicy = {
  impacts: ['critical', 'serious'],
  classifications: [],
  threshold: 1,
};

const critical = { impact: 'critical', classification: 'primary-automated-finding' };
const serious = { impact: 'serious', classification: 'primary-automated-finding' };
const moderate = { impact: 'moderate', classification: 'primary-automated-finding' };
const bestPractice = { impact: 'moderate', classification: 'best-practice-or-manual-review' };

// SECTION: Tests — feature-off semantics

test('computeExitCode returns 0 when failOnFindings is null', () => {
  assert.equal(computeExitCode({ findings: [critical] }, null), 0);
});

test('computeExitCode returns 0 when failOnFindings is undefined', () => {
  assert.equal(computeExitCode({ findings: [critical] }, undefined), 0);
});

test('computeExitCode returns 0 when threshold is 0 (schema-valid but semantically-off)', () => {
  assert.equal(
    computeExitCode({ findings: [critical] }, { ...defaultPolicy, threshold: 0 }),
    0,
  );
});

test('computeExitCode returns 0 when threshold is negative or NaN', () => {
  assert.equal(
    computeExitCode({ findings: [critical] }, { ...defaultPolicy, threshold: -1 }),
    0,
  );
  assert.equal(
    computeExitCode(
      { findings: [critical] },
      { ...defaultPolicy, threshold: /** @type {any} */ ('oops') },
    ),
    0,
  );
});

test('computeExitCode returns 0 when both impacts and classifications are empty', () => {
  assert.equal(
    computeExitCode(
      { findings: [critical] },
      { impacts: [], classifications: [], threshold: 1 },
    ),
    0,
  );
});

// SECTION: Tests — default policy happy paths

test('default policy + one critical finding → exit 2', () => {
  assert.equal(computeExitCode({ findings: [critical] }, defaultPolicy), 2);
});

test('default policy + one serious finding → exit 2', () => {
  assert.equal(computeExitCode({ findings: [serious] }, defaultPolicy), 2);
});

test('default policy + only moderate findings → exit 0', () => {
  assert.equal(
    computeExitCode({ findings: [moderate, moderate, moderate] }, defaultPolicy),
    0,
  );
});

test('default policy + empty findings → exit 0', () => {
  assert.equal(computeExitCode({ findings: [] }, defaultPolicy), 0);
});

test('default policy + missing findings array → exit 0', () => {
  assert.equal(computeExitCode(/** @type {any} */ ({}), defaultPolicy), 0);
});

// SECTION: Tests — threshold semantics

test('threshold 3 + two serious findings → exit 0', () => {
  assert.equal(
    computeExitCode({ findings: [serious, serious] }, { ...defaultPolicy, threshold: 3 }),
    0,
  );
});

test('threshold 3 + three serious findings → exit 2 (meets threshold)', () => {
  assert.equal(
    computeExitCode(
      { findings: [serious, serious, serious] },
      { ...defaultPolicy, threshold: 3 },
    ),
    2,
  );
});

// SECTION: Tests — classification matching

test('classifications-only policy matches best-practice findings', () => {
  assert.equal(
    computeExitCode(
      { findings: [bestPractice] },
      { impacts: [], classifications: ['best-practice-or-manual-review'], threshold: 1 },
    ),
    2,
  );
});

test('impacts OR classifications — either triggers', () => {
  // Finding has moderate impact (not in impacts set) AND
  // classification best-practice (IS in classifications set)
  assert.equal(
    computeExitCode(
      { findings: [bestPractice] },
      {
        impacts: ['critical'],
        classifications: ['best-practice-or-manual-review'],
        threshold: 1,
      },
    ),
    2,
  );
});

test('findings without impact or classification properties are skipped', () => {
  assert.equal(
    computeExitCode(/** @type {any} */ ({ findings: [{}] }), defaultPolicy),
    0,
  );
});
