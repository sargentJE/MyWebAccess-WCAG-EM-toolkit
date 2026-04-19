// @ts-check
/**
 * @file Tests for `buildScreenshotPath` — Layer 3a's screenshot-filename
 *   helper.
 * @module test/unit/scan-result-shape
 *
 * @description
 * `buildScreenshotPath` is the only Layer 3a scan-loop logic that's
 * testable without Playwright. The rest of the outer-viewport-loop shape
 * (findings tagged `viewport: vp.id`, per-viewport logging) is exercised
 * end-to-end in Layer 4's deterministic-output fixture harness — tracked in
 * CHANGELOG [Unreleased] Layer 3 follow-ups.
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { buildScreenshotPath } from '../../src/commands/scan.mjs';

// SECTION: Tests

test('buildScreenshotPath encodes URL and suffixes with viewport id', () => {
  const result = buildScreenshotPath('/out/screenshots', 'https://example.com/page', {
    id: 'desktop',
  });
  assert.ok(result.startsWith(path.join('/out/screenshots', '')));
  assert.ok(result.endsWith('__desktop.png'));
});

test('buildScreenshotPath distinguishes the same URL across viewports', () => {
  const desktop = buildScreenshotPath('/out', 'https://example.com/x', { id: 'desktop' });
  const reflow = buildScreenshotPath('/out', 'https://example.com/x', { id: 'reflow' });
  assert.notEqual(desktop, reflow);
  assert.ok(desktop.endsWith('__desktop.png'));
  assert.ok(reflow.endsWith('__reflow.png'));
});

test('buildScreenshotPath is pure — same inputs yield same output', () => {
  const a = buildScreenshotPath('/out', 'https://x.com/a', { id: 'v1' });
  const b = buildScreenshotPath('/out', 'https://x.com/a', { id: 'v1' });
  assert.equal(a, b);
});
