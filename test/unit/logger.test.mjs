// @ts-check
/**
 * @file Unit tests for the logger factory's tool-identity bindings.
 * @module test/unit/logger
 *
 * @description
 * Locks the Layer 3b carry-forward: every JSON log record carries the
 * toolkit + axe-core identity as base bindings (previously stamped on
 * emitted artefacts only), so piped/persisted logs are attributable to the
 * exact versions that produced them. Also covers the getLogger singleton,
 * previously untested.
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLogger, getLogger, _resetLoggerForTests } from '../../src/lib/logger.mjs';
import { TOOL_IDENTITY } from '../../src/lib/version.mjs';

// SECTION: Tests

test('createLogger: JSON-mode records carry tool identity base bindings', () => {
  const logger = createLogger({ prettyOverride: false, level: 'silent' });
  const bindings = logger.bindings();
  assert.equal(bindings.tool, TOOL_IDENTITY.name);
  assert.equal(bindings.toolVersion, TOOL_IDENTITY.version);
  assert.equal(bindings.axeCore, TOOL_IDENTITY.axeCore);
  // NOTE: pid is also in base but pino's bindings() accessor filters the
  // default pid/hostname keys; it still lands on emitted records.
});

test('getLogger: returns a singleton until reset', () => {
  _resetLoggerForTests();
  const a = getLogger({ prettyOverride: false, level: 'silent' });
  const b = getLogger();
  assert.strictEqual(a, b, 'same instance across calls');
  _resetLoggerForTests();
  const c = getLogger({ prettyOverride: false, level: 'silent' });
  assert.notStrictEqual(a, c, 'reset produces a fresh instance');
  assert.equal(c.bindings().tool, TOOL_IDENTITY.name, 'singleton carries the identity too');
  _resetLoggerForTests();
});
