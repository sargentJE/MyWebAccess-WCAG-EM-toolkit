// @ts-check
/**
 * @file Tests for `liftRuleSummaries` — Layer 3b R6's scan-artefact widening.
 * @module test/unit/scan-result-widening
 *
 * @description
 * R6 widens `axe-results.json` and `process-results.json` with per-rule
 * `*Detail` arrays so R10's `toWcagEmSummary` can compute `passed` /
 * `cantTell` / `inapplicable` SC verdicts. The contract:
 *   - Count keys preserved (backward compat).
 *   - New Detail arrays have shape `{id, tags, impact, nodesCount}`.
 *   - `nodes` bulk is intentionally NOT persisted — keeps artefact size bounded.
 *   - `nodesCount > 0` is the F8 signal distinguishing reviewable incompletes
 *     from infra-failure incompletes.
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liftRuleSummaries } from '../../src/commands/scan.mjs';

// SECTION: Tests

test('liftRuleSummaries: typical pass rule → {id, tags, impact:null, nodesCount}', () => {
  const out = liftRuleSummaries([
    {
      id: 'image-alt',
      tags: ['cat.text-alternatives', 'wcag2a', 'wcag111'],
      impact: null,
      nodes: [{ html: '<img ...>' }, { html: '<img ...>' }],
    },
  ]);
  assert.deepEqual(out, [
    {
      id: 'image-alt',
      tags: ['cat.text-alternatives', 'wcag2a', 'wcag111'],
      impact: null,
      nodesCount: 2,
    },
  ]);
});

test('liftRuleSummaries: violation with impact preserved', () => {
  const out = liftRuleSummaries([
    {
      id: 'color-contrast',
      tags: ['wcag143', 'wcag2aa'],
      impact: 'serious',
      nodes: [{}],
    },
  ]);
  assert.equal(out[0].impact, 'serious');
  assert.equal(out[0].nodesCount, 1);
});

test('liftRuleSummaries: incomplete with zero nodes (infra failure signal for R10 F8)', () => {
  const out = liftRuleSummaries([
    {
      id: 'color-contrast',
      tags: ['wcag143'],
      impact: null,
      nodes: [],
    },
  ]);
  assert.equal(out[0].nodesCount, 0, 'zero nodes signals infra failure, not reviewable');
});

test('liftRuleSummaries: missing/malformed fields default safely', () => {
  const out = liftRuleSummaries([/** @type {any} */ ({ id: 'no-tags' }), /** @type {any} */ ({})]);
  assert.equal(out[0].id, 'no-tags');
  assert.deepEqual(out[0].tags, []);
  assert.equal(out[0].impact, null);
  assert.equal(out[0].nodesCount, 0);
  assert.equal(out[1].id, '', 'missing id coerces to empty string');
});

test('liftRuleSummaries: non-array input → []', () => {
  assert.deepEqual(liftRuleSummaries(/** @type {any} */ (null)), []);
  assert.deepEqual(liftRuleSummaries(/** @type {any} */ (undefined)), []);
  assert.deepEqual(liftRuleSummaries(/** @type {any} */ ('not an array')), []);
});

test('liftRuleSummaries: empty array → empty array (preserves identity-less shape)', () => {
  assert.deepEqual(liftRuleSummaries([]), []);
});

test('liftRuleSummaries: tags are copied, not aliased', () => {
  const input = { id: 'x', tags: ['a'], impact: null, nodes: [] };
  const out = liftRuleSummaries([input]);
  out[0].tags.push('mutated');
  assert.deepEqual(input.tags, ['a'], 'caller input must not be mutated');
});

test('liftRuleSummaries does NOT persist nodes bulk (artefact-size guard)', () => {
  const out = liftRuleSummaries([
    {
      id: 'image-alt',
      tags: ['wcag111'],
      impact: null,
      nodes: Array.from({ length: 1000 }, () => ({ html: 'x'.repeat(1000) })),
    },
  ]);
  assert.equal(out[0].nodesCount, 1000);
  // Structural guard: the output object has exactly 4 keys, none of them `nodes`.
  assert.deepEqual(Object.keys(out[0]).sort(), ['id', 'impact', 'nodesCount', 'tags']);
});
