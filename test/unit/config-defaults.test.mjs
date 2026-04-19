// @ts-check
/**
 * @file Tests for Layer 3a DEFAULTS and the F3 regression canary.
 * @module test/unit/config-defaults
 *
 * @description
 * Locks the shape of `DEFAULTS` after the Layer 3a overhaul:
 *   - legacy `scan.viewport` key REMOVED (so `resolveViewports` can fall
 *     through to `DEFAULT_VIEWPORTS`),
 *   - `scan.viewports: []` sentinel present,
 *   - `scan.waitUntil: 'domcontentloaded'`,
 *   - default tag profile in `scan.axe.withTags`,
 *   - `crawl.requestDelayMs: 0` (R7 wires it into discover),
 *   - `reporting.failOnFindings` threshold defaults (R8 wires the exit code).
 *
 * The F3 regression canary (last test) proves DEFAULT_VIEWPORTS is reachable
 * when a config supplies no viewport or viewports — the exact failure mode
 * the pressure-test caught before R6 landed.
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { loadConfig } from '../../src/lib/config.mjs';
import { DEFAULT_VIEWPORTS, resolveViewports } from '../../src/lib/viewports.mjs';

// SECTION: Helpers

/**
 * Write a minimal viewport-less config and return its path.
 *
 * @param {string} tmpdir
 * @returns {Promise<string>}
 */
async function writeMinimalConfig(tmpdir) {
  const configPath = path.join(tmpdir, 'config.json');
  await fs.writeFile(
    configPath,
    JSON.stringify({
      name: 'minimal',
      rootUrl: 'https://example.com/',
      scope: { mode: 'same-hostname' },
      sample: { structuredManual: [], randomSeed: 1 },
      scan: {},
    }),
  );
  return configPath;
}

// SECTION: DEFAULTS shape

test('DEFAULTS removed the legacy scan.viewport singleton', async (t) => {
  const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'config-defaults-'));
  t.after(() => fs.rm(tmpdir, { recursive: true, force: true }));
  const { config } = await loadConfig(await writeMinimalConfig(tmpdir));
  assert.equal(
    config.scan.viewport,
    undefined,
    'scan.viewport must be absent from DEFAULTS (F3 fix)',
  );
});

test('DEFAULTS do NOT ship scan.viewports (schema minItems:1 rejects empty-array sentinel)', async (t) => {
  // The schema enforces `minItems: 1` on `scan.viewports`. Shipping `[]` in
  // DEFAULTS would fail Ajv validation on every config that doesn't opt into
  // multi-viewport. So neither `viewport` nor `viewports` is in DEFAULTS;
  // `resolveViewports` falls through to DEFAULT_VIEWPORTS when both are absent.
  const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'config-defaults-'));
  t.after(() => fs.rm(tmpdir, { recursive: true, force: true }));
  const { config } = await loadConfig(await writeMinimalConfig(tmpdir));
  assert.equal(config.scan.viewports, undefined, 'viewports key must be absent');
});

test('DEFAULTS ship scan.waitUntil = domcontentloaded for SPA-friendliness', async (t) => {
  const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'config-defaults-'));
  t.after(() => fs.rm(tmpdir, { recursive: true, force: true }));
  const { config } = await loadConfig(await writeMinimalConfig(tmpdir));
  assert.equal(config.scan.waitUntil, 'domcontentloaded');
});

test('DEFAULTS ship the Layer 3a axe tag profile', async (t) => {
  const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'config-defaults-'));
  t.after(() => fs.rm(tmpdir, { recursive: true, force: true }));
  const { config } = await loadConfig(await writeMinimalConfig(tmpdir));
  assert.deepEqual(config.scan.axe.withTags, [
    'wcag2a',
    'wcag2aa',
    'wcag21a',
    'wcag21aa',
    'wcag22aa',
  ]);
});

test('DEFAULTS ship crawl.requestDelayMs = 0', async (t) => {
  const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'config-defaults-'));
  t.after(() => fs.rm(tmpdir, { recursive: true, force: true }));
  const { config } = await loadConfig(await writeMinimalConfig(tmpdir));
  assert.equal(config.crawl.requestDelayMs, 0);
});

test('DEFAULTS ship reporting.failOnFindings with impacts=critical,serious and threshold=1', async (t) => {
  const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'config-defaults-'));
  t.after(() => fs.rm(tmpdir, { recursive: true, force: true }));
  const { config } = await loadConfig(await writeMinimalConfig(tmpdir));
  assert.deepEqual(config.reporting.failOnFindings.impacts, ['critical', 'serious']);
  assert.deepEqual(config.reporting.failOnFindings.classifications, []);
  assert.equal(config.reporting.failOnFindings.threshold, 1);
});

// SECTION: F3 regression canary

test('resolveViewports on a viewport-less DEFAULTS-merged config returns DEFAULT_VIEWPORTS', async (t) => {
  // Before R6 this branch was unreachable — DEFAULTS shipped a legacy
  // `scan.viewport` singleton, so the legacy-wrap path always won.
  // This test would have failed on HEAD pre-R6 and must never regress.
  const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'config-defaults-'));
  t.after(() => fs.rm(tmpdir, { recursive: true, force: true }));
  const { config } = await loadConfig(await writeMinimalConfig(tmpdir));
  const result = resolveViewports(config);
  assert.equal(result, DEFAULT_VIEWPORTS, 'DEFAULT_VIEWPORTS must be reachable');
});

test('migrated configs/example-site.json supplies explicit viewports and passes resolution', async () => {
  // Self-document the migrated example: resolveViewports returns the
  // user-supplied array (not DEFAULT_VIEWPORTS) when a config opts in.
  const { config } = await loadConfig('configs/example-site.json');
  const result = resolveViewports(config);
  assert.equal(result.length, 2);
  assert.equal(result[0].id, 'desktop');
  assert.equal(result[1].id, 'reflow');
});
