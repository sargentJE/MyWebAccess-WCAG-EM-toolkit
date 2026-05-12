// @ts-check
/**
 * @file Tests for the EARL JSON-LD reporter — Layer 4 R6.
 * @module test/unit/reporters-earl
 *
 * @description
 * Asserts the per-violation Assertion model + outcome-mapping table +
 * `includePasses` opt-in for per-SC `earl:passed` Assertions.
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import * as earlReporter from '../../src/reporters/earl-jsonld.mjs';
import { listReporters } from '../../src/reporters/index.mjs';
import { TOOL_IDENTITY } from '../../src/lib/version.mjs';

// SECTION: Helpers

/**
 * Build a tmp ctx + parsed earl.jsonld document for a given summary.
 *
 * @param {{ after: (fn: () => any) => void }} t
 * @param {Record<string, any>} summary
 * @param {{ includePasses?: boolean, wcagEm?: Record<string, any> }} [opts]
 * @returns {Promise<{ doc: any, raw: string }>}
 */
async function emitAndRead(t, summary, opts = {}) {
  const reportsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reporters-earl-'));
  t.after(() => fs.rm(reportsDir, { recursive: true, force: true }));
  const ctx = {
    paths: { reportsDir },
    config: {
      reporting: { includePasses: Boolean(opts.includePasses) },
      wcagEm: opts.wcagEm ?? {},
    },
  };
  await earlReporter.emit(summary, ctx);
  const raw = await fs.readFile(path.join(reportsDir, 'earl.jsonld'), 'utf8');
  return { doc: JSON.parse(raw), raw };
}

// SECTION: Tests

test('earl reporter: empty findings produces a parseable doc with the EARL @context', async (t) => {
  const { doc } = await emitAndRead(t, {
    tool: TOOL_IDENTITY,
    findings: [],
  });
  assert.equal(doc['@context'], 'http://www.w3.org/ns/earl#');
  assert.deepEqual(doc['@graph'], []);
});

test('earl reporter: failed finding emits one Assertion per (rule × url) pair', async (t) => {
  const { doc } = await emitAndRead(t, {
    tool: TOOL_IDENTITY,
    findings: [
      {
        id: 'image-alt',
        impact: 'critical',
        classification: 'primary-automated-finding',
        help: 'Images must have alt text',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.11/image-alt',
        targets: ['img'],
        pages: ['https://example.com/a', 'https://example.com/b'],
      },
    ],
  });
  assert.equal(doc['@graph'].length, 2, 'two pages → two Assertions');
  for (const a of doc['@graph']) {
    assert.equal(a['@type'], 'earl:Assertion');
    assert.equal(a['earl:test'], 'image-alt');
    assert.equal(a['earl:mode'], 'earl:automatic');
    assert.equal(a['earl:result']['earl:outcome'], 'earl:failed');
    assert.equal(a['earl:result']['earl:pointer'], 'img');
    assert.equal(a['earl:assertedBy']['@type'], 'earl:Assertor');
    assert.equal(a['earl:assertedBy']['doap:name'], TOOL_IDENTITY.name);
  }
  const subjects = doc['@graph'].map((/** @type {any} */ a) => a['earl:subject']).sort();
  assert.deepEqual(subjects, ['https://example.com/a', 'https://example.com/b']);
});

test('earl reporter: outcome mapping for incomplete → cantTell, inapplicable → inapplicable', async (t) => {
  const { doc } = await emitAndRead(t, {
    tool: TOOL_IDENTITY,
    findings: [
      {
        id: 'rule-incomplete',
        outcome: 'incomplete',
        impact: null,
        classification: 'best-practice-or-manual-review',
        targets: ['main'],
        pages: ['https://example.com/x'],
      },
      {
        id: 'rule-inapplicable',
        outcome: 'inapplicable',
        impact: null,
        classification: 'best-practice-or-manual-review',
        targets: [],
        pages: ['https://example.com/y'],
      },
    ],
  });
  const byTest = Object.fromEntries(
    doc['@graph'].map((/** @type {any} */ a) => [a['earl:test'], a['earl:result']['earl:outcome']]),
  );
  assert.equal(byTest['rule-incomplete'], 'earl:cantTell');
  assert.equal(byTest['rule-inapplicable'], 'earl:inapplicable');
});

