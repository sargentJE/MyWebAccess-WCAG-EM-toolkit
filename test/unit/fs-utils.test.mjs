// @ts-check
/**
 * @file Unit tests for `src/lib/fs-utils.mjs`.
 * @module test/unit/fs-utils
 *
 * @description
 * Locks the corrupt-vs-missing distinction in `readJsonMaybe` (a corrupt
 * artefact must WARN before falling back; a missing one stays silent — the
 * 2026-06 review's probe P3 showed summarize over a corrupt axe-results.json
 * exiting 0 with a plausible "clean" report) and the atomic write contract
 * (no truncated artefacts, no stranded .tmp siblings).
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readJsonMaybe, writeJson, writeText } from '../../src/lib/fs-utils.mjs';

// SECTION: Helpers

/** @returns {Promise<string>} fresh tmp dir, cleaned by the caller's t.after */
async function tmpDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'fs-utils-test-'));
}

/** @returns {{ logger: { warn: (obj: object, msg: string) => void }, calls: any[] }} */
function captureLogger() {
  /** @type {any[]} */
  const calls = [];
  return {
    logger: {
      warn: (obj, msg) => {
        calls.push({ obj, msg });
      },
    },
    calls,
  };
}

// SECTION: readJsonMaybe — corrupt vs missing

test('readJsonMaybe: missing file returns fallback silently (no warn)', async (t) => {
  const dir = await tmpDir();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const { logger, calls } = captureLogger();
  const result = await readJsonMaybe(path.join(dir, 'absent.json'), 'fallback', logger);
  assert.strictEqual(result, 'fallback');
  assert.strictEqual(calls.length, 0, 'ENOENT is expected; must not warn');
});

test('readJsonMaybe: corrupt JSON returns fallback AND warns with file + error', async (t) => {
  const dir = await tmpDir();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const corrupt = path.join(dir, 'axe-results.json');
  await fs.writeFile(corrupt, '{ "broken": tru', 'utf8');
  const { logger, calls } = captureLogger();
  const result = await readJsonMaybe(corrupt, /** @type {unknown[]} */ ([]), logger);
  assert.deepStrictEqual(result, []);
  assert.strictEqual(calls.length, 1, 'corruption must be surfaced');
  assert.strictEqual(calls[0].obj.file, corrupt);
  assert.match(calls[0].msg, /unreadable.*fallback/);
});

test('readJsonMaybe: corrupt JSON without a logger still falls back (no throw)', async (t) => {
  const dir = await tmpDir();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const corrupt = path.join(dir, 'partial.json');
  await fs.writeFile(corrupt, '[1, 2,', 'utf8');
  const result = await readJsonMaybe(corrupt, 'safe');
  assert.strictEqual(result, 'safe');
});

test('readJsonMaybe: healthy file parses and never warns', async (t) => {
  const dir = await tmpDir();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'ok.json');
  await fs.writeFile(file, '{"a":1}\n', 'utf8');
  const { logger, calls } = captureLogger();
  const result = await readJsonMaybe(file, null, logger);
  assert.deepStrictEqual(result, { a: 1 });
  assert.strictEqual(calls.length, 0);
});

// SECTION: atomic writes

test('writeJson: writes pretty JSON with trailing newline and leaves no .tmp sibling', async (t) => {
  const dir = await tmpDir();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'out.json');
  await writeJson(file, { b: 2 });
  assert.strictEqual(await fs.readFile(file, 'utf8'), '{\n  "b": 2\n}\n');
  const leftovers = (await fs.readdir(dir)).filter((name) => name.includes('.tmp-'));
  assert.deepStrictEqual(leftovers, [], 'no temp residue after a successful write');
});

test('writeJson: overwrite replaces the previous content atomically', async (t) => {
  const dir = await tmpDir();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'out.json');
  await writeJson(file, { version: 1 });
  await writeJson(file, { version: 2 });
  assert.deepStrictEqual(JSON.parse(await fs.readFile(file, 'utf8')), { version: 2 });
});

test('writeText: a failed write (destination is a directory) strands no .tmp sibling', async (t) => {
  const dir = await tmpDir();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  // Renaming a file over an existing DIRECTORY fails on all platforms.
  const blocked = path.join(dir, 'taken');
  await fs.mkdir(blocked);
  await assert.rejects(() => writeText(blocked, 'payload'));
  const leftovers = (await fs.readdir(dir)).filter((name) => name.includes('.tmp-'));
  assert.deepStrictEqual(leftovers, [], 'failed rename must clean its temp file');
});
