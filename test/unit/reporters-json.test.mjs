// @ts-check
/**
 * @file Tests for the JSON reporter + reporter registry — Layer 4 R3.
 * @module test/unit/reporters-json
 *
 * @description
 * Asserts the JSON reporter's output shape (tool-identity first, findings
 * routed through `sortFindings`) and the registry's basic guarantees
 * (registered reporters discoverable, unknown names fail fast, errors
 * collected per-reporter).
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import * as jsonReporter from '../../src/reporters/json.mjs';
import { runReporters, listReporters } from '../../src/reporters/index.mjs';

// SECTION: Helpers

/**
 * Build a minimal ctx-shape with a tmp reportsDir for one test run.
 * Registers the cleanup with the supplied test context's `after` so a
 * test that errors mid-run still tidies up.
 *
 * @param {{ after: (fn: () => any) => void }} t
 * @returns {Promise<{ ctx: any, reportsDir: string }>}
 */
async function makeCtx(t) {
  const reportsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reporters-json-'));
  t.after(() => fs.rm(reportsDir, { recursive: true, force: true }));
  return { ctx: { paths: { reportsDir } }, reportsDir };
}

// SECTION: JSON reporter

test('json reporter: tool field is the first key of the emitted JSON', async (t) => {
  const reportsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reporters-json-'));
  t.after(() => fs.rm(reportsDir, { recursive: true, force: true }));
  const ctx = { paths: { reportsDir } };
  const summary = {
    tool: { name: 'wcag-em-toolkit', version: '0.3.0' },
    site: 'example.com',
    findings: [],
  };
  await jsonReporter.emit(summary, ctx);
  const raw = await fs.readFile(path.join(reportsDir, 'summary.json'), 'utf8');
  // Trust the JSON spec parser instead of regex-matching whitespace —
  // robust to indentation changes, BOMs, line-ending variants. Insertion
  // order of own enumerable string keys is preserved per ES2015+.
  const firstKey = Object.keys(JSON.parse(raw))[0];
  assert.equal(firstKey, 'tool', 'tool must be the first JSON key');
});

test('json reporter: findings are sorted by [impact desc, ruleId asc]', async (t) => {
  const reportsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reporters-json-'));
  t.after(() => fs.rm(reportsDir, { recursive: true, force: true }));
  const ctx = { paths: { reportsDir } };
  const summary = {
    tool: { name: 'wcag-em-toolkit', version: '0.3.0' },
    findings: [
      { id: 'zebra', impact: 'serious' },
      { id: 'alpha', impact: 'serious' },
      { id: 'b', impact: 'critical' },
      { id: 'a', impact: 'minor' },
    ],
  };
  await jsonReporter.emit(summary, ctx);
  const parsed = JSON.parse(await fs.readFile(path.join(reportsDir, 'summary.json'), 'utf8'));
  assert.deepEqual(
    parsed.findings.map((/** @type {any} */ f) => `${f.impact}:${f.id}`),
    ['critical:b', 'serious:alpha', 'serious:zebra', 'minor:a'],
  );
});

test('json reporter: returned bytes count matches the file size on disk', async (t) => {
  const { ctx } = await makeCtx(t);
  const summary = { tool: { name: 'x' }, findings: [] };
  const result = await jsonReporter.emit(summary, ctx);
  const stat = await fs.stat(result.path);
  assert.equal(result.bytes, stat.size);
  assert.ok(result.path.endsWith('summary.json'));
});

test('json reporter: wcagEmSummary propagates evaluator and metadata to summary.json (D4)', async (t) => {
  const { ctx, reportsDir } = await makeCtx(t);
  const summary = {
    tool: { name: 'wcag-em-toolkit', version: '0.3.0' },
    findings: [],
    wcagEmSummary: {
      wcagVersion: '2.1',
      conformanceTarget: 'AAA',
      evaluator: { name: 'D4-regression-evaluator', contact: 'test@d4.example' },
      criteriaOutcomes: [{ sc: '1.1.1', outcome: 'passed' }],
    },
  };
  await jsonReporter.emit(summary, ctx);
  const raw = await fs.readFile(path.join(reportsDir, 'summary.json'), 'utf8');
  const parsed = JSON.parse(raw);
  assert.equal(parsed.wcagEmSummary.evaluator.name, 'D4-regression-evaluator');
  assert.equal(parsed.wcagEmSummary.evaluator.contact, 'test@d4.example');
  assert.equal(parsed.wcagEmSummary.wcagVersion, '2.1');
  assert.equal(parsed.wcagEmSummary.conformanceTarget, 'AAA');
  assert.equal(parsed.wcagEmSummary.criteriaOutcomes[0].sc, '1.1.1');
});

// SECTION: Registry

test('registry: listReporters reports the registered names alphabetically', () => {
  // R3 registers exactly one reporter ('json'). R4-R7 will add markdown,
  // html, earl-jsonld, junit. This test will need extending as those land.
  const names = listReporters();
  assert.ok(names.includes('json'), 'json must be registered');
  assert.deepEqual(names, [...names].sort(), 'list must be sorted');
});

test('runReporters: unknown reporter name throws BEFORE any reporter runs', async (t) => {
  const reportsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reporters-json-'));
  t.after(() => fs.rm(reportsDir, { recursive: true, force: true }));
  const ctx = { paths: { reportsDir } };
  const summary = { tool: { name: 'x' }, findings: [] };

  await assert.rejects(
    () => runReporters(['json', 'no-such-reporter'], summary, ctx),
    /unknown reporter 'no-such-reporter'/,
  );
  // Even though 'json' was first in the list, fail-fast means it must NOT
  // have been emitted before the unknown name was rejected.
  await assert.rejects(() => fs.access(path.join(reportsDir, 'summary.json')), /ENOENT/);
});

test('runReporters: success path returns { results, errors:[] } and writes the file', async (t) => {
  const reportsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reporters-json-'));
  t.after(() => fs.rm(reportsDir, { recursive: true, force: true }));
  const ctx = { paths: { reportsDir } };
  const summary = {
    tool: { name: 'wcag-em-toolkit', version: '0.3.0' },
    findings: [{ id: 'a', impact: 'serious' }],
  };
  const outcome = await runReporters(['json'], summary, ctx);
  assert.equal(outcome.errors.length, 0);
  assert.equal(outcome.results.length, 1);
  assert.equal(outcome.results[0].name, 'json');
  await fs.access(path.join(reportsDir, 'summary.json')); // throws if missing
});

test('runReporters: non-array names throws TypeError', async () => {
  await assert.rejects(() => runReporters(/** @type {any} */ (null), {}, {}), /must be an array/);
});
