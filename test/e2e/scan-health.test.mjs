// @ts-check
/**
 * @file End-to-end test for execution-health visibility.
 * @module test/e2e/scan-health
 *
 * @description
 * Promotes the 2026-06 review's hostile-fixture probes P1 (a page that times
 * out at scan is silently absorbed) and P2 (a failing pre-scan action leaves
 * no downstream trace) into regression tests. One audit run stages both: a
 * `/slow` URL injected via `sample.structuredManual` (sample keeps URLs that
 * are missing from the inventory — verified behaviour) with `retries: 0` and
 * a scan timeout below the fixture's `slowMs`, plus a `beforeScan` click on a
 * selector that never exists.
 *
 * Before the fix the failed page was counted in samplePagesScanned, appeared
 * in no report, and the pre-scan failure lived only in `_preScanStates`.
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
const STATIC_DIR = path.join(REPO_ROOT, 'test', 'fixtures', 'static-site');

// SECTION: Helpers

/**
 * Async spawn-to-completion (see reporters-smoke.test.mjs for why not
 * spawnSync: Playwright's subprocess tree deadlocks the sync pipe drain).
 *
 * @param {string} command
 * @param {string[]} args
 * @param {{ env?: NodeJS.ProcessEnv, timeoutMs?: number }} opts
 * @returns {Promise<{ status: number | null, stdout: string, stderr: string }>}
 */
function runChild(command, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      env: opts.env ?? process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    /** @type {NodeJS.Timeout | undefined} */
    let killer;
    if (typeof opts.timeoutMs === 'number') {
      killer = setTimeout(() => child.kill('SIGTERM'), opts.timeoutMs);
    }
    child.on('exit', (status) => {
      if (killer) clearTimeout(killer);
      resolve({ status, stdout, stderr });
    });
  });
}

// SECTION: Test

test(
  'scan health: failed page + failing pre-scan action surface end-to-end',
  { timeout: 90_000 },
  async (t) => {
    const fixture = await startFixtureServer({ staticDir: STATIC_DIR, slowMs: 8000 });
    t.after(() => fixture.stop());

    const cfg = await createTmpConfig({
      baseUrl: fixture.baseUrl,
      overrides: {
        sample: {
          structuredManual: [`${fixture.baseUrl}/index.html`, `${fixture.baseUrl}/slow`],
        },
        scan: {
          timeoutMs: 3000,
          retries: 0,
          beforeScan: { actions: [{ action: 'click', selector: '#never-exists-xyz' }] },
        },
        reporting: { reporters: ['json', 'markdown'] },
      },
    });
    t.after(() => cfg.cleanup());

    const crawleeStorage = await mkdtemp(path.join(tmpdir(), 'wcag-em-e2e-storage-'));
    t.after(() => rm(crawleeStorage, { recursive: true, force: true }));

    const result = await runChild(
      process.execPath,
      [BIN, 'audit', '--config', cfg.configPath, '--out-dir', cfg.outDir, '--log-level=warn'],
      { env: { ...process.env, CRAWLEE_STORAGE_DIR: crawleeStorage }, timeoutMs: 80_000 },
    );
    // Findings on the healthy fixture pages still trip failOnFindings.
    assert.equal(result.status, 2, `audit exit 2 expected\nstderr:\n${result.stderr}`);

    const reportsDir = path.join(cfg.outDir, 'reports');
    const summary = JSON.parse(await readFile(path.join(reportsDir, 'summary.json'), 'utf8'));
    const health = summary.executionHealth;

    // P1 — the timed-out page is a visible failure, not a phantom scan.
    assert.ok(health, 'summary carries executionHealth');
    assert.equal(health.pagesFailed.length, 1, 'one page failed every viewport');
    assert.ok(health.pagesFailed[0].url.endsWith('/slow'));
    assert.match(health.pagesFailed[0].failures[0].error, /Timeout|timeout/);
    assert.equal(
      summary.samplePagesScanned,
      health.pagesFullyScanned + health.pagesDegraded.length,
      'samplePagesScanned counts pages with >=1 successful view',
    );
    assert.ok(
      summary.pageViewsScanned >= summary.samplePagesScanned,
      'pageViewsScanned present alongside the pages figure',
    );
    assert.ok(
      summary.scanWarnings.some(
        (/** @type {string} */ w) => w.includes('failed to scan') && w.includes('/slow'),
      ),
      'failure rides the scanWarnings channel',
    );

    // P2 — the failing pre-scan click is consumed, not just recorded raw.
    assert.ok(health.preScanFailures.length >= 1, 'pre-scan failure surfaced');
    assert.equal(health.preScanFailures[0].action, 'click');

    // Human-facing rendering: the markdown report names the failure.
    const md = await readFile(path.join(reportsDir, 'summary.md'), 'utf8');
    assert.match(md, /## Scan health/);
    assert.ok(md.includes('/slow'), 'failed page named in the report');
    assert.match(md, /Pre-scan action "click"/);
  },
);
