// @ts-check
/**
 * @file End-to-end smoke for the reporter pipeline.
 * @module test/e2e/reporters-smoke
 *
 * @description
 * Boots the fixture server, materialises a tmp config + out-dir, runs a
 * full `audit` via async `child_process.spawn`, and asserts every reporter
 * output exists + parses + carries the expected content. The fixture pages
 * have seeded accessibility violations under the fixture template's WCAG
 * tag set (`wcag2a/wcag2aa/wcag21a/wcag21aa` per
 * `test/fixtures/site.json.template`): `image-alt` and `label` on
 * index.html, `color-contrast` on about.html (the duplicate `<main>`
 * triggers `landmark-unique` only under axe's `best-practice` tag, which
 * the fixture template doesn't enable — so it doesn't contribute to
 * findings here). These three WCAG-tagged rules carry impact `serious` or
 * `critical`, so failOnFindings.threshold:1 fires `computeExitCode`
 * (src/commands/summarize.mjs) and audit exits 2.
 *
 * NOTE: deliberately uses async `spawn` (not `spawnSync`). The toolkit's
 * audit subcommand launches Playwright which spawns Chromium + renderers,
 * and Crawlee's BrowserPool manages its own worker tree. spawnSync
 * deadlocks under this subprocess-tree pipe pressure on macOS (the
 * parent's blocking waitpid races with grand-child fd draining). Async
 * spawn lets Node's event loop drain pipes in real-time. Production users
 * running `wcag-em` from a shell don't hit this; only test harnesses that
 * invoke the CLI synchronously from a Node parent do.
 *
 * Was previously test.skip pending an investigation into a Crawlee
 * localhost-fixture hang; the hang was inadvertently fixed by D2 (commit
 * 468f5c1, 2026-05-03) and the resolution is recorded in
 * docs/adr/0013-crawlee-localhost-investigation.md.
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
 * Run a child process to completion, capturing stdout + stderr. Async
 * equivalent of spawnSync that avoids spawnSync's grand-child pipe-deadlock
 * (see file-level comment).
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
  'reporters smoke: full audit produces all 5 reporter outputs',
  { timeout: 60_000 },
  async (t) => {
    const fixture = await startFixtureServer({ staticDir: STATIC_DIR });
    t.after(() => fixture.stop());

    const cfg = await createTmpConfig({
      baseUrl: fixture.baseUrl,
      overrides: {
        // DEFAULTS.reporting.reporters is absent — summarize.mjs applies
        // `?? ['json','markdown']` inline. Smoke must explicitly opt-in to
        // all 5 reporters so the full pipeline is exercised.
        reporting: {
          reporters: ['json', 'markdown', 'html', 'earl-jsonld', 'junit'],
        },
      },
    });
    t.after(() => cfg.cleanup());

    // Isolated Crawlee storage dir per test so parallel test runs never
    // collide and stale state never leaks across tests.
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

    // Fixture has WCAG-tagged violations carrying serious + critical impact:
    //   index.html → image-alt (critical, wcag2a), label (critical, wcag2a)
    //   about.html → color-contrast (serious, wcag2aa)
    // With failOnFindings.threshold: 1 (template default) and impacts:
    //   ['critical','serious'], computeExitCode (src/commands/summarize.mjs)
    //   MUST return 2. Tight assertion.
    assert.equal(
      result.status,
      2,
      `audit should exit 2 (findings exceeded threshold)\nsignal: ${result.signal}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );

    // All 5 reporter outputs must exist + parse.
    const reportsDir = path.join(cfg.outDir, 'reports');

    const summary = JSON.parse(await readFile(path.join(reportsDir, 'summary.json'), 'utf8'));
    assert.ok(summary.tool, 'summary.json should have tool stamp');
    assert.ok(Array.isArray(summary.findings), 'summary.json findings should be array');
    assert.ok(
      summary.findings.length > 0,
      'summary.json findings should be non-empty (fixture has seeded violations)',
    );

    const md = await readFile(path.join(reportsDir, 'summary.md'), 'utf8');
    assert.match(md, /^# /m, 'summary.md should start with a markdown heading');

    const html = await readFile(path.join(reportsDir, 'summary.html'), 'utf8');
    assert.match(html, /<html\b/, 'summary.html should contain <html');

    const earl = JSON.parse(await readFile(path.join(reportsDir, 'earl.jsonld'), 'utf8'));
    assert.ok(earl['@context'], 'earl.jsonld should have @context');
    assert.ok(
      earl['@graph'] || earl.assertions || earl.subjects,
      'earl.jsonld should have an assertion graph',
    );

    const junit = await readFile(path.join(reportsDir, 'junit.xml'), 'utf8');
    assert.match(junit, /<\?xml\b/, 'junit.xml should be XML');
    assert.match(junit, /<testsuite\b/, 'junit.xml should have a <testsuite>');
  },
);
