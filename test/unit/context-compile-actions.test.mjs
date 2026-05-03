// @ts-check
/**
 * @file Descriptor-contract tests for `compileActionUrlPatterns` — Layer 3b R7.
 * @module test/unit/context-compile-actions
 *
 * @description
 * Mirrors `context-compile-regex.test.mjs` (Layer 2) and
 * `context-overrides-compiled.test.mjs` (Layer 3a) for the three action-level
 * consumer sites: `scan.beforeScan.actions[]`,
 * `scan.axe.overrides[].actions[]`, and `processes[].steps[]`.
 *
 * Five invariants:
 *   1. `regex` attached non-enumerably at every consumer site.
 *   2. `regex` is a real RegExp that matches the pattern.
 *   3. hasOwnProperty-preserved on action objects (Layer 3a parity).
 *   4. `JSON.stringify(config)` does NOT leak `regex`.
 *   5. F9: actions without `urlPattern` are untouched; overrides without
 *      `actions` key get no phantom `actions: []`.
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { buildContext } from '../../src/lib/context.mjs';

// SECTION: Helpers

/**
 * Write a fixture config exercising all three action-compile sites.
 *
 * @param {string} tmpdir
 * @returns {Promise<string>}
 */
async function writeFixtureConfig(tmpdir) {
  const configPath = path.join(tmpdir, 'config.json');
  await fs.writeFile(
    configPath,
    JSON.stringify({
      name: 'action-compile-fixture',
      rootUrl: 'https://example.com',
      scope: { mode: 'same-hostname' },
      crawl: { excludeUrlPatterns: [] },
      sample: { structuredManual: [], randomSeed: 1 },
      scan: {
        beforeScan: {
          actions: [
            { action: 'click', selector: '#cookie-accept', urlPattern: '^https://example\\.com/' },
            { action: 'waitFor', timeoutMs: 500 }, // no urlPattern — must be untouched
          ],
        },
        axe: {
          overrides: [
            {
              urlPattern: '^https://example\\.com/admin',
              actions: [
                {
                  action: 'fill',
                  selector: '#search',
                  value: 'x',
                  urlPattern: '^https://example\\.com/admin/search',
                },
              ],
            },
            {
              urlPattern: '^https://example\\.com/public',
              // no actions key — F9 invariant target
            },
          ],
        },
      },
      processes: [
        {
          name: 'signup',
          startUrl: 'https://example.com/signup',
          steps: [
            {
              action: 'goto',
              url: 'https://example.com/signup',
              urlPattern: '^https://example\\.com/signup',
            },
            { action: 'click', selector: '#submit' }, // no urlPattern — untouched
          ],
        },
      ],
    }),
  );
  return configPath;
}

// SECTION: Tests

test('compileActionUrlPatterns: beforeScan action with urlPattern gets non-enumerable regex', async (t) => {
  const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'compile-actions-'));
  t.after(() => fs.rm(tmpdir, { recursive: true, force: true }));

  const configPath = await writeFixtureConfig(tmpdir);
  const ctx = await buildContext({ configPath, outDir: tmpdir, skipPreflight: true });
  const action = ctx.config.scan.beforeScan.actions[0];

  const desc = Object.getOwnPropertyDescriptor(action, 'regex');
  assert.ok(desc, 'regex descriptor must exist');
  assert.strictEqual(desc.enumerable, false);
  assert.strictEqual(desc.configurable, true);
  assert.strictEqual(desc.writable, false);
  assert.ok(action.regex instanceof RegExp);
  assert.ok(action.regex.test('https://example.com/admin'));
});

test('compileActionUrlPatterns: overrides[].actions[] get regex at nested site', async (t) => {
  const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'compile-actions-'));
  t.after(() => fs.rm(tmpdir, { recursive: true, force: true }));

  const configPath = await writeFixtureConfig(tmpdir);
  const ctx = await buildContext({ configPath, outDir: tmpdir, skipPreflight: true });
  const action = ctx.config.scan.axe.overrides[0].actions[0];

  assert.ok(action.regex instanceof RegExp);
  assert.ok(action.regex.test('https://example.com/admin/search?q=x'));
});

test('compileActionUrlPatterns: processes[].steps[] get regex', async (t) => {
  const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'compile-actions-'));
  t.after(() => fs.rm(tmpdir, { recursive: true, force: true }));

  const configPath = await writeFixtureConfig(tmpdir);
  const ctx = await buildContext({ configPath, outDir: tmpdir, skipPreflight: true });
  const step = ctx.config.processes[0].steps[0];

  assert.ok(step.regex instanceof RegExp);
  assert.ok(step.regex.test('https://example.com/signup'));
});

test('F9 invariant: actions WITHOUT urlPattern get NO regex attached', async (t) => {
  const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'compile-actions-'));
  t.after(() => fs.rm(tmpdir, { recursive: true, force: true }));

  const configPath = await writeFixtureConfig(tmpdir);
  const ctx = await buildContext({ configPath, outDir: tmpdir, skipPreflight: true });

  // beforeScan[1] — the waitFor action with no urlPattern.
  const action = ctx.config.scan.beforeScan.actions[1];
  assert.equal(
    Object.getOwnPropertyDescriptor(action, 'regex'),
    undefined,
    'no regex descriptor on actions without urlPattern',
  );

  // processes[0].steps[1] — the click action with no urlPattern.
  const step = ctx.config.processes[0].steps[1];
  assert.equal(
    Object.getOwnPropertyDescriptor(step, 'regex'),
    undefined,
    'no regex descriptor on steps without urlPattern',
  );
});

test('F9 invariant: overrides WITHOUT actions key get no phantom actions array', async (t) => {
  const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'compile-actions-'));
  t.after(() => fs.rm(tmpdir, { recursive: true, force: true }));

  const configPath = await writeFixtureConfig(tmpdir);
  const ctx = await buildContext({ configPath, outDir: tmpdir, skipPreflight: true });

  // overrides[1] — the public override with no actions key.
  const override = ctx.config.scan.axe.overrides[1];
  assert.equal(
    Object.prototype.hasOwnProperty.call(override, 'actions'),
    false,
    'no phantom actions key attached',
  );
});

test('JSON.stringify(config) does not leak any regex property', async (t) => {
  const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'compile-actions-'));
  t.after(() => fs.rm(tmpdir, { recursive: true, force: true }));

  const configPath = await writeFixtureConfig(tmpdir);
  const ctx = await buildContext({ configPath, outDir: tmpdir, skipPreflight: true });

  const serialized = JSON.stringify(ctx.config);
  // Not a simple `includes('regex')` check — the word might appear elsewhere.
  // Instead: round-trip-parse and search for any key named `regex` recursively.
  /**
   * @param {any} obj
   * @returns {boolean}
   */
  function hasRegexKey(obj) {
    if (obj === null || typeof obj !== 'object') return false;
    if (Array.isArray(obj)) return obj.some(hasRegexKey);
    if (Object.prototype.hasOwnProperty.call(obj, 'regex')) return true;
    return Object.values(obj).some(hasRegexKey);
  }
  assert.equal(hasRegexKey(JSON.parse(serialized)), false, 'no regex key in serialized config');
});
