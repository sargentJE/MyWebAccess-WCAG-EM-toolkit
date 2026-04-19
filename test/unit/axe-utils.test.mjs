// @ts-check
/**
 * @file Tests for `findMatchingOverride` and `applyAxeOverride` — Layer 3a's
 *   per-URL axe override runtime.
 * @module test/unit/axe-utils
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  findMatchingOverride,
  applyAxeOverride,
  isValidRunOnly,
} from '../../src/lib/axe-utils.mjs';

// SECTION: Fixtures

const overrideAdmin = {
  urlPattern: '^https://example\\.com/admin',
  regex: /^https:\/\/example\.com\/admin/,
  withRules: ['color-contrast'],
  runOnly: null,
};

const overrideCheckout = {
  urlPattern: '^https://example\\.com/checkout',
  regex: /^https:\/\/example\.com\/checkout/,
  withTags: ['wcag22aa'],
};

// SECTION: findMatchingOverride tests

test('findMatchingOverride returns null for empty overridesCompiled', () => {
  assert.equal(findMatchingOverride('https://example.com/admin', []), null);
});

test('findMatchingOverride returns null when array is not an array', () => {
  assert.equal(
    findMatchingOverride('https://example.com/admin', /** @type {any} */ (null)),
    null,
  );
});

test('findMatchingOverride returns the matching entry', () => {
  const result = findMatchingOverride('https://example.com/admin/users', [
    overrideAdmin,
    overrideCheckout,
  ]);
  assert.equal(result, overrideAdmin);
});

test('findMatchingOverride: first match wins when multiple overrides match', () => {
  const broader = {
    urlPattern: '^https://example\\.com/',
    regex: /^https:\/\/example\.com\//,
    withTags: ['wcag2a'],
  };
  // broader appears first — should win even though overrideAdmin also matches.
  const result = findMatchingOverride('https://example.com/admin/users', [
    broader,
    overrideAdmin,
  ]);
  assert.equal(result, broader);
});

test('findMatchingOverride returns null when no override matches', () => {
  const result = findMatchingOverride('https://other-site.com/page', [
    overrideAdmin,
    overrideCheckout,
  ]);
  assert.equal(result, null);
});

test('findMatchingOverride skips entries with a non-RegExp regex', () => {
  const malformed = /** @type {any} */ ({ urlPattern: '^/admin', regex: null });
  const result = findMatchingOverride('https://example.com/admin', [
    malformed,
    overrideAdmin,
  ]);
  assert.equal(result, overrideAdmin, 'falls through to the next valid entry');
});

// SECTION: applyAxeOverride tests

test('applyAxeOverride returns base when override is null', () => {
  const base = { include: ['main'], withTags: ['wcag2a'] };
  assert.equal(applyAxeOverride(base, null), base);
});

test('applyAxeOverride returns base when override is undefined', () => {
  const base = { include: ['main'], withTags: ['wcag2a'] };
  assert.equal(applyAxeOverride(base, undefined), base);
});

test('applyAxeOverride replaces a single key; inherits the rest', () => {
  const base = { include: ['main'], withTags: ['wcag2a'], runOnly: null };
  const result = applyAxeOverride(base, { withRules: ['color-contrast'] });
  assert.deepEqual(result.include, ['main'], 'base include inherited');
  assert.deepEqual(result.withTags, ['wcag2a'], 'base withTags inherited');
  assert.deepEqual(result.withRules, ['color-contrast'], 'override withRules applied');
  assert.equal(result.runOnly, null, 'base runOnly inherited');
});

test('applyAxeOverride: runOnly:null in override CLEARS, not inherits', () => {
  // F11 contract: defined-as-null must replace, not be treated as absent.
  const base = {
    include: [],
    withTags: ['wcag2aa'],
    runOnly: { type: 'tag', values: ['wcag2aa'] },
  };
  const result = applyAxeOverride(base, { runOnly: null });
  assert.equal(result.runOnly, null, 'override runOnly:null cleared base');
  assert.deepEqual(result.withTags, ['wcag2aa'], 'untouched keys inherited');
});

test('applyAxeOverride does not mutate base or override', () => {
  const base = { include: ['main'], withTags: ['wcag2a'] };
  const override = { include: ['#content'] };
  const result = applyAxeOverride(base, override);
  assert.deepEqual(base, { include: ['main'], withTags: ['wcag2a'] });
  assert.deepEqual(override, { include: ['#content'] });
  assert.notEqual(result, base);
});

test('applyAxeOverride ignores non-replaceable keys (urlPattern, actions, regex)', () => {
  const base = { include: [], withTags: ['wcag2a'] };
  const result = applyAxeOverride(base, {
    urlPattern: '^/admin',
    regex: /^\/admin/,
    actions: [{ action: 'click', selector: 'button' }],
    withTags: ['wcag22aa'],
  });
  assert.deepEqual(result.withTags, ['wcag22aa'], 'withTags IS a replaceable key');
  assert.ok(!('urlPattern' in result), 'urlPattern is metadata, not axe-config');
  assert.ok(!('regex' in result), 'regex is an internal detail');
  assert.ok(!('actions' in result), 'actions are Layer 3b — not surfaced here');
});

test('isValidRunOnly still functions after R3 additions', () => {
  // Regression guard — R3 added constants above this function's location.
  assert.equal(isValidRunOnly({ type: 'tag', values: ['wcag2aa'] }), true);
  assert.equal(isValidRunOnly(null), false);
  assert.equal(isValidRunOnly({ type: 'tag' }), false);
});
