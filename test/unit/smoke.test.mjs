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
 * This is the first test committed to the repo (Layer 0b). Per ADR-0001, every
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