test('earl reporter: includePasses=false skips per-SC passed Assertions', async (t) => {
  const { doc } = await emitAndRead(
    t,
    {
      tool: TOOL_IDENTITY,
      site: 'https://example.com',
      findings: [],
      wcagEmSummary: {
        criteriaOutcomes: [
          { sc: '1.1.1 Non-text Content', outcome: 'passed' },
          { sc: '1.4.3 Contrast (Minimum)', outcome: 'failed' },
        ],
      },
    },
    { includePasses: false },
  );
  assert.equal(doc['@graph'].length, 0, 'no failed findings + no passes opt-in → empty graph');
});

test('earl reporter: includePasses=true emits earl:passed for each passed criterion', async (t) => {
  const { doc } = await emitAndRead(
    t,
    {
      tool: TOOL_IDENTITY,
      site: 'https://example.com',
      findings: [],
      wcagEmSummary: {
        criteriaOutcomes: [
          { sc: '1.1.1 Non-text Content', outcome: 'passed' },
          { sc: '1.4.3 Contrast (Minimum)', outcome: 'failed' },
          { sc: '2.4.1 Bypass Blocks', outcome: 'passed' },
        ],
      },
    },
    { includePasses: true },
  );
  const passed = doc['@graph'].filter(
    (/** @type {any} */ a) => a['earl:result']['earl:outcome'] === 'earl:passed',
  );
  assert.equal(passed.length, 2, 'two passed criteria emitted');
  const tests = passed.map((/** @type {any} */ a) => a['earl:test']).sort();
  assert.deepEqual(tests, ['1.1.1 Non-text Content', '2.4.1 Bypass Blocks']);
  for (const a of passed) {
    assert.equal(a['earl:subject'], 'https://example.com');
  }
});

test('earl reporter: registry now lists earl-jsonld', () => {
  const names = listReporters();
  assert.ok(names.includes('earl-jsonld'), 'earl-jsonld registered after R6');
  assert.deepEqual(names, [...names].sort(), 'list remains sorted');
});

test('earl reporter: assertions are emitted in stable order (sortFindings semantics)', async (t) => {
  const { doc } = await emitAndRead(t, {
    tool: TOOL_IDENTITY,
    findings: [
      // Deliberately unsorted by impact; sortFindings should reorder.
      { id: 'zzz-low', impact: 'minor', targets: ['p'], pages: ['https://example.com/'] },
      { id: 'aaa-high', impact: 'critical', targets: ['img'], pages: ['https://example.com/'] },
      { id: 'mmm-mid', impact: 'serious', targets: ['button'], pages: ['https://example.com/'] },
    ],
  });
  const order = doc['@graph'].map((/** @type {any} */ a) => a['earl:test']);
  assert.deepEqual(order, ['aaa-high', 'mmm-mid', 'zzz-low']);
});

// SECTION: D4 regression — evaluator propagation

test('earl reporter: evaluator from wcagEm config appears in earl:assertedBy (D4)', async (t) => {
  const { doc } = await emitAndRead(
    t,
    {
      tool: TOOL_IDENTITY,
      findings: [
        { id: 'image-alt', impact: 'critical', targets: ['img'], pages: ['https://example.com/'] },
      ],
    },
    { wcagEm: { evaluator: { name: 'D4-regression-evaluator', contact: 'test@d4.example' } } },
  );
  assert.equal(doc['@graph'].length, 1);
  const assertor = doc['@graph'][0]['earl:assertedBy'];
  assert.equal(assertor['doap:name'], TOOL_IDENTITY.name, 'tool identity preserved');
  assert.equal(assertor['doap:release'], TOOL_IDENTITY.version, 'tool version preserved');
  assert.equal(assertor['foaf:name'], 'D4-regression-evaluator', 'evaluator name stamped');
  assert.equal(assertor['foaf:mbox'], 'test@d4.example', 'evaluator contact stamped');
});

test('earl reporter: empty evaluator config omits foaf:name from assertedBy (D4)', async (t) => {
  const { doc } = await emitAndRead(
    t,
    {
      tool: TOOL_IDENTITY,
      findings: [
        { id: 'image-alt', impact: 'critical', targets: ['img'], pages: ['https://example.com/'] },
      ],
    },
    { wcagEm: { evaluator: { name: '', contact: '' } } },
  );
  assert.equal(doc['@graph'].length, 1);
  const assertor = doc['@graph'][0]['earl:assertedBy'];
  assert.equal(assertor['doap:name'], TOOL_IDENTITY.name, 'tool identity preserved');
  assert.ok(!('foaf:name' in assertor), 'empty evaluator name must NOT appear');
  assert.ok(!('foaf:mbox' in assertor), 'empty evaluator contact must NOT appear');
});
