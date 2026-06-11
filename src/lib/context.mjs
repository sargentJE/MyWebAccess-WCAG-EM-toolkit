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
 * Used for `config.crawl.excludeUrlPatternsCompiled` (compiled at load),
 * `config.scan.axe.overridesCompiled` (the compile-at-load step), action-level regex fields
 * at three sites (the action-regex compile step), and `ctx.preflightRan` (set after preflight
 * succeeds). The single source of truth for the descriptor shape these
 * fields rely on.
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
 * Compile `$defs/action.urlPattern` at every consumer site in the config.
 *
 * The schema reuses `$defs/action` (with `validRegex: true` on `urlPattern`)
 * at three sites: `scan.beforeScan.actions[]`, `scan.axe.overrides[].actions[]`,
 * and `processes[].steps[]`. For each action object that has a truthy
 * `urlPattern`, attach a non-enumerable `regex` property so the scan runtime
 * dispatcher can `.test(url)` without re-compiling per URL.
 *
 * F9 invariants (locked by `test/unit/context-compile-actions.test.mjs`):
 *   - Actions without `urlPattern` are left untouched (no `regex` attached).
 *   - Overrides without an `actions` key get no phantom `actions: []`.
 *   - The `regex` property is non-enumerable — JSON.stringify output is
 *     byte-equivalent to the pre-compile form.
 *
 * Called once at config-load by `buildContext`. Pure transformation over
 * the loaded config object (mutates in place for the non-enumerable attach).
 *
 * @param {Record<string, any>} config
 * @returns {void}
 */
export function compileActionUrlPatterns(config) {
  // 1. scan.beforeScan.actions[]
  const beforeScanActions = config.scan?.beforeScan?.actions;
  if (Array.isArray(beforeScanActions)) {
    for (const action of beforeScanActions) compileActionRegex(action);
  }

  // 2. scan.axe.overrides[].actions[]
  const overrides = config.scan?.axe?.overrides;
  if (Array.isArray(overrides)) {
    for (const override of overrides) {
      if (Array.isArray(override?.actions)) {
        for (const action of override.actions) compileActionRegex(action);
      }
    }
  }

  // 3. processes[].steps[]
  const processes = config.processes;
  if (Array.isArray(processes)) {
    for (const processDef of processes) {
      if (Array.isArray(processDef?.steps)) {
        for (const step of processDef.steps) compileActionRegex(step);
      }
    }
  }
}

/**
 * Attach a `regex` to a single action object IFF it has a truthy `urlPattern`.
 * No-op otherwise — the F9 invariant that actions without a pattern are
 * unmodified is locked here.
 *
 * @param {Record<string, any>} action
 * @returns {void}
 */
function compileActionRegex(action) {
  if (!action || typeof action !== 'object') return;
  if (typeof action.urlPattern !== 'string' || action.urlPattern.length === 0) return;
  defineHidden(action, 'regex', new RegExp(action.urlPattern));
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
  // Ajv's `validRegex` keyword has already confirmed compilability for every
  // entry, so `new RegExp(p)` cannot throw here. Attached non-enumerable +
  // non-writable so the compiled array never leaks into JSON-serialised
  // artefacts.
  // LINK: docs/adr/0005-fail-fast-on-config.md
  const excludePatterns = loaded.config.crawl.excludeUrlPatterns ?? [];
  defineHidden(
    loaded.config.crawl,
    'excludeUrlPatternsCompiled',
    excludePatterns.map((/** @type {string} */ p) => new RegExp(p)),
  );

  // ANCHOR: CompileDocumentLinkPatterns — pathname-anchored regexes used by
  // discover.mjs's transformRequestFunction (and sitemap-seed loop) to drop
  // non-HTML document URLs before Crawlee tries to render them. Same Ajv
  // `validRegex` discipline as `excludeUrlPatterns`; same `defineHidden`
  // shape so the compiled array never leaks into JSON-serialised artefacts.
  // LINK: docs/adr/0005-fail-fast-on-config.md
  const documentLinkPatterns = loaded.config.crawl.documentLinkPatterns ?? [];
  defineHidden(
    loaded.config.crawl,
    'documentLinkPatternsCompiled',
    documentLinkPatterns.map((/** @type {string} */ p) => new RegExp(p)),
  );

  // ANCHOR: CompileOverrides — per-URL axe override patterns.
  // Each compiled entry preserves the original override's own keys (via
  // spread) so `applyAxeOverride`'s replace-if-defined predicate — which
  // uses `hasOwnProperty.call(override, key)` — still distinguishes
  // `runOnly: null` (defined-as-null = clear) from absent (inherit base).
  // The `regex` property is added on top for the hot-path `findMatchingOverride`.
  if (loaded.config.scan?.axe) {
    const overrides = loaded.config.scan.axe.overrides ?? [];
    defineHidden(
      loaded.config.scan.axe,
      'overridesCompiled',
      overrides.map((/** @type {any} */ o) => ({
        ...o,
        regex: new RegExp(o.urlPattern),
      })),
    );
  }

  // ANCHOR: CompileActionUrlPatterns — compile `$defs/action.urlPattern` at
  // three consumer sites (scan.beforeScan.actions, scan.axe.overrides.actions,
  // processes.steps). Ajv's `validRegex` keyword has already confirmed
  // compilability for every entry. The `regex` property is attached via
  // `defineHidden` (non-enumerable) so it doesn't leak into JSON-serialised
  // artefacts and the F9 invariant holds: actions without a `urlPattern` get
  // no new properties; overrides without an `actions` key are untouched.
  compileActionUrlPatterns(loaded.config);

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
    // NOTE: under outDir since the 2026-06 review (finding C2). The previous
    // `path.resolve('sample.json')` resolved against the process CWD and
    // ignored --out-dir, so two runs from one shell shared (and clobbered)
    // the same handoff file regardless of their out-dirs.
    sampleJsonPath: path.join(outDir, 'sample.json'),
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
