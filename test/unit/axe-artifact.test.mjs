// @ts-check
/**
 * @file Tests for the shared scan-artifact projection helpers.
 * @module test/unit/axe-artifact
 *
 * @description
 * `liftRuleSummaries` (lean 7-key, for passes/inapplicable) and
 * `liftIncompleteSummaries` (the 7-key superset + condensed `examples` for
 * incomplete results) are the single source of truth shared by `scan.mjs` and
 * `process-runner.mjs`. The 7-key guard proves passes/inapplicable stay lean;
 * the examples coverage proves needs-review evidence is retained.
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liftRuleSummaries, liftIncompleteSummaries } from '../../src/lib/axe-artifact.mjs';

// SECTION: liftRuleSummaries (lean)

test('liftRuleSummaries: exactly the 7-key lean shape, no nodes bulk', () => {
  const out = liftRuleSummaries([
    {
      id: 'image-alt',
      tags: ['wcag111'],
      impact: 'critical',
      help: 'h',
      helpUrl: 'u',
      nodes: [
        { target: ['img.a'], html: '<img class="a">' },
        { target: ['img.b'], html: '<img>' },
      ],
    },
  ]);
  assert.deepEqual(Object.keys(out[0]).sort(), [
    'firstTarget',
    'help',
    'helpUrl',
    'id',
    'impact',
    'nodesCount',
    'tags',
  ]);
  assert.equal(out[0].nodesCount, 2);
  assert.equal(out[0].firstTarget, 'img.a');
});

// SECTION: liftIncompleteSummaries (superset + examples)

test('liftIncompleteSummaries: superset adds condensed {target, html} examples', () => {
  const out = liftIncompleteSummaries([
    {
      id: 'color-contrast',
      tags: ['wcag143'],
      impact: 'serious',
      help: 'h',
      helpUrl: 'u',
      nodes: [
        { target: ['.a', '.b'], html: '<span class="a">' },
        { target: ['.c'], html: '<span class="c">' },
      ],
    },
  ]);
  const row = out[0];
  assert.deepEqual(Object.keys(row).sort(), [
    'examples',
    'firstTarget',
    'help',
    'helpUrl',
    'id',
    'impact',
    'nodesCount',
    'tags',
  ]);
  assert.equal(row.nodesCount, 2);
  assert.equal(row.firstTarget, '.a');
  // target joined with ' | ' to match the violation selector format.
  assert.deepEqual(row.examples, [
    { target: '.a | .b', html: '<span class="a">', failureSummary: null },
    { target: '.c', html: '<span class="c">', failureSummary: null },
  ]);
});

test('liftIncompleteSummaries: zero-node incomplete -> examples: []', () => {
  const out = liftIncompleteSummaries([{ id: 'x', tags: [], impact: null, nodes: [] }]);
  assert.equal(out[0].nodesCount, 0);
  assert.deepEqual(out[0].examples, []);
});

test('liftIncompleteSummaries: non-array input / missing nodes are safe', () => {
  assert.deepEqual(liftIncompleteSummaries(/** @type {any} */ (null)), []);
  const out = liftIncompleteSummaries([{ id: 'x' }]);
  assert.deepEqual(out[0].examples, []);
  assert.equal(out[0].nodesCount, 0);
});

test('liftIncompleteSummaries: non-array target / non-string html -> nulls', () => {
  const out = liftIncompleteSummaries([
    {
      id: 'x',
      nodes: [
        { target: 'not-array', html: 123 },
        { target: [], html: '<b>' },
      ],
    },
  ]);
  assert.deepEqual(out[0].examples, [
    { target: null, html: null, failureSummary: null },
    { target: null, html: '<b>', failureSummary: null },
  ]);
});

test('liftIncompleteSummaries: failureSummary retained per example; cap bounds examples, not nodesCount', () => {
  const nodes = Array.from({ length: 30 }, (_, i) => ({
    target: [`#el-${i}`],
    html: `<div id="el-${i}"></div>`,
    failureSummary: `Fix any of the following for el-${i}`,
  }));
  const [lifted] = liftIncompleteSummaries(
    [{ id: 'color-contrast', tags: [], impact: 'serious', help: '', helpUrl: '', nodes }],
    25,
  );
  assert.equal(lifted.nodesCount, 30, 'true total preserved');
  assert.equal(lifted.examples.length, 25, 'examples bounded by the cap');
  assert.equal(lifted.examples[0].failureSummary, 'Fix any of the following for el-0');
  const [defaulted] = liftIncompleteSummaries([
    { id: 'x', tags: [], impact: null, help: '', helpUrl: '', nodes },
  ]);
  assert.equal(defaulted.examples.length, 25, 'default cap applies');
});
