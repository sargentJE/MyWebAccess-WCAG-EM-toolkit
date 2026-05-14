// @ts-check
/**
 * @file Tests for `buildScreenshotPath` — screenshot-filename helper.
 * @module test/unit/scan-result-shape
 *
 * @description
 * `buildScreenshotPath` is the only multi-viewport scan-loop logic that's
 * testable without Playwright. The rest of the outer-viewport-loop shape
 * (findings tagged `viewport: vp.id`, per-viewport logging) is exercised
 * end-to-end in the reporter pipeline's deterministic-output fixture harness.
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

// SECTION: Format-aware extension

test('buildScreenshotPath defaults to .png extension when format is omitted', () => {
  const result = buildScreenshotPath('/out', 'https://example.com/p', { id: 'desktop' });
  assert.ok(result.endsWith('__desktop.png'));
});

test('buildScreenshotPath honours format=jpeg with a .jpg extension', () => {
  const result = buildScreenshotPath('/out', 'https://example.com/p', { id: 'desktop' }, 'jpeg');
  assert.ok(result.endsWith('__desktop.jpg'));
});

test('buildScreenshotPath: explicit format=png keeps .png (call-site safety net)', () => {
  const result = buildScreenshotPath('/out', 'https://example.com/p', { id: 'desktop' }, 'png');
  assert.ok(result.endsWith('__desktop.png'));
});

test('buildScreenshotPath: jpeg + reflow viewport — both axes flow through to filename', () => {
  const desktopPng = buildScreenshotPath('/out', 'https://example.com/x', { id: 'desktop' }, 'png');
  const reflowJpeg = buildScreenshotPath('/out', 'https://example.com/x', { id: 'reflow' }, 'jpeg');
  assert.ok(desktopPng.endsWith('__desktop.png'));
  assert.ok(reflowJpeg.endsWith('__reflow.jpg'));
  assert.notEqual(desktopPng, reflowJpeg);
});

test('buildScreenshotPath: unknown format value silently defaults to .png', () => {
  // Defensive — any non-'jpeg' value falls back to png. Documents the
  // behaviour so a future schema-tightening doesn't silently break
  // existing call sites.
  const result = buildScreenshotPath(
    '/out',
    'https://example.com/x',
    { id: 'desktop' },
    /** @type {any} */ ('unknown'),
  );
  assert.ok(result.endsWith('__desktop.png'));
});
