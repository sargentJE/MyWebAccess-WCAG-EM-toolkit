// @ts-check
/**
 * @file Tests for `TOOL_IDENTITY`, its build provenance, and `toolIdentityMarkdownHeader`.
 * @module test/unit/version
 *
 * @description
 * The module reads both package.json files at import time, so the tests
 * cross-check the exported values against disk. Build provenance (`gitSha`,
 * `dirty`) is cross-checked against git itself, including the case where the
 * package sits inside SOMEONE ELSE's repository (installed as a dependency):
 * that repo's HEAD must never be stamped as the toolkit's (TEST-06).
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  TOOL_IDENTITY,
  toolIdentityMarkdownHeader,
  readGitProvenance,
  formatVersionLabel,
} from '../../src/lib/version.mjs';
import { gitDiscoveryEnv } from '../../src/lib/git-env.mjs';

// SECTION: Setup

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(__filename, '../../..');
const SELF_PKG = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
const AXE_PKG = JSON.parse(
  fs.readFileSync(
    path.join(REPO_ROOT, 'node_modules', '@axe-core', 'playwright', 'package.json'),
    'utf8',
  ),
);

// SECTION: Tests

test('TOOL_IDENTITY always has the same five keys (shape never depends on install mode)', () => {
  assert.deepEqual(Object.keys(TOOL_IDENTITY).sort(), [
    'axeCore',
    'dirty',
    'gitSha',
    'name',
    'version',
  ]);
});

test('TOOL_IDENTITY.name matches package.json', () => {
  assert.equal(TOOL_IDENTITY.name, SELF_PKG.name);
});

test('TOOL_IDENTITY.version matches package.json (propagates on npm version bump)', () => {
  assert.equal(TOOL_IDENTITY.version, SELF_PKG.version);
});

test('TOOL_IDENTITY.axeCore matches @axe-core/playwright/package.json', () => {
  assert.equal(TOOL_IDENTITY.axeCore, AXE_PKG.version);
});

test('TOOL_IDENTITY is frozen — cannot be mutated by consumers', () => {
  assert.ok(Object.isFrozen(TOOL_IDENTITY));
  assert.throws(
    () => {
      /** @type {any} */ (TOOL_IDENTITY).name = 'hacked';
    },
    /./,
    'frozen object should reject assignment in strict mode',
  );
});

test('TOOL_IDENTITY values are non-empty strings', () => {
  assert.ok(TOOL_IDENTITY.name.length > 0);
  assert.ok(TOOL_IDENTITY.version.length > 0);
  assert.ok(TOOL_IDENTITY.axeCore.length > 0);
});

// SECTION: Build provenance (TEST-06)

// Hermetic git: no inherited repository location (git exports GIT_DIR to
// hooks and `rebase -x`, which would redirect `git init` at the real
// repository), and no user/system config (commit.gpgsign, global hooks,
// init templates) that could make the fixtures behave differently per machine.
const GIT_ENV = { ...gitDiscoveryEnv(), GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: '1' };

/**
 * @param {string} cwd
 * @param {...string} args
 * @returns {string}
 */
function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', env: GIT_ENV }).trim();
}

/**
 * @param {string} cwd
 * @param {string} message
 * @returns {void}
 */
function commit(cwd, message) {
  git(
    cwd,
    ...['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false'],
    ...['commit', '-q', '--no-verify', '--allow-empty', '-m', message],
  );
}

/**
 * Run `fn` with a fresh, initialised temp repository that is removed afterwards.
 *
 * @param {(dir: string) => void} fn
 * @returns {void}
 */
