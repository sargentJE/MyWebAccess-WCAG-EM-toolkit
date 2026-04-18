// @ts-check
/**
 * @file Preflight environment checks called at the top of every command.
 * @module lib/preflight
 *
 * @description
 * Fast sanity checks (~100ms) run before any real work. Catches the top three
 * ways a command fails in the wild and replaces opaque stack traces with
 * actionable messages:
 *
 *   1. Config file missing or unreadable.
 *   2. Playwright browsers not installed.
 *   3. Output directory not writable.
 *
 * Called from `buildContext()` in `lib/context.mjs`; exit code 1 + clear
 * message on any failure.
 *
 * @see docs/adr/0005-fail-fast-on-config.md
 */

// SECTION: Imports
import fs from 'node:fs/promises';
import path from 'node:path';
import { constants as fsConstants } from 'node:fs';

// SECTION: Public API

/**
 * @typedef {object} PreflightOptions
 * @property {string} configPath - Absolute path expected to resolve to a readable JSON file.
 * @property {string} outDir - Absolute directory that must exist and be writable (created if missing).
 * @property {boolean} [requirePlaywright] - Skip the browser-binary check for commands that don't launch Chromium (e.g. `summarize`).
 */

/**
 * @typedef {object} PreflightResult
 * @property {boolean} ok - True when all checks passed.
 * @property {string[]} failures - Human-readable failure reasons (empty on success).
 */

/**
 * Run preflight checks; never throws.
 *
 * @param {PreflightOptions} opts
 * @returns {Promise<PreflightResult>}
 */
export async function runPreflight(opts) {
  /** @type {string[]} */
  const failures = [];

  // ANCHOR: Check1 — config file readable
  try {
    await fs.access(opts.configPath, fsConstants.R_OK);
  } catch {
    failures.push(`Config not found or unreadable: ${opts.configPath}`);
  }

  // ANCHOR: Check2 — output directory writable (create if missing)
  try {
    await fs.mkdir(opts.outDir, { recursive: true });
    // write-probe — create + delete a tiny file to verify permissions
    const probe = path.join(opts.outDir, `.preflight-${process.pid}`);
    await fs.writeFile(probe, 'ok', 'utf8');
    await fs.unlink(probe);
  } catch (err) {
    failures.push(
      `Output directory not writable: ${opts.outDir} (${err instanceof Error ? err.message : String(err)})`,
    );
  }

  // ANCHOR: Check3 — Playwright browser binaries installed
  if (opts.requirePlaywright !== false) {
    // NOTE: we avoid actually launching Chromium here (too slow); instead
    // check that the playwright browsers directory exists and contains at
    // least one chromium build. The path is controlled by
    // PLAYWRIGHT_BROWSERS_PATH or defaults to ~/.cache/ms-playwright on unix.
    const browsersRoot =
      process.env.PLAYWRIGHT_BROWSERS_PATH ||
      path.join(
        process.env.HOME ?? process.env.USERPROFILE ?? '',
        process.platform === 'darwin' ? 'Library/Caches/ms-playwright' : '.cache/ms-playwright',
      );
    try {
      const entries = await fs.readdir(browsersRoot);
      const hasChromium = entries.some((e) => e.startsWith('chromium'));
      if (!hasChromium) {
        failures.push(
          `Playwright chromium not found at ${browsersRoot}; run: npx playwright install chromium`,
        );
      }
    } catch {
      failures.push(
        `Playwright browsers directory missing (${browsersRoot}); run: npx playwright install`,
      );
    }
  }

  return { ok: failures.length === 0, failures };
}
