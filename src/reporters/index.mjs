// @ts-check
/**
 * @file Reporter registry + dispatcher (internal).
 * @module reporters/index
 *
 * @description
 * Module-private `Map<string, ReporterModule>` populated at import time.
 * The Map itself is NOT exported — only `runReporters(names, summary, ctx)`
 * is — so third-party callers cannot register custom reporters at runtime.
 * This satisfies ADR-0012's "extensibility is internal for v1.0" stance.
 *
 * `package.json` separately drops the `./reporters/*` export entry as part
 * so the deep-import path is unavailable too. Layered defence:
 * narrow exports + private registry.
 *
 * `runReporters` is fail-resilient: each reporter runs in its own try/catch
 * so a single reporter's failure never blocks the others. Errors are
 * collected and returned alongside successful results; the caller
 * (`summarize.mjs`) composes them into the process exit code (1 on any
 * reporter error, ≥2 wins from `computeExitCode`'s threshold check).
 *
 * @see docs/adr/0008-pluggable-reporters.md
 * @see docs/adr/0012-extensibility-is-internal.md
 */

// SECTION: Imports
import * as jsonReporter from './json.mjs';
import * as markdownReporter from './markdown.mjs';
import * as htmlReporter from './html.mjs';
import * as earlJsonldReporter from './earl-jsonld.mjs';
import * as junitReporter from './junit.mjs';
import * as portalExportReporter from './portal-export.mjs';
import * as reportBuilderStarterReporter from './report-builder-starter.mjs';

// SECTION: Types

/**
 * @typedef {object} ReporterModule
 * @property {string} name - Module-scope name; must match the registry key.
 * @property {(summary: Record<string, any>, ctx: any) => Promise<{ path: string, bytes: number }>} emit - Writes the reporter artefact and returns its path + size.
 */

/**
 * @typedef {object} ReporterResult
 * @property {string} name - Reporter that produced this output.
 * @property {string} path - Absolute path of the emitted file.
 * @property {number} bytes - File size in bytes (matches `fs.stat().size`).
 */

/**
 * @typedef {object} ReporterError
 * @property {string} name - Reporter whose `emit` threw.
 * @property {Error} error - The thrown error (or string-coerced fallback wrapped in Error).
 */

/**
 * @typedef {object} RunReportersOutcome
 * @property {ReporterResult[]} results - Successful per-reporter outputs in input order.
 * @property {ReporterError[]} errors - Per-reporter failures collected during the run.
 */

// SECTION: Private registry

/**
 * Module-private. NOT exported. Each reporter lands a new entry as it
 * Registered reporters: json, markdown, html, earl-jsonld, junit,
 * portal-export, report-builder-starter.
 *
 * @type {Map<string, ReporterModule>}
 */
const registry = new Map([
  [jsonReporter.name, /** @type {ReporterModule} */ (jsonReporter)],
  [markdownReporter.name, /** @type {ReporterModule} */ (markdownReporter)],
  [htmlReporter.name, /** @type {ReporterModule} */ (htmlReporter)],
  [earlJsonldReporter.name, /** @type {ReporterModule} */ (earlJsonldReporter)],
  [junitReporter.name, /** @type {ReporterModule} */ (junitReporter)],
  [portalExportReporter.name, /** @type {ReporterModule} */ (portalExportReporter)],
  [reportBuilderStarterReporter.name, /** @type {ReporterModule} */ (reportBuilderStarterReporter)],
]);

// SECTION: Public API

/**
 * Run a list of reporters against a summary. Fail-resilient — collects
 * per-reporter errors instead of throwing.
 *
 * Unknown reporter names are a CONFIG error (not a reporter error) and
 * throw immediately, before any reporter runs — they signal a typo or a
 * future-version config and the user should fix before any output is
 * written.
 *
 * @param {ReadonlyArray<string>} names
 * @param {Record<string, any>} summary
 * @param {any} ctx
 * @returns {Promise<RunReportersOutcome>}
 */
export async function runReporters(names, summary, ctx) {
  if (!Array.isArray(names)) {
    throw new TypeError('runReporters: `names` must be an array of reporter names');
  }
  // Fail fast on unknown names BEFORE running any reporter — partial outputs
  // from a config typo are worse than no output.
  for (const n of names) {
    if (!registry.has(n)) {
      const known = [...registry.keys()].sort().join(', ');
      throw new Error(`unknown reporter '${n}'; known reporters at this layer: [${known}]`);
    }
  }
  /** @type {ReporterResult[]} */
  const results = [];
  /** @type {ReporterError[]} */
  const errors = [];
  for (const n of names) {
    const reporter = /** @type {ReporterModule} */ (registry.get(n));
    try {
      const out = await reporter.emit(summary, ctx);
      results.push({ name: n, path: out.path, bytes: out.bytes });
    } catch (err) {
      errors.push({
        name: n,
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }
  return { results, errors };
}

/**
 * Read-only view of the registered reporter names. Exported only so tests
 * (and ADR-0008's invariants) can assert which reporters this build
 * advertises. NOT a public extension point.
 *
 * @returns {string[]}
 */
export function listReporters() {
  return [...registry.keys()].sort();
}
