// @ts-check
/**
 * @file Descriptor-contract test for `scan.axe.overridesCompiled`.
 * @module test/unit/context-overrides-compiled
 *
 * @description
 * Mirror of `context-compile-regex.test.mjs` but for the per-URL axe override
 * compile-at-load introduced in Layer 3a (R2). Locks three invariants:
 *   1. Non-enumerable descriptor — the compiled array never leaks into any
 *      JSON-serialised artefact.
 *   2. Each entry has a real `RegExp` on `.regex`.
 *   3. Each entry preserves the original override's own-keys so R3's
 *      `applyAxeOverride` predicate (`hasOwnProperty.call(override, key)`)
 *      correctly distinguishes `runOnly: null` from absent.
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
 * Write a fixture config with two per-URL overrides that exercise the
 * hasOwnProperty-preserving invariant (one has `runOnly: null`, one omits it).
 *
 * @param {string} tmpdir
 * @returns {Promise<string>}
 */
async function writeFixtureConfig(tmpdir) {
  const configPath = path.join(tmpdir, 'config.json');
  await fs.writeFile(
    configPath,
    JSON.stringify({
      name: 'overrides-fixture',
      rootUrl: 'https://example.com',
      scope: { mode: 'same-hostname' },
      crawl: { excludeUrlPatterns: [] },
      sample: { structuredManual: [], randomSeed: 1 },
      scan: {
        axe: {
          overrides: [
            {
              urlPattern: '^https://example\\.com/admin',
              withRules: ['color-contrast'],
              runOnly: null,
            },
            {
              urlPattern: '^https://example\\.com/checkout',
              withTags: ['wcag22aa'],
            },
          ],
        },
      },
    }),
  );
  return configPath;
}

// SECTION: Tests

test('buildContext attaches overridesCompiled as non-enumerable', async (t) => {
  const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'overrides-compiled-'));
  t.after(() => fs.rm(tmpdir, { recursive: true, force: true }));

  const configPath = await writeFixtureConfig(tmpdir);
  const ctx = await buildContext({ configPath, outDir: tmpdir, skipPreflight: true });

  const descriptor = Object.getOwnPropertyDescriptor(
    ctx.config.scan.axe,
    'overridesCompiled',
  );
  assert.ok(descriptor, 'descriptor must exist');
  assert.strictEqual(descriptor.enumerable, false);
  assert.strictEqual(descriptor.configurable, true);
  assert.strictEqual(descriptor.writable, false);
  assert.ok(
    !JSON.stringify(ctx.config.scan.axe).includes('overridesCompiled'),
    'compiled array must not leak into JSON',
  );
});

test('overridesCompiled length matches overrides length and each has a RegExp', async (t) => {
  const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'overrides-compiled-'));
  t.after(() => fs.rm(tmpdir, { recursive: true, force: true }));

  const configPath = await writeFixtureConfig(tmpdir);
  const ctx = await buildContext({ configPath, outDir: tmpdir, skipPreflight: true });

  /** @type {any[]} */
  const compiled = ctx.config.scan.axe.overridesCompiled;
  assert.equal(compiled.length, 2);
  assert.ok(compiled[0].regex instanceof RegExp);
  assert.ok(compiled[1].regex instanceof RegExp);
  assert.ok(compiled[0].regex.test('https://example.com/admin/users'));
  assert.ok(compiled[1].regex.test('https://example.com/checkout'));
  assert.ok(!compiled[0].regex.test('https://example.com/'));
});

test('overridesCompiled preserves hasOwnProperty semantics for runOnly', async (t) => {
  // F11 contract: `runOnly: null` (defined-as-null = clear) must be
  // distinguishable from absent. R3's `applyAxeOverride` relies on
  // `hasOwnProperty.call(override, 'runOnly')` returning true for the first
  // override and false for the second.
  const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'overrides-compiled-'));
  t.after(() => fs.rm(tmpdir, { recursive: true, force: true }));

  const configPath = await writeFixtureConfig(tmpdir);
  const ctx = await buildContext({ configPath, outDir: tmpdir, skipPreflight: true });

  /** @type {any[]} */
  const compiled = ctx.config.scan.axe.overridesCompiled;
  assert.ok(
    Object.prototype.hasOwnProperty.call(compiled[0], 'runOnly'),
    'first override defined runOnly:null — hasOwnProperty must be true',
  );
  assert.equal(compiled[0].runOnly, null, 'and its value is null');
  assert.ok(
    !Object.prototype.hasOwnProperty.call(compiled[1], 'runOnly'),
    'second override omitted runOnly — hasOwnProperty must be false',
  );
});

test('overridesCompiled is [] when config has no overrides', async (t) => {
  const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'overrides-compiled-'));
  t.after(() => fs.rm(tmpdir, { recursive: true, force: true }));

  const configPath = path.join(tmpdir, 'config.json');
  await fs.writeFile(
    configPath,
    JSON.stringify({
      name: 'no-overrides',
      rootUrl: 'https://example.com',
      scope: { mode: 'same-hostname' },
      crawl: { excludeUrlPatterns: [] },
      sample: { structuredManual: [], randomSeed: 1 },
      scan: {},
    }),
  );
  const ctx = await buildContext({ configPath, outDir: tmpdir, skipPreflight: true });
  assert.deepEqual(ctx.config.scan.axe.overridesCompiled, []);
});
