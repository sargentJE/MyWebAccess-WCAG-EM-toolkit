// @ts-check
/**
 * @file Descriptor-contract test for `excludeUrlPatternsCompiled`.
 * @module test/unit/context-compile-regex
 *
 * @description
 * Locks two invariants that ADR-0005's "fail fast on config" philosophy
 * depends on:
 *   1. The compiled array is NON-ENUMERABLE — it must never leak into any
 *      JSON-serialised artefact (reporter outputs, logs, summaries).
 *   2. The array really is `RegExp[]` — so the `urlExcludedByPatterns` hot
 *      path can call `rx.test(url)` without ever re-compiling.
 *
 * If either breaks, a legitimate-looking compile still corrupts downstream
 * consumers. The test is cheap and catches both in one shot.
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
 * Materialise a minimal valid config on disk and return its path.
 *
 * @param {string} tmpdir
 * @returns {Promise<string>}
 */
async function writeFixtureConfig(tmpdir) {
  const configPath = path.join(tmpdir, 'config.json');
  await fs.writeFile(
    configPath,
    JSON.stringify({
      name: 'compile-fixture',
      rootUrl: 'https://example.com',
      scope: { mode: 'same-hostname' },
      crawl: {
        excludeUrlPatterns: ['^/admin', '\\?debug=1'],
      },
      sample: { structuredManual: [], randomSeed: 1 },
      scan: {},
    }),
  );
  return configPath;
}

// SECTION: Tests

test('buildContext attaches excludeUrlPatternsCompiled as non-enumerable RegExp[]', async (t) => {
  const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'compile-regex-'));
  t.after(() => fs.rm(tmpdir, { recursive: true, force: true }));

  const configPath = await writeFixtureConfig(tmpdir);
  const ctx = await buildContext({
    configPath,
    outDir: tmpdir,
    skipPreflight: true,
  });

  // Invariant 1 — descriptor contract: directly assert what ADR-0005 promises.
  // The proxy check `!Object.keys().includes()` would pass if the property
  // were simply absent for unrelated reasons; getOwnPropertyDescriptor tests
  // the actual invariant that keeps the compiled array out of artefacts.
  const descriptor = Object.getOwnPropertyDescriptor(
    ctx.config.crawl,
    'excludeUrlPatternsCompiled',
  );
  assert.ok(descriptor, 'descriptor must exist — compile step must have run');
  assert.strictEqual(descriptor.enumerable, false, 'enumerable must be false');
  assert.strictEqual(descriptor.configurable, true, 'configurable must be true');
  assert.strictEqual(descriptor.writable, false, 'writable must be false');
  assert.ok(
    !JSON.stringify(ctx.config.crawl).includes('excludeUrlPatternsCompiled'),
    'JSON.stringify must not emit the compiled array',
  );

  // Invariant 2 — actual RegExp instances, matching the user's patterns.
  /** @type {RegExp[]} */
  const compiled = ctx.config.crawl.excludeUrlPatternsCompiled;
  assert.strictEqual(compiled.length, 2, 'two patterns produce two RegExps');
  assert.ok(compiled[0] instanceof RegExp, 'entries are RegExp instances');
  assert.ok(compiled[0].test('/admin/settings'), 'first pattern matches /admin');
  assert.ok(compiled[1].test('/page?debug=1'), 'second pattern matches ?debug=1');
});
