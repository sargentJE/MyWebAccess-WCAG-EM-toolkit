// @ts-check
/**
 * @file Tests for `resolveViewports` + `DEFAULT_VIEWPORTS`.
 * @module test/unit/viewports
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_VIEWPORTS, resolveViewports } from '../../src/lib/viewports.mjs';

// SECTION: Fixtures

/**
 * Build a minimal mock logger that captures `warn` calls.
 *
 * @returns {{ warn: (obj: any, msg?: string) => void, calls: Array<{obj: any, msg: string|undefined}> }}
 */
function mockLogger() {
  /** @type {Array<{obj: any, msg: string|undefined}>} */
  const calls = [];
  return {
    calls,
    warn(obj, msg) {
      calls.push({ obj, msg });
    },
  };
}

// SECTION: Tests

test('DEFAULT_VIEWPORTS contains desktop 1280x800 and reflow 320x800', () => {
  assert.equal(DEFAULT_VIEWPORTS.length, 2);
  const desktop = DEFAULT_VIEWPORTS.find((v) => v.id === 'desktop');
  const reflow = DEFAULT_VIEWPORTS.find((v) => v.id === 'reflow');
  assert.ok(desktop, 'desktop viewport present');
  assert.equal(desktop.width, 1280);
  assert.equal(desktop.height, 800);
  assert.ok(reflow, 'reflow viewport present');
  assert.equal(reflow.width, 320);
  assert.equal(reflow.height, 800);
});

test('DEFAULT_VIEWPORTS is frozen so downstream mutation cannot leak', () => {
  assert.ok(Object.isFrozen(DEFAULT_VIEWPORTS));
  assert.ok(Object.isFrozen(DEFAULT_VIEWPORTS[0]));
});

test('resolveViewports returns DEFAULT_VIEWPORTS when config has neither viewports nor viewport', () => {
  const result = resolveViewports({ scan: {} });
  assert.equal(result, DEFAULT_VIEWPORTS);
});

test('resolveViewports returns DEFAULT_VIEWPORTS when config is empty', () => {
  const result = resolveViewports({});
  assert.equal(result, DEFAULT_VIEWPORTS);
});

test('resolveViewports returns user viewports[] when supplied (non-empty)', () => {
  const userViewports = [
    { id: 'wide', width: 1920, height: 1080 },
    { id: 'narrow', width: 375, height: 667 },
  ];
  const result = resolveViewports({ scan: { viewports: userViewports } });
  assert.equal(result, userViewports);
});

test('resolveViewports: user viewports[] wins over legacy viewport singleton', () => {
  const userViewports = [{ id: 'mobile', width: 375, height: 667 }];
  const logger = mockLogger();
  const result = resolveViewports(
    {
      scan: {
        viewports: userViewports,
        viewport: { width: 1440, height: 900 },
      },
    },
    logger,
  );
  assert.equal(result, userViewports);
  assert.equal(logger.calls.length, 0, 'no deprecation warn when viewports[] wins');
});

test('resolveViewports wraps legacy viewport singleton as [{id:"legacy",...}] and warns', () => {
  const logger = mockLogger();
  const result = resolveViewports({ scan: { viewport: { width: 1440, height: 900 } } }, logger);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'legacy');
  assert.equal(result[0].width, 1440);
  assert.equal(result[0].height, 900);
  assert.equal(logger.calls.length, 1);
  assert.match(logger.calls[0].msg ?? '', /deprecated/i);
});

test('resolveViewports: legacy path does not throw when logger omitted', () => {
  const result = resolveViewports({ scan: { viewport: { width: 800, height: 600 } } });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'legacy');
});

test('resolveViewports: DEFAULTS-side empty viewports:[] falls through to DEFAULT_VIEWPORTS', () => {
  // F2 nuance: user-side empty array is Ajv-rejected (minItems:1), but DEFAULTS
  // may ship `viewports: []` as a sentinel. That path falls through.
  const result = resolveViewports({ scan: { viewports: [] } });
  assert.equal(result, DEFAULT_VIEWPORTS);
});

test('resolveViewports ignores legacy viewport with missing width/height', () => {
  const logger = mockLogger();
  // Malformed legacy shape — should not wrap, should fall through.
  const result = resolveViewports(
    /** @type {any} */ ({ scan: { viewport: { width: 1440 } } }),
    logger,
  );
  assert.equal(result, DEFAULT_VIEWPORTS);
  assert.equal(logger.calls.length, 0, 'no warn for malformed legacy shape');
});
