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
 * Attach a hidden, read-only, configurable property — the descriptor shape
 * ADR-0005 relies on for runtime-only fields that must not leak into
 * JSON-serialised artefacts. `configurable: true` permits future watch-mode
 * (`delete` + redefine) per ADR-0005's Consequences note; `writable: false`
 * prevents accidental mutation.
 *
 * Used for `config.crawl.excludeUrlPatternsCompiled` (compiled at load) and
 * `ctx.preflightRan` (set after preflight succeeds). The single source of
 * truth for the descriptor shape these fields rely on.
 *
 * @param {object} obj - Target object the property is attached to.
 * @param {string} key - Property name.
 * @param {any} value - Property value.
 * @returns {void}
 */
export function defineHidden(obj, key, value) {
  Object.defineProperty(obj, key, {
    value,
    enumerable: false,
    configurable: true,
    writable: false,
  });
}

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
 * @property {boolean} [preflightRan] - True once preflight has succeeded.
 *   Set non-enumerably by `buildContext` and `ensurePreflight` so it never
 *   leaks into JSON-serialised artefacts. Defined on the ctx object, not
 *   the config.
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
  defineHidden(
    loaded.config.crawl,
    'excludeUrlPatternsCompiled',
    excludePatterns.map((/** @type {string} */ p) => new RegExp(p)),
  );

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

  /** @type {RunContext} */
  const ctx = {
    config: loaded.config,
    configPath,
    logger,
    paths,
    args: loaded.args,
  };

  // ANCHOR: PreflightFlag — true iff we ran preflight above. Non-enumerable
  //   so it doesn't leak into JSON-serialised artefacts.
  if (!options.skipPreflight) {
    defineHidden(ctx, 'preflightRan', true);
  }

  return ctx;
}

/**
 * Run preflight if `buildContext` was skipped — defence-in-depth for
 * programmatic API callers who construct `RunContext` by hand. Idempotent:
 * `ctx.preflightRan` guards against double-running.
 *
 * Co-located with `context.mjs` rather than promoted to its own module —
 * one small helper doesn't justify a file.
 *
 * @param {RunContext} ctx
 * @returns {Promise<void>}
 */
export async function ensurePreflight(ctx) {
  if (ctx.preflightRan) return;
  const pf = await runPreflight({
    configPath: ctx.configPath,
    outDir: ctx.paths.outDir,
  });
  if (!pf.ok) {
    const err = new Error(`Preflight failed:\n  - ${pf.failures.join('\n  - ')}`);
    err.name = 'PreflightError';
    throw err;
  }
  defineHidden(ctx, 'preflightRan', true);
}
