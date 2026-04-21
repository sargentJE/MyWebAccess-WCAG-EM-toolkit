// @ts-check
/**
 * @file Tests for axe-utils helpers — Layer 1's `classifyRule` / `isValidRunOnly`,
 *   Layer 3a's `findMatchingOverride` / `applyAxeOverride`, and Layer 3b's
 *   `withActAndWcagMetadata`.
 * @module test/unit/axe-utils
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  findMatchingOverride,
  applyAxeOverride,
  isValidRunOnly,
  withActAndWcagMetadata,
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

// SECTION: withActAndWcagMetadata tests (Layer 3b R2)

test('withActAndWcagMetadata: wcag111 tag parses to 1.1.1', () => {
  const result = withActAndWcagMetadata({ id: 'image-alt', tags: ['wcag111'] });
  assert.deepEqual(result.wcagCriteria, ['1.1.1']);
});

test('withActAndWcagMetadata: wcag143 tag parses to 1.4.3', () => {
  const result = withActAndWcagMetadata({ id: 'color-contrast', tags: ['wcag143'] });
  assert.deepEqual(result.wcagCriteria, ['1.4.3']);
});

test('withActAndWcagMetadata: conformance-level tags are skipped (wcag2aa, wcag21aa, wcag22aa)', () => {
  const result = withActAndWcagMetadata({
    id: 'color-contrast',
    tags: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
  });
  assert.deepEqual(result.wcagCriteria, []);
});

test('withActAndWcagMetadata BP1 contract: axe-core real-world tag mix produces exactly the SC tags', () => {
  // This is the regression guard against axe-core tag-format drift across
  // upgrades. The fixture below matches axe-core 4.11.x's actual tag shape
  // for color-contrast; the parser must produce exactly ['1.4.3'] — not the
  // conformance-level tags, not the category tag.
  const result = withActAndWcagMetadata({
    id: 'color-contrast',
    tags: ['cat.color', 'wcag143', 'wcag2aa', 'wcag21aa'],
  });
  assert.deepEqual(result.wcagCriteria, ['1.4.3']);
});

test('withActAndWcagMetadata: multiple SC tags → multiple entries, sorted', () => {
  const result = withActAndWcagMetadata({
    id: 'area-alt',
    tags: ['wcag244', 'wcag111', 'wcag412'],
  });
  assert.deepEqual(result.wcagCriteria, ['1.1.1', '2.4.4', '4.1.2']);
});

test('withActAndWcagMetadata: duplicate SC tags dedup (Set-backed)', () => {
  const result = withActAndWcagMetadata({
    id: 'image-alt',
    tags: ['wcag111', 'wcag111', 'wcag111'],
  });
  assert.deepEqual(result.wcagCriteria, ['1.1.1']);
});

test('withActAndWcagMetadata: unknown wcag-* format is silently skipped', () => {
  const result = withActAndWcagMetadata({
    id: 'some-rule',
    tags: ['wcag-unspecified-tag', 'wcag-future', 'wcag'],
  });
  assert.deepEqual(result.wcagCriteria, []);
});

test('withActAndWcagMetadata: actMap lookup returns the mapped ACT IDs', () => {
  const actMap = {
    'image-alt': ['23a2a8'],
    'color-contrast': ['afw4f7', '09o5cg'],
  };
  const imgResult = withActAndWcagMetadata({ id: 'image-alt', tags: [] }, { actMap });
  const ccResult = withActAndWcagMetadata({ id: 'color-contrast', tags: [] }, { actMap });
  assert.deepEqual(imgResult.actRuleIds, ['23a2a8']);
  assert.deepEqual(ccResult.actRuleIds, ['afw4f7', '09o5cg']);
});

test('withActAndWcagMetadata: rule absent from actMap → actRuleIds: []', () => {
  const actMap = { 'image-alt': ['23a2a8'] };
  const result = withActAndWcagMetadata({ id: 'unknown-rule', tags: [] }, { actMap });
  assert.deepEqual(result.actRuleIds, []);
});

test('withActAndWcagMetadata: empty/missing actMap → actRuleIds: [] on every call', () => {
  const a = withActAndWcagMetadata({ id: 'image-alt', tags: [] });
  const b = withActAndWcagMetadata({ id: 'image-alt', tags: [] }, { actMap: {} });
  assert.deepEqual(a.actRuleIds, []);
  assert.deepEqual(b.actRuleIds, []);
});

test('withActAndWcagMetadata: preserves classifyRule fields (bestPractice + classification)', () => {
  const result = withActAndWcagMetadata({
    id: 'region',
    tags: ['best-practice', 'wcag131'],
  });
  assert.equal(result.bestPractice, true);
  assert.equal(result.classification, 'best-practice-or-manual-review');
  assert.deepEqual(result.wcagCriteria, ['1.3.1']);
});

test('withActAndWcagMetadata: returns fresh actRuleIds array (does not leak actMap reference)', () => {
  const actMap = { 'image-alt': ['23a2a8'] };
  const result = withActAndWcagMetadata({ id: 'image-alt', tags: [] }, { actMap });
  result.actRuleIds.push('leaked');
  assert.deepEqual(actMap['image-alt'], ['23a2a8'], 'caller actMap must not mutate');
});
