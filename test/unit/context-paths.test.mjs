// @ts-check
/**
 * @file Unit test for `buildContext` path resolution.
 * @module test/unit/context-paths
 *
 * @description
 * Locks the sample.json handoff location under the run's out-dir. Before the
 * 2026-06 review fix it resolved against the process CWD, ignoring --out-dir,
 * so sequential runs from one shell cross-contaminated each other's sample
 * (demonstrated live during the review when fixture probes clobbered the
 * repo-root sample.json of an unrelated audit).
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildContext } from '../../src/lib/context.mjs';

// SECTION: Tests

test('paths.sampleJsonPath lives under outDir, not the process CWD', async (t) => {
  const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'context-paths-'));
  t.after(() => fs.rm(tmpdir, { recursive: true, force: true }));

  const configPath = path.join(tmpdir, 'config.json');
  await fs.writeFile(
    configPath,
    JSON.stringify({
      name: 'paths-fixture',
      rootUrl: 'https://example.com',
      scope: { mode: 'same-hostname' },
      sample: { structuredManual: [], randomSeed: 1 },
      scan: {},
    }),
  );

  const outDir = path.join(tmpdir, 'out');
  const ctx = await buildContext({ configPath, outDir, skipPreflight: true });

  assert.strictEqual(ctx.paths.sampleJsonPath, path.join(outDir, 'sample.json'));
  assert.ok(
    !ctx.paths.sampleJsonPath.startsWith(
      path.resolve('sample.json').slice(0, -'sample.json'.length),
    ) || ctx.paths.sampleJsonPath.startsWith(outDir),
    'sample.json must not resolve against the CWD',
  );

  // Two contexts with different out-dirs must never share a handoff file —
  // the cross-contamination invariant.
  const otherOut = path.join(tmpdir, 'other-out');
  const other = await buildContext({ configPath, outDir: otherOut, skipPreflight: true });
  assert.notStrictEqual(other.paths.sampleJsonPath, ctx.paths.sampleJsonPath);
});
