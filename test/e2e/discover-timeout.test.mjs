// @ts-check
/**
 * @file Behavioural test for discover's navigation timeout — validates crawl.navigationTimeoutSecs.
 * @module test/e2e/discover-timeout
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startFixtureServer } from '../fixtures/server.mjs';
import { createTmpConfig } from '../fixtures/make-config.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(__filename, '../../..');
const BIN = path.join(REPO_ROOT, 'bin', 'wcag-em.mjs');

// SECTION: Helpers

/**
 * Run a child process to completion, capturing stdout + stderr. Async
 * equivalent of spawnSync that avoids spawnSync's grand-child pipe-deadlock
 * (see reporters-smoke.test.mjs file-level comment).
 *
 * @param {string} command
 * @param {string[]} args
 * @param {{ env?: NodeJS.ProcessEnv, timeoutMs?: number }} opts
 * @returns {Promise<{ status: number | null, signal: NodeJS.Signals | null, stdout: string, stderr: string }>}
 */
function runChild(command, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      env: opts.env ?? process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (/** @type {Buffer} */ chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (/** @type {Buffer} */ chunk) => {
      stderr += chunk.toString('utf8');
    });
    /** @type {NodeJS.Timeout | undefined} */
    let killer;
    if (typeof opts.timeoutMs === 'number') {
      killer = setTimeout(() => child.kill('SIGTERM'), opts.timeoutMs);
    }
    child.on('exit', (status, signal) => {
      if (killer) clearTimeout(killer);
      resolve({ status, signal, stdout, stderr });
    });
  });
}

// SECTION: Tests

test(
  'discover: slow pages exceeding navigationTimeoutSecs are dropped from inventory',
  { timeout: 60_000 },
  async (t) => {
    const fixture = await startFixtureServer({
      slowMs: 8000,
      routes: {
        '/': (req, res) => {
          res.setHeader('content-type', 'text/html; charset=utf-8');
          res.end(
            '<!DOCTYPE html><html lang="en"><head><title>Nav Timeout Test</title></head>' +
              '<body><main><h1>Root</h1>' +
              '<a href="/fast">Fast page</a> ' +
              '<a href="/slow">Slow page</a>' +
              '</main></body></html>',
          );
        },
        '/fast': (req, res) => {
          res.setHeader('content-type', 'text/html; charset=utf-8');
          res.end(
            '<!DOCTYPE html><html lang="en"><head><title>Fast</title></head>' +
              '<body><main><h1>Fast page</h1></main></body></html>',
          );
        },
      },
    });
    t.after(() => fixture.stop());

    const cfg = await createTmpConfig({
      baseUrl: fixture.baseUrl,
      overrides: {
        crawl: {
          navigationTimeoutSecs: 5,
          sitemapSeeding: { enabled: false },
        },
        sample: {
          structuredManual: [`${fixture.baseUrl}/`],
        },
      },
    });
    t.after(() => cfg.cleanup());

    const crawleeStorage = await mkdtemp(path.join(tmpdir(), 'wcag-em-e2e-storage-'));
    t.after(() => rm(crawleeStorage, { recursive: true, force: true }));

    const result = await runChild(
      process.execPath,
      [BIN, 'audit', '--config', cfg.configPath, '--out-dir', cfg.outDir, '--log-level=warn'],
      {
        env: { ...process.env, CRAWLEE_STORAGE_DIR: crawleeStorage },
        timeoutMs: 50_000,
      },
    );

    assert.equal(
      result.status,
      0,
      `audit should exit 0 (clean fixture, no findings)\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );

    const inventoryPath = path.join(cfg.outDir, 'inventory', 'inventory.json');
    const inventory = JSON.parse(await readFile(inventoryPath, 'utf8'));
    const urls = inventory.map((/** @type {{ url: string }} */ entry) => entry.url);

    assert.ok(
      urls.some((/** @type {string} */ u) => u.startsWith(fixture.baseUrl)),
      'inventory should contain at least one page from the fixture',
    );
    assert.ok(
      !urls.some((/** @type {string} */ u) => u.includes('/slow')),
      `inventory must NOT contain /slow (navigation timed out)\ninventory URLs: ${urls.join(', ')}`,
    );
  },
);
