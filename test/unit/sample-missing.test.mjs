// @ts-check
/**
 * @file Regression test for the structuredMissingFromInventory warn path.
 * @module test/unit/sample-missing
 *
 * @description
 * Layer 1 added a `ctx.logger.warn(...)` call in `src/commands/sample.mjs`
 * when the user's `config.sample.structuredManual` names a URL that doesn't
 * appear in the discovered inventory. This test locks the warn in place so
 * future refactors can't silently re-drop it.
 *
 * `sample.run(ctx)` doesn't launch Playwright, so the whole flow runs in a
 * tmpdir with hand-rolled inventory/cluster JSON fixtures and a recording
 * fake logger.
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { run as sampleRun } from '../../src/commands/sample.mjs';
import { defineHidden } from '../../src/lib/context.mjs';

// SECTION: Helpers

/**
 * Build a minimal but complete RunContext rooted at a fresh tmpdir.
 *
 * @returns {Promise<{
 *   tmpdir: string,
 *   ctx: any,
 *   warnCalls: Array<{ payload: any, message: string }>,
 * }>}
 */
async function buildFakeCtx() {
  const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'sample-missing-'));
  const inventoryDir = path.join(tmpdir, 'inventory');
  const resultsDir = path.join(tmpdir, 'results');
  const reportsDir = path.join(tmpdir, 'reports');
  const screenshotsDir = path.join(tmpdir, 'screenshots');
  await fs.mkdir(inventoryDir, { recursive: true });
  await fs.mkdir(resultsDir, { recursive: true });
  await fs.mkdir(reportsDir, { recursive: true });
  await fs.mkdir(screenshotsDir, { recursive: true });

  // Two URLs in the discovered inventory — home and about.
  await fs.writeFile(
    path.join(inventoryDir, 'inventory.json'),
    JSON.stringify([
      { url: 'https://example.com/', pageType: 'homepage' },
      { url: 'https://example.com/about', pageType: 'content' },
    ]),
  );
  await fs.writeFile(
    path.join(inventoryDir, 'page-clusters.json'),
    JSON.stringify([
      {
        clusterKey: 'homepage::(root)',
        pageType: 'homepage',
        representativeUrl: 'https://example.com/',
        memberCount: 1,
      },
    ]),
  );

  /** @type {Array<{ payload: any, message: string }>} */
  const warnCalls = [];
  const fakeLogger = {
    info: () => {},
    warn: (/** @type {any} */ payload, /** @type {string} */ message) => {
      warnCalls.push({ payload, message });
    },
    error: () => {},
    debug: () => {},
    trace: () => {},
    fatal: () => {},
  };

  const ctx = {
    config: {
      name: 'fixture',
      rootUrl: 'https://example.com',
      sample: {
        // This URL is deliberately absent from inventory above — it must warn.
        structuredManual: ['https://example.com/ghost'],
        autoSuggest: { enabled: false, perCluster: 1, preferTypes: [] },
        randomPercentOfStructured: 0.1,
        minRandomPages: 0,
        randomSeed: 1,
        smallSiteSupplementaryScanThreshold: 50,
      },
      processes: [],
    },
    configPath: path.join(tmpdir, 'config.json'),
    logger: fakeLogger,
    paths: {
      outDir: tmpdir,
      inventoryDir,
      resultsDir,
      reportsDir,
      screenshotsDir,
      sampleJsonPath: path.join(tmpdir, 'sample.json'),
    },
    args: {},
  };

  // Mark preflight as already done — this test targets the warn path inside
  // sample.run, not the preflight gate wired in commit 11b.
  defineHidden(ctx, 'preflightRan', true);

  return { tmpdir, ctx, warnCalls };
}

// SECTION: Tests

test('sample.run warns when structured URLs are missing from inventory', async (t) => {
  const { tmpdir, ctx, warnCalls } = await buildFakeCtx();
  t.after(() => fs.rm(tmpdir, { recursive: true, force: true }));

  await sampleRun(ctx);

  assert.ok(warnCalls.length >= 1, 'expected at least one warn call');
  const missingWarn = warnCalls.find(
    (call) => call.message === 'structured sample contains URLs not found in inventory',
  );
  assert.ok(missingWarn, 'expected the structuredMissing warn');
  assert.deepStrictEqual(missingWarn.payload, {
    missing: ['https://example.com/ghost'],
  });
});
