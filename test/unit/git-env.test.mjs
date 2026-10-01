// @ts-check
/**
 * @file Tests for `gitDiscoveryEnv` (inherited git location variables never apply).
 * @module test/unit/git-env
 *
 * @description
 * git exports `GIT_DIR` and friends to hooks and `git rebase -x` commands, and
 * a child git process that inherits them operates on that repository instead
 * of discovering one from its cwd. These tests prove the helper strips them
 * and that a real child `git` then discovers from its working directory.
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { gitDiscoveryEnv } from '../../src/lib/git-env.mjs';

// SECTION: Tests

test('gitDiscoveryEnv removes every location variable and keeps everything else', () => {
  const env = gitDiscoveryEnv({
    PATH: '/bin',
    HOME: '/home/x',
    GIT_DIR: '/elsewhere/.git',
    GIT_WORK_TREE: '/elsewhere',
    GIT_INDEX_FILE: '/elsewhere/.git/index',
    GIT_COMMON_DIR: '/elsewhere/.git',
    GIT_OBJECT_DIRECTORY: '/o',
    GIT_ALTERNATE_OBJECT_DIRECTORIES: '/a',
    GIT_NAMESPACE: 'ns',
    GIT_PREFIX: 'sub/',
    GIT_AUTHOR_NAME: 'kept',
  });
  assert.deepEqual(env, { PATH: '/bin', HOME: '/home/x', GIT_AUTHOR_NAME: 'kept' });
});

test('gitDiscoveryEnv deletes keys rather than setting them to undefined', () => {
  const env = gitDiscoveryEnv({ GIT_DIR: '/x/.git' });
  assert.equal(Object.hasOwn(env, 'GIT_DIR'), false);
});

test('gitDiscoveryEnv does not mutate its input', () => {
  const base = { GIT_DIR: '/x/.git' };
  gitDiscoveryEnv(base);
  assert.deepEqual(base, { GIT_DIR: '/x/.git' });
});

test('a child git under an inherited GIT_DIR discovers its cwd once the env is cleaned', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wcag-em-gitenv-'));
  try {
    const decoy = path.join(root, 'decoy');
    const target = path.join(root, 'target');
    fs.mkdirSync(decoy);
    fs.mkdirSync(target);
    const hermetic = { GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: '1' };
    execFileSync('git', ['init', '-q'], { cwd: decoy, env: { ...gitDiscoveryEnv(), ...hermetic } });
    execFileSync('git', ['init', '-q'], {
      cwd: target,
      env: { ...gitDiscoveryEnv(), ...hermetic },
    });
    const inherited = { ...process.env, ...hermetic, GIT_DIR: path.join(decoy, '.git') };
    // `--show-toplevel` cannot tell the cases apart (with GIT_DIR set, git
    // treats the cwd as the top level either way); the git dir can.
    const gitDir = (/** @type {NodeJS.ProcessEnv} */ env) =>
      fs.realpathSync(
        execFileSync('git', ['rev-parse', '--absolute-git-dir'], {
          cwd: target,
          encoding: 'utf8',
          env,
        }).trim(),
      );
    assert.equal(gitDir(inherited), fs.realpathSync(path.join(decoy, '.git')), 'precondition');
    assert.equal(gitDir(gitDiscoveryEnv(inherited)), fs.realpathSync(path.join(target, '.git')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
