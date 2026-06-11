// @ts-check
/**
 * @file Smoke test — every src/lib module loads without throwing.
 * @module test/unit/smoke
 *
 * @description
 * The cheapest possible test: import every public `src/lib/*` module and assert
 * the import itself doesn't throw. Catches typos, broken relative imports, and
 * top-level side effects that should not exist in library modules.
 *
 * This is the first test committed to the repo (initial implementation). Per ADR-0001, every
 * commit from here on must leave `npm test` green.
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';

// SECTION: Tests

// ANCHOR: LibModulesLoad — all seven lib modules must import cleanly
const libModules = [
  '../../src/lib/args.mjs',
  '../../src/lib/axe-utils.mjs',
  '../../src/lib/config.mjs',
  '../../src/lib/fs-utils.mjs',
  '../../src/lib/sample-utils.mjs',
  '../../src/lib/sitemap.mjs',
  '../../src/lib/urls.mjs',
];

for (const path of libModules) {
  test(`imports: ${path} loads without throwing`, async () => {
    const mod = await import(path);
    assert.ok(mod, `${path} returned no module`);
    assert.ok(Object.keys(mod).length > 0, `${path} exports nothing`);
  });
}

// ANCHOR: NormalizeUrlSanity — one tiny behavioural assertion proves imports are live
test('urls.normalizeUrl strips hash and trims trailing slash', async () => {
  const { normalizeUrl } = await import('../../src/lib/urls.mjs');
  assert.equal(normalizeUrl('https://example.com/path/#frag'), 'https://example.com/path');
  assert.equal(normalizeUrl('https://example.com/'), 'https://example.com/');
});

// ANCHOR: PreflightRanFlag — the guard ensurePreflight checks
test('buildContext with skipPreflight leaves ctx.preflightRan undefined', async () => {
  const { buildContext } = await import('../../src/lib/context.mjs');
  const ctx = await buildContext({ skipPreflight: true });
  assert.strictEqual(ctx.preflightRan, undefined);
});

test('ensurePreflight sets ctx.preflightRan with the correct descriptor shape', async () => {
  const { buildContext, ensurePreflight } = await import('../../src/lib/context.mjs');
  const ctx = await buildContext({ skipPreflight: true });
  // requirePlaywright defaults to false — preflight only checks config
  // readability + output dir writability, both satisfied by buildContext.
  await ensurePreflight(ctx);
  assert.strictEqual(ctx.preflightRan, true, 'flag set after ensurePreflight');

  // Descriptor contract (from defineHidden helper in context.mjs).
  const descriptor = Object.getOwnPropertyDescriptor(ctx, 'preflightRan');
  assert.ok(descriptor, 'descriptor must exist after ensurePreflight set the flag');
  assert.strictEqual(descriptor.enumerable, false, 'enumerable must be false');
  assert.strictEqual(descriptor.configurable, true, 'configurable must be true');
  assert.strictEqual(descriptor.writable, false, 'writable must be false');
});

// ANCHOR: PreflightIntentPreserved — the CI-red regression of 2026-06:
// ensurePreflight on a browserless runner must NOT demand Playwright unless
// the context was built with that intent; when it WAS, the check still runs.
test('ensurePreflight: no browser check by default; build-time intent preserved', async (t) => {
  const { buildContext, ensurePreflight } = await import('../../src/lib/context.mjs');
  const prev = process.env.PLAYWRIGHT_BROWSERS_PATH;
  process.env.PLAYWRIGHT_BROWSERS_PATH = '/nonexistent-browsers-dir-for-test';
  t.after(() => {
    if (prev === undefined) delete process.env.PLAYWRIGHT_BROWSERS_PATH;
    else process.env.PLAYWRIGHT_BROWSERS_PATH = prev;
  });

  // Default (no browser claim): config + out-dir checks only -> succeeds.
  const ctx = await buildContext({ skipPreflight: true });
  await ensurePreflight(ctx);
  assert.strictEqual(ctx.preflightRan, true);

  // Explicit browser intent at build time survives into ensurePreflight.
  const browserCtx = await buildContext({ skipPreflight: true, requirePlaywright: true });
  await assert.rejects(
    () => ensurePreflight(browserCtx),
    /Playwright browsers directory missing/,
    'recorded requirePlaywright intent must keep the browser check live',
  );
});