function withTempRepo(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wcag-em-prov-'));
  try {
    git(dir, 'init', '-q');
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('TOOL_IDENTITY.gitSha is the checkout HEAD when run from this repository', () => {
  assert.equal(TOOL_IDENTITY.gitSha, git(REPO_ROOT, 'rev-parse', 'HEAD'));
  assert.equal(typeof TOOL_IDENTITY.dirty, 'boolean');
});

test('readGitProvenance: a directory outside any repository yields nulls', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wcag-em-noprov-'));
  try {
    assert.deepEqual(readGitProvenance(dir), { gitSha: null, dirty: null });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('readGitProvenance: a package nested inside another repository yields nulls', () => {
  withTempRepo((outer) => {
    // A real commit, so HEAD resolves: the null result must come from the
    // top-level mismatch guard, not from an unborn HEAD.
    commit(outer, 'init');
    const nested = path.join(outer, 'node_modules', 'wcag-em-a11y-toolkit');
    fs.mkdirSync(nested, { recursive: true });
    assert.match(git(nested, 'rev-parse', 'HEAD'), /^[0-9a-f]{40}$/, 'precondition: HEAD resolves');
    assert.deepEqual(readGitProvenance(nested), { gitSha: null, dirty: null });
  });
});

test('readGitProvenance: an inherited GIT_DIR cannot make a nested package stamp the outer HEAD', () => {
  withTempRepo((outer) => {
    commit(outer, 'init');
    const nested = path.join(outer, 'node_modules', 'wcag-em-a11y-toolkit');
    fs.mkdirSync(nested, { recursive: true });
    const saved = process.env.GIT_DIR;
    process.env.GIT_DIR = path.join(outer, '.git');
    try {
      assert.deepEqual(readGitProvenance(nested), { gitSha: null, dirty: null });
    } finally {
      if (saved === undefined) delete process.env.GIT_DIR;
      else process.env.GIT_DIR = saved;
    }
  });
});

test('readGitProvenance: dirty tracks tracked changes only', () => {
  withTempRepo((dir) => {
    fs.writeFileSync(path.join(dir, 'tracked.txt'), 'v1\n');
    git(dir, 'add', 'tracked.txt');
    commit(dir, 'add tracked');
    const head = git(dir, 'rev-parse', 'HEAD');

    assert.deepEqual(readGitProvenance(dir), { gitSha: head, dirty: false }, 'clean');

    fs.writeFileSync(path.join(dir, 'run-output.json'), '{}');
    assert.deepEqual(readGitProvenance(dir), { gitSha: head, dirty: false }, 'untracked ignored');

    fs.writeFileSync(path.join(dir, 'tracked.txt'), 'v2\n');
    assert.deepEqual(readGitProvenance(dir), { gitSha: head, dirty: true }, 'unstaged change');

    git(dir, 'add', 'tracked.txt');
    assert.deepEqual(readGitProvenance(dir), { gitSha: head, dirty: true }, 'staged change');
  });
});

test('readGitProvenance never writes the index, even when files are stat-dirty', () => {
  withTempRepo((dir) => {
    const file = path.join(dir, 'tracked.txt');
    fs.writeFileSync(file, 'v1\n');
    git(dir, 'add', 'tracked.txt');
    commit(dir, 'add tracked');
    // Same content, newer mtime: stat-dirty, which makes `git diff`/`git status`
    // (without --no-optional-locks) rewrite the index to refresh stat data.
    const future = new Date(Date.now() + 60_000);
    fs.utimesSync(file, future, future);
    const index = path.join(dir, '.git', 'index');
    const before = fs.statSync(index).mtimeMs;

    readGitProvenance(dir);
    assert.equal(fs.statSync(index).mtimeMs, before, 'provenance read rewrote the index');

    // Precondition: the setup really was stat-dirty (a refreshing command rewrites it).
    git(dir, 'diff', '--quiet', 'HEAD');
    assert.notEqual(fs.statSync(index).mtimeMs, before, 'precondition: index was refreshable');
  });
});

test('formatVersionLabel: SemVer build metadata for checkouts, plain version otherwise', () => {
  const sha = '42bb6b9c0ffee0000000000000000000000000ab';
  assert.equal(formatVersionLabel({ version: '1.2.0', gitSha: null, dirty: null }), '1.2.0');
  assert.equal(
    formatVersionLabel({ version: '1.2.0', gitSha: sha, dirty: false }),
    '1.2.0+42bb6b9',
  );
  assert.equal(
    formatVersionLabel({ version: '1.2.0', gitSha: sha, dirty: true }),
    '1.2.0+42bb6b9.dirty',
  );
});

test('toolIdentityMarkdownHeader renders as expected', () => {
  const header = toolIdentityMarkdownHeader();
  assert.match(header, /^\*\*Tool:\*\* /);
  assert.match(header, new RegExp(`${escapeRegex(SELF_PKG.name)}`));
  assert.match(header, new RegExp(`${escapeRegex(formatVersionLabel(TOOL_IDENTITY))}`));
  assert.match(header, new RegExp(`axe-core ${escapeRegex(AXE_PKG.version)}`));
  assert.ok(header.endsWith('\n\n'), 'trailing blank line so prose starts below');
});

/**
 * @param {string} s
 * @returns {string}
 */
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
