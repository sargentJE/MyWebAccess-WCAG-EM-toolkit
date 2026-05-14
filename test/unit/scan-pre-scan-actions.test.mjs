// @ts-check
/**
 * @file Tests for `filterActionsForUrl` — pre-scan action filter.
 * @module test/unit/scan-pre-scan-actions
 *
 * @description
 * `runPreScanActions` is tied to Playwright (uses `runProcessSteps` with a
 * live `Page`), so the unit layer exercises the PURE filter helper only.
 * Full integration coverage (actual beforeScan execution against a page)
 * lands alongside the reporter pipeline's fixture harness (documented in CHANGELOG).
 *
 * The filter invariants this file locks:
 *   - Actions WITHOUT `regex` (no `urlPattern`) run unconditionally.
 *   - Actions WITH `regex` run only when the URL matches.
 *   - Malformed actions (null, non-object) are dropped silently.
 *   - Non-array input → empty array.
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterActionsForUrl } from '../../src/commands/scan.mjs';

// SECTION: Tests

test('filterActionsForUrl: action without regex runs unconditionally', () => {
  const actions = [{ action: 'click', selector: '#x' }];
  const out = filterActionsForUrl('https://example.com/anything', actions);
  assert.equal(out.length, 1);
  assert.equal(out[0], actions[0]);
});

test('filterActionsForUrl: action with matching regex runs', () => {
  const actions = [{ action: 'click', selector: '#x', regex: /^https:\/\/example\.com\/admin/ }];
  const out = filterActionsForUrl('https://example.com/admin/users', actions);
  assert.equal(out.length, 1);
});

test('filterActionsForUrl: action with non-matching regex is skipped', () => {
  const actions = [{ action: 'click', selector: '#x', regex: /^https:\/\/example\.com\/admin/ }];
  const out = filterActionsForUrl('https://example.com/public', actions);
  assert.equal(out.length, 0);
});

test('filterActionsForUrl: mixed actions filter independently', () => {
  const always = { action: 'waitFor', timeoutMs: 100 };
  const adminOnly = { action: 'click', selector: '#x', regex: /^https:\/\/example\.com\/admin/ };
  const publicOnly = { action: 'fill', selector: '#q', regex: /^https:\/\/example\.com\/public/ };

  const adminUrl = filterActionsForUrl('https://example.com/admin/x', [
    always,
    adminOnly,
    publicOnly,
  ]);
  assert.deepEqual(adminUrl, [always, adminOnly]);

  const publicUrl = filterActionsForUrl('https://example.com/public/page', [
    always,
    adminOnly,
    publicOnly,
  ]);
  assert.deepEqual(publicUrl, [always, publicOnly]);
});

test('filterActionsForUrl: null/undefined/non-array input → []', () => {
  assert.deepEqual(filterActionsForUrl('https://x.com', /** @type {any} */ (null)), []);
  assert.deepEqual(filterActionsForUrl('https://x.com', /** @type {any} */ (undefined)), []);
  assert.deepEqual(filterActionsForUrl('https://x.com', /** @type {any} */ ('not array')), []);
});

test('filterActionsForUrl: malformed entries (null, non-object) are dropped', () => {
  const actions = /** @type {any[]} */ ([null, 'string', { action: 'click' }, undefined, 42]);
  const out = filterActionsForUrl('https://x.com', actions);
  assert.equal(out.length, 1);
  assert.equal(out[0].action, 'click');
});

test('filterActionsForUrl: regex that is not a RegExp is treated as absent (run unconditionally)', () => {
  // Defensive: if some serialisation leaks a string-looking regex that never got
  // upgraded by compileActionUrlPatterns, the action should still run (safe default)
  // — the compile invariant guarantees this doesn't happen for valid configs.
  const actions = [{ action: 'click', regex: /** @type {any} */ ('^/admin') }];
  const out = filterActionsForUrl('https://x.com/public', actions);
  assert.equal(out.length, 1, 'non-RegExp regex property is ignored');
});
