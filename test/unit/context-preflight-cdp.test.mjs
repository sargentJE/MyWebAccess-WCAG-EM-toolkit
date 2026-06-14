// @ts-check
/**
 * @file buildContext preflight skip composition for the E8 browser transport.
 * @module test/unit/context-preflight-cdp
 *
 * @description
 * Proves the config-aware `requirePlaywright` composition in `buildContext`:
 * the local-Chromium preflight check is suppressed ONLY when the command is
 * transport-aware (standalone scan / scan-processes) AND config/env selects an
 * external browser (CDP) or the patchright engine. `discover`/`audit`
 * (NOT transport-aware) always require the binary because discover launches a
 * local browser regardless of `scan.browser`.
 *
 * It points PLAYWRIGHT_BROWSERS_PATH at a nonexistent directory so the binary
 * check WOULD fail if applied — then asserts which combinations skip vs fail.
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildContext } from '../../src/lib/context.mjs';

// SECTION: Helpers

const BASE = {
  name: 'preflight-cdp-test',
  rootUrl: 'https://example.com/',
  scope: { mode: 'same-hostname' },
  crawl: { maxPages: 5 },
  sample: { structuredManual: ['https://example.com/'], randomSeed: 1 },
};

/**
 * Materialise a tmp config + out-dir and force PLAYWRIGHT_BROWSERS_PATH at a
 * nonexistent dir (so Check3 fails if applied). Restores env on teardown.
 *
 * @param {import('node:test').TestContext} t
 * @param {Record<string, any> | undefined} scanBrowser - `scan.browser` block, or undefined.
 * @returns {Promise<{ configPath: string, outDir: string }>}
 */
async function setup(t, scanBrowser) {
  const dir = await mkdtemp(path.join(tmpdir(), 'wcag-em-preflight-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const configPath = path.join(dir, 'config.json');
  const outDir = path.join(dir, 'out');
  const config = { ...BASE, scan: scanBrowser ? { browser: scanBrowser } : {} };
  await writeFile(configPath, JSON.stringify(config), 'utf8');

  const prev = process.env.PLAYWRIGHT_BROWSERS_PATH;
  process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(dir, 'no-such-browsers-dir');
  t.after(() => {
    if (prev === undefined) delete process.env.PLAYWRIGHT_BROWSERS_PATH;
    else process.env.PLAYWRIGHT_BROWSERS_PATH = prev;
  });
  return { configPath, outDir };
}

// SECTION: Tests

test('transport-aware + cdpEndpoint → preflight SKIPS the local-Chromium check', async (t) => {
  const { configPath, outDir } = await setup(t, { cdpEndpoint: 'http://127.0.0.1:9222' });
  // Must NOT throw even though the browsers dir is absent.
  const ctx = await buildContext({
    configPath,
    outDir,
    requirePlaywright: true,
    browserTransportAware: true,
  });
  assert.ok(ctx, 'buildContext succeeded (binary check skipped under CDP)');
});

test('transport-aware + patchright → preflight SKIPS the local-Chromium check', async (t) => {
  const { configPath, outDir } = await setup(t, { engine: 'patchright' });
  const ctx = await buildContext({
    configPath,
    outDir,
    requirePlaywright: true,
    browserTransportAware: true,
  });
  assert.ok(ctx, 'buildContext succeeded (patchright manages its own browser)');
});

test('transport-aware + launch (no scan.browser) → preflight FAILS (binary required)', async (t) => {
  const { configPath, outDir } = await setup(t, undefined);
  await assert.rejects(
    () =>
      buildContext({ configPath, outDir, requirePlaywright: true, browserTransportAware: true }),
    /Preflight failed|[Pp]laywright/,
    'launch transport must require the local Chromium binary',
  );
});

test('NOT transport-aware (discover/audit) + cdpEndpoint → preflight FAILS (discover always launches)', async (t) => {
  const { configPath, outDir } = await setup(t, { cdpEndpoint: 'http://127.0.0.1:9222' });
  await assert.rejects(
    () =>
      buildContext({ configPath, outDir, requirePlaywright: true, browserTransportAware: false }),
    /Preflight failed|[Pp]laywright/,
    'discover/audit need the local binary even when scan.browser selects CDP',
  );
});
