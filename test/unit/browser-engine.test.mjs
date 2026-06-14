// @ts-check
/**
 * @file Browser engine loader (E8).
 * @module test/unit/browser-engine
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadBrowserEngine } from '../../src/lib/browser-engine.mjs';

// SECTION: Tests

test('loadBrowserEngine: default + "playwright" expose a chromium with launch + connectOverCDP', async () => {
  for (const engine of [undefined, 'playwright']) {
    const { chromium } = await loadBrowserEngine(/** @type {any} */ (engine));
    assert.strictEqual(typeof chromium.launch, 'function');
    assert.strictEqual(typeof chromium.connectOverCDP, 'function');
  }
});

test('loadBrowserEngine: an unknown engine throws', async () => {
  await assert.rejects(
    () => loadBrowserEngine(/** @type {any} */ ('selenium')),
    /Unknown scan\.browser\.engine/,
  );
});

test('loadBrowserEngine: "patchright" when not installed throws an actionable install hint', async (t) => {
  // Only meaningful when patchright is genuinely absent (the default — it is an
  // opt-in, undeclared optional engine). If a developer has installed it, skip.
  let installed = false;
  try {
    // Variable specifier: don't let tsc resolve the optional module at build time.
    const pkg = 'patchright';
    await import(pkg);
    installed = true;
  } catch {
    /* absent — the path under test */
  }
  if (installed) {
    t.skip('patchright is installed in this environment; absent-path assertion skipped');
    return;
  }
  await assert.rejects(() => loadBrowserEngine('patchright'), /patchright[\s\S]*install/i);
});
