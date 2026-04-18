// @ts-check
/**
 * @file Tests that the Commander binary parses args and prints --help.
 * @module test/unit/cli
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BIN = path.resolve(__dirname, '../../bin/wcag-em.mjs');

// SECTION: Tests

test('wcag-em --help exits 0 and lists every subcommand', () => {
  const res = spawnSync(process.execPath, [BIN, '--help'], { encoding: 'utf8' });
  assert.equal(res.status, 0);
  const out = res.stdout;
  for (const cmd of ['discover', 'sample', 'scan', 'scan-processes', 'summarize', 'audit']) {
    assert.ok(out.includes(cmd), `expected --help output to list '${cmd}'`);
  }
});

test('wcag-em --version prints a semver-looking string', () => {
  const res = spawnSync(process.execPath, [BIN, '--version'], { encoding: 'utf8' });
  assert.equal(res.status, 0);
  assert.match(res.stdout.trim(), /^\d+\.\d+\.\d+/);
});

test('unknown flag exits non-zero', () => {
  const res = spawnSync(process.execPath, [BIN, '--definitely-not-a-flag'], { encoding: 'utf8' });
  assert.notEqual(res.status, 0);
});
