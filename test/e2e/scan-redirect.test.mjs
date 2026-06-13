// @ts-check
/**
 * @file End-to-end test for E4 redirect dedupe at the scan write-site.
 * @module test/e2e/scan-redirect
 *
 * @description
 * Proves the part of E4 unit tests cannot reach: scan.mjs captures the
 * post-redirect `finalUrl` from `page.url()` and the per-viewport seen-set folds
 * a redirect source + target into one audited page. Both `/old` (301 → /index)
 * and `/index.html` are sampled; findings must attribute to the final URL, and
 * `/old` must never appear as its own page. The grouping carve-out itself is
 * covered by the faster `group-findings.test.mjs`.
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
    child.stdout.on('data', (c) => {
      stdout += c.toString('utf8');
    });
    child.stderr.on('data', (c) => {
      stderr += c.toString('utf8');
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
  'scan: a redirect source folds into its final URL (no double-count)',
  { timeout: 90_000 },
  async (t) => {
    const fixture = await startFixtureServer({
      staticDir: STATIC_DIR,
      routes: {
        // 301 to the canonical page (relative Location → browser resolves it).
        '/old': (req, res) => {
          res.statusCode = 301;
          res.setHeader('location', '/index.html');
          res.end();
        },
      },
    });
    t.after(() => fixture.stop());

    const cfg = await createTmpConfig({
      baseUrl: fixture.baseUrl,
      overrides: {
        sample: {
          structuredManual: [`${fixture.baseUrl}/old`, `${fixture.baseUrl}/index.html`],
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

    const summary = JSON.parse(
      await readFile(path.join(cfg.outDir, 'reports', 'summary.json'), 'utf8'),
    );

    // No finding (or incomplete) attributes to the redirect SOURCE — it folded
    // into /index.html (the final URL).
    for (const f of [...(summary.findings ?? []), ...(summary.incompleteFindings ?? [])]) {
      assert.ok(
        !(f.pages ?? []).some((/** @type {string} */ u) => u.endsWith('/old')),
        `finding ${f.id} must attribute to the final URL, not /old`,
      );
    }
    // The redirect is folded, not bucketed as a failure or unauditable page.
    const health = summary.executionHealth;
    assert.ok(
      !health.pagesFailed.some((/** @type {any} */ p) => p.url.endsWith('/old')),
      '/old is not a failed page',
    );
    assert.ok(
      !(health.pagesUnauditable ?? []).some((/** @type {any} */ p) => p.url.endsWith('/old')),
      '/old is not an unauditable page — it was audited via /index.html',
    );
  },
);
