// @ts-check
/**
 * @file End-to-end test for E1 challenge handling at the scan write-site.
 * @module test/e2e/scan-challenge
 *
 * @description
 * Proves the part of E1 that unit tests cannot reach: that scan.mjs captures the
 * goto Response, classifies the landed page, and writes `pageOutcome` into
 * axe-results.json — so a Cloudflare-style challenge page (HTTP 403 +
 * `cf-mitigated` header) is recorded as unauditable, never as findings, and the
 * coverage gap is surfaced. The cross-reporter skip itself is covered by the
 * faster unit test `page-outcome-contract.test.mjs`.
 *
 * The challenge URL is injected via `sample.structuredManual` (scan keeps
 * sample URLs missing from the inventory), so scan reaches it directly.
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

/**
 * Async spawn-to-completion (Playwright's subprocess tree deadlocks spawnSync).
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
  'scan: a Cloudflare challenge page is recorded as pageOutcome, never as findings',
  { timeout: 90_000 },
  async (t) => {
    const fixture = await startFixtureServer({
      staticDir: STATIC_DIR,
      routes: {
        // A Cloudflare-style managed challenge: HTTP 403 + the authoritative
        // cf-mitigated header + an interstitial title/body. goto RESOLVES on a
        // 403 (no throw), exercising the §5.7 "must not burn a retry" path.
        '/challenge': (req, res) => {
          res.statusCode = 403;
          res.setHeader('cf-mitigated', 'challenge');
          res.setHeader('cf-ray', 'fixturecfray00');
          res.setHeader('content-type', 'text/html; charset=utf-8');
          res.end(
            '<!DOCTYPE html><html lang="en"><head><title>Just a moment...</title></head>' +
              '<body><h1>Checking your browser before accessing</h1></body></html>',
          );
        },
      },
    });
    t.after(() => fixture.stop());

    const cfg = await createTmpConfig({
      baseUrl: fixture.baseUrl,
      overrides: {
        sample: {
          structuredManual: [`${fixture.baseUrl}/index.html`, `${fixture.baseUrl}/challenge`],
        },
        scan: { retries: 0 },
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
    assert.notEqual(result.status, null, `audit did not crash\nstderr:\n${result.stderr}`);

    const reportsDir = path.join(cfg.outDir, 'reports');
    const summary = JSON.parse(await readFile(path.join(reportsDir, 'summary.json'), 'utf8'));
    const health = summary.executionHealth;

    // The challenge page is unauditable — counted distinctly, never a failure.
    assert.ok(health.challengePages >= 1, 'challenge page counted in challengePages');
    assert.ok(
      health.pagesUnauditable.some((/** @type {any} */ p) => p.url.endsWith('/challenge')),
      'challenge URL appears in pagesUnauditable',
    );
    assert.ok(
      !health.pagesFailed.some((/** @type {any} */ p) => p.url.endsWith('/challenge')),
      'challenge must NOT be bucketed as a failed page (it did not burn a retry)',
    );

    // No grouped finding references the challenge page (the write-site produced
    // pageOutcome + empty violations; grouping skipped it).
    for (const f of summary.findings ?? []) {
      assert.ok(
        !(f.pages ?? []).some((/** @type {string} */ u) => u.includes('/challenge')),
        `finding ${f.id} must not reference the challenge page`,
      );
    }

    // The coverage gap is disclosed, not hidden.
    assert.ok(
      summary.scanWarnings.some(
        (/** @type {string} */ w) => w.includes('could not audit') && w.includes('/challenge'),
      ),
      'challenge rides the scanWarnings channel',
    );
    const md = await readFile(path.join(reportsDir, 'summary.md'), 'utf8');
    assert.match(md, /## Scan health/);
  },
);
