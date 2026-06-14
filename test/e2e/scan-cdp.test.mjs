// @ts-check
/**
 * @file End-to-end test for the E8 CDP transport — riding a human-cleared session.
 * @module test/e2e/scan-cdp
 *
 * @description
 * Proves the keystone of E8 with NO external services. A cookie-gated fixture
 * route `/gated` returns real, auditable content (an alt-less `<img>` ⇒ a real
 * axe violation) ONLY when a `cf_clearance` cookie is present; otherwise it
 * returns a Cloudflare-style 403 + `cf-mitigated` interstitial.
 *
 * A real Chromium is launched with a CDP endpoint (`--remote-debugging-port`); a
 * "human" CDP connection seeds `cf_clearance` into its DEFAULT context. The
 * toolkit then attaches over CDP (via the `WCAG_EM_CDP_ENDPOINT` env override)
 * and audits `/gated`. Because the CDP transport REUSES the default context (not
 * a fresh incognito one), the scan rides the cookie and `/gated` is audited. A
 * CONTROL run with no CDP (plain launch, fresh context, no cookie) records the
 * same `/gated` as a challenge — same fixture, opposite outcomes, so the
 * difference is the session reuse. Finally the external browser is shown to have
 * survived (dispose disconnects, never kills it).
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startFixtureServer } from '../fixtures/server.mjs';
import { createTmpConfig } from '../fixtures/make-config.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(__filename, '../../..');
const BIN = path.join(REPO_ROOT, 'bin', 'wcag-em.mjs');
const STATIC_DIR = path.join(REPO_ROOT, 'test', 'fixtures', 'static-site');

/**
 * Find a free localhost TCP port (bind :0, read it back, release). There is a
 * small TOCTOU window between releasing the port here and Chromium rebinding it
 * for --remote-debugging-port; acceptable for a single loopback test.
 *
 * @returns {Promise<number>}
 */
function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

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

/**
 * @param {import('node:test').TestContext} t
 * @param {string} baseUrl
 * @param {string[]} structuredManual
 * @param {NodeJS.ProcessEnv} extraEnv
 * @returns {Promise<Record<string, any>>} The parsed summary.json.
 */
async function runAudit(t, baseUrl, structuredManual, extraEnv) {
  const cfg = await createTmpConfig({
    baseUrl,
    overrides: {
      sample: { structuredManual },
      scan: { retries: 0 },
      processes: [],
      reporting: { reporters: ['json'] },
    },
  });
  t.after(() => cfg.cleanup());
  const crawleeStorage = await mkdtemp(path.join(tmpdir(), 'wcag-em-e2e-storage-'));
  t.after(() => rm(crawleeStorage, { recursive: true, force: true }));

  const result = await runChild(
    process.execPath,
    [BIN, 'audit', '--config', cfg.configPath, '--out-dir', cfg.outDir, '--log-level=warn'],
    {
      env: { ...process.env, CRAWLEE_STORAGE_DIR: crawleeStorage, ...extraEnv },
      timeoutMs: 80_000,
    },
  );
  assert.notEqual(result.status, null, `audit did not crash/hang\nstderr:\n${result.stderr}`);
  return JSON.parse(await readFile(path.join(cfg.outDir, 'reports', 'summary.json'), 'utf8'));
}

// SECTION: Test

test(
  'scan (cdp): reusing a human-cleared session audits a cookie-gated page that plain launch cannot',
  { timeout: 120_000 },
  async (t) => {
    const fixture = await startFixtureServer({
      staticDir: STATIC_DIR,
      routes: {
        // Cleared only when the cf_clearance cookie is present; otherwise a
        // Cloudflare-style managed challenge (403 + cf-mitigated).
        '/gated': (req, res) => {
          const cookie = req.headers.cookie ?? '';
          const cleared = cookie
            .split(';')
            .some((/** @type {string} */ c) => c.trim() === 'cf_clearance=fixture-cleared');
          if (!cleared) {
            res.statusCode = 403;
            res.setHeader('cf-mitigated', 'challenge');
            res.setHeader('cf-ray', 'fixturecfray01');
            res.setHeader('content-type', 'text/html; charset=utf-8');
            res.end(
              '<!DOCTYPE html><html lang="en"><head><title>Just a moment...</title></head>' +
                '<body><h1>Checking your browser before accessing</h1></body></html>',
            );
            return;
          }
          res.setHeader('content-type', 'text/html; charset=utf-8');
          res.end(
            '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Members area</title>' +
              '</head><body><main><h1>Members area</h1><img src="logo.png"></main></body></html>',
          );
        },
      },
    });
    t.after(() => fixture.stop());

    // A real Chromium with a CDP endpoint. `connectOverCDP` needs a CDP endpoint
    // (`--remote-debugging-port`), NOT a Playwright launchServer wsEndpoint.
    const debugPort = await getFreePort();
    const owned = await chromium.launch({ args: [`--remote-debugging-port=${debugPort}`] });
    t.after(() => owned.close());
    const cdpUrl = `http://127.0.0.1:${debugPort}`;

    // A "human" CDP connection clears the challenge by seeding cf_clearance into
    // the browser's DEFAULT context.
    const human = await chromium.connectOverCDP(cdpUrl);
    t.after(() => human.close());
    const humanCtx = human.contexts()[0] ?? (await human.newContext());
    await humanCtx.addCookies([
      { name: 'cf_clearance', value: 'fixture-cleared', url: fixture.baseUrl },
    ]);

    // 1) CDP run: attaches to the cleared browser via WCAG_EM_CDP_ENDPOINT.
    const cdpSummary = await runAudit(
      t,
      fixture.baseUrl,
      [`${fixture.baseUrl}/index.html`, `${fixture.baseUrl}/gated`],
      { WCAG_EM_CDP_ENDPOINT: cdpUrl },
    );
    const gatedAudited = (cdpSummary.findings ?? []).some((/** @type {any} */ f) =>
      (f.pages ?? []).some((/** @type {string} */ u) => u.includes('/gated')),
    );
    assert.ok(
      gatedAudited,
      'CDP run AUDITED /gated (a finding references it) — only possible by reusing the cleared context',
    );
    assert.ok(
      !(cdpSummary.executionHealth?.pagesUnauditable ?? []).some((/** @type {any} */ p) =>
        p.url.includes('/gated'),
      ),
      '/gated must not be unauditable under CDP',
    );

    // 2) Control run: plain launch (fresh context, no cookie) → /gated challenged.
    const plainSummary = await runAudit(t, fixture.baseUrl, [`${fixture.baseUrl}/gated`], {});
    assert.ok(
      (plainSummary.executionHealth?.pagesUnauditable ?? []).some(
        (/** @type {any} */ p) =>
          p.url.includes('/gated') &&
          (p.views ?? []).some((/** @type {any} */ v) => v.outcome === 'challenge'),
      ),
      'plain-launch run records /gated as a CHALLENGE (not merely unauditable) — proves the CDP difference is session reuse',
    );

    // 3) The external browser survived the CDP run (dispose disconnects, never kills).
    const probe = await chromium.connectOverCDP(cdpUrl);
    assert.ok(probe, 'external browser still reachable after the CDP run');
    await probe.close();
  },
);
