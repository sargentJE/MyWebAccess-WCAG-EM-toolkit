// @ts-check
/**
 * @file RunContext builder — the object threaded through every command.
 * @module lib/context
 *
 * @description
 * Every command receives a `RunContext` (via `run(ctx)`) so it doesn't need to
 * reimplement config loading, path resolution, logger creation, or preflight.
 * One place to change if any of those evolve.
 *
 * The shape is:
 *   { config, configPath, logger, outDir, paths, args }
 * where `paths` pre-resolves every output subdirectory so commands call
 * `ensureDir(ctx.paths.inventoryDir)` without hardcoding strings.
 *
 * @see docs/adr/0001-project-conventions.md
 * @see docs/adr/0003-commander-cli.md
 */

// SECTION: Imports
import fs from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from './config.mjs';
import { assertValidConfig } from './validate-config.mjs';
import { createLogger } from './logger.mjs';
import { runPreflight } from './preflight.mjs';

// SECTION: Public API

/**
 * @typedef {object} RunContextPaths
 * @property {string} outDir - Root of all outputs (default `output/`).
 * @property {string} inventoryDir - Inventory artefacts (`output/inventory/`).
 * @property {string} resultsDir - Raw scan results (`output/results/`).
 * @property {string} reportsDir - Summaries / reporters (`output/reports/`).
 * @property {string} screenshotsDir - Page + state screenshots (`output/screenshots/`).
 * @property {string} sampleJsonPath - The sample.json handoff file.
 */

/**
 * @typedef {object} RunContext
 * @property {Record<string, any>} config - DEFAULTS-merged + Ajv-validated config.
 * @property {string} configPath - Absolute source path.
 * @property {import('pino').Logger} logger - Shared logger.
 * @property {RunContextPaths} paths - Pre-resolved output subdirectories.
 * @property {Record<string, string | boolean>} args - Raw CLI args (legacy surface).
 */

/**
 * @typedef {object} BuildContextOptions
 * @property {string} [configPath] - Override for `--config`.
 * @property {string} [outDir] - Override for `--out-dir`.
 * @property {import('./logger.mjs').LogLevel} [logLevel] - Override for `--log-level`.
 * @property {boolean} [skipPreflight] - Useful for unit tests; do not use from commands.
 * @property {boolean} [requirePlaywright] - Pass through to preflight.
 */

/**
 * Build a RunContext. Loads config via `loadConfig()`, validates it with Ajv,
 * creates the logger, resolves output paths, and runs preflight. Throws on
 * preflight failure so the Commander entry point can exit 1 with the message.
 *
 * @param {BuildContextOptions} [options]
 * @returns {Promise<RunContext>}
 */
export async function buildContext(options = {}) {
  // ANCHOR: StepA — argv loading (options.configPath wins over --config flag)
  const loaded = await loadConfig(options.configPath);
  const configPath = loaded.configPath;

  // ANCHOR: StepB — Ajv validation against schemas/config.schema.json.
  await assertValidConfig(loaded.config, configPath);

  // ANCHOR: CompileRuntimeFields — regex strings become RegExp[] once, at load.
  // Ajv's `validRegex` keyword (see `validate-config.mjs:54-81`) has already
  // confirmed compilability for every entry, so `new RegExp(p)` cannot throw
  // here. Attached non-enumerable + non-writable so the compiled array never
  // leaks into JSON-serialised artefacts.
  // LINK: docs/adr/0005-fail-fast-on-config.md
  const excludePatterns = loaded.config.crawl.excludeUrlPatterns ?? [];
  Object.defineProperty(loaded.config.crawl, 'excludeUrlPatternsCompiled', {
    value: excludePatterns.map((/** @type {string} */ p) => new RegExp(p)),
    enumerable: false,
    configurable: true,
    writable: false,
  });

  // ANCHOR: StepC — logger
  const logger = createLogger({ level: options.logLevel });

  // ANCHOR: StepD — output path resolution
  const outDir = path.resolve(options.outDir ?? 'output');
  const paths = {
    outDir,
    inventoryDir: path.join(outDir, 'inventory'),
    resultsDir: path.join(outDir, 'results'),
    reportsDir: path.join(outDir, 'reports'),
    screenshotsDir: path.join(outDir, 'screenshots'),
    sampleJsonPath: path.resolve('sample.json'),
  };

  // ANCHOR: StepE — preflight
  if (!options.skipPreflight) {
    const pf = await runPreflight({
      configPath,
      outDir,
      requirePlaywright: options.requirePlaywright,
    });
    if (!pf.ok) {
      const err = new Error(`Preflight failed:\n  - ${pf.failures.join('\n  - ')}`);
      err.name = 'PreflightError';
      throw err;
    }
  }

  // Ensure output directories exist up-front; commands don't have to.
  await fs.mkdir(paths.inventoryDir, { recursive: true });
  await fs.mkdir(paths.resultsDir, { recursive: true });
  await fs.mkdir(paths.reportsDir, { recursive: true });
  await fs.mkdir(paths.screenshotsDir, { recursive: true });

  return {
    config: loaded.config,
    configPath,
    logger,
    paths,
    args: loaded.args,
  };
}
