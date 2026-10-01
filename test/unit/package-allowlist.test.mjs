// @ts-check
/**
 * @file Guards the published package contents (SEC-08, OPS-13).
 * @module test/unit/package-allowlist
 *
 * @description
 * `package.json` `files` is an allowlist that OVERRIDES `.gitignore`, so a
 * bare `"configs/"` entry shipped every local, gitignored per-engagement
 * config (which can hold auth secrets) in `npm pack` / `npm publish`. The
 * root fix has two halves: `files` names only committed configs, and
 * `scripts/check-pack.mjs` fails when any packed file is not committed at
 * HEAD or carries uncommitted changes. This test locks the pure logic of the
 * guard and the package.json wiring without invoking npm; CI runs the guard
 * itself against planted canary configs.
 *
 * @see docs/reviews/2026-09-toolkit-gap-review.md (SEC-08, OPS-13)
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findUnshippable, parsePackOutput } from '../../scripts/check-pack.mjs';
import { gitDiscoveryEnv } from '../../src/lib/git-env.mjs';

// SECTION: Setup

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const PKG = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

const PACK_JSON = JSON.stringify([{ files: [{ path: 'package.json' }, { path: 'src/a.mjs' }] }]);

// SECTION: parsePackOutput

test('parsePackOutput: plain npm --json output', () => {
  assert.deepEqual(parsePackOutput(PACK_JSON), ['package.json', 'src/a.mjs']);
});

test('parsePackOutput: tolerates lifecycle output printed before the JSON', () => {
  // husky prints its skip notice with no trailing newline (verified, npm 10.9.2).
  assert.deepEqual(parsePackOutput(`HUSKY=0 skip install${PACK_JSON}`), [
    'package.json',
    'src/a.mjs',
  ]);
});

test('parsePackOutput: output without a pack-result document is an error', () => {
  assert.throws(() => parsePackOutput('npm ERR! something broke'), /no JSON document/);
});

// SECTION: findUnshippable

test('findUnshippable: committed, unmodified files ship cleanly', () => {
  const r = findUnshippable({
    packed: ['package.json', 'configs/example-site.json'],
    committed: ['package.json', 'configs/example-site.json', 'README.md'],
    modified: ['README.md'],
  });
  assert.deepEqual(r, { uncommitted: [], modified: [] });
});

test('findUnshippable: a local, uncommitted client config is reported', () => {
  const r = findUnshippable({
    packed: ['package.json', 'configs/client-prod.json'],
    committed: ['package.json'],
    modified: [],
  });
  assert.deepEqual(r.uncommitted, ['configs/client-prod.json']);
});

test('findUnshippable: a committed config edited locally (e.g. a real client URL) is reported', () => {
  const r = findUnshippable({
    packed: ['configs/legacy-events.json'],
    committed: ['configs/legacy-events.json'],
    modified: ['configs/legacy-events.json'],
  });
  assert.deepEqual(r, { uncommitted: [], modified: ['configs/legacy-events.json'] });
});

test('findUnshippable: sorted, de-duplicated, separator-normalised', () => {
  const r = findUnshippable({
    packed: ['z.json', 'a.json', 'a.json', 'configs\\example-site.json'],
    committed: ['configs/example-site.json'],
    modified: [],
  });
  assert.deepEqual(r.uncommitted, ['a.json', 'z.json']);
});

// SECTION: package.json wiring

test('package.json files lists committed configs one by one, never a directory or broad glob', () => {
  const configEntries = PKG.files.filter((/** @type {string} */ f) => f.startsWith('configs'));
  assert.ok(configEntries.length > 0, 'expected explicit config allowlist entries');
  const committed = execFileSync('git', ['ls-tree', '-r', '--name-only', 'HEAD', 'configs/'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: gitDiscoveryEnv(),
  })
    .trim()
    .split('\n');
  for (const entry of configEntries) {
    assert.match(
      entry,
      /^configs\/(example-\*|[A-Za-z0-9._-]+)\.json$/,
      `not a single-file or example-* allowlist entry: ${entry}`,
    );
    if (!entry.includes('*')) assert.ok(committed.includes(entry), `not committed: ${entry}`);
  }
});

test('package.json runs the pack guard before publish and exposes it to CI', () => {
  assert.equal(PKG.scripts.prepublishOnly, 'node scripts/check-pack.mjs');
  assert.equal(PKG.scripts['check:pack'], 'node scripts/check-pack.mjs');
});
