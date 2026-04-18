// @ts-check
/**
 * @file Configuration loader and DEFAULTS merge base.
 * @module lib/config
 *
 * @description
 * v0.3 `loadConfig()` — reads the config JSON from disk, deep-merges against
 * `DEFAULTS`, and runs an imperative validator. Layer 1 replaces the
 * imperative checks with Ajv + `better-ajv-errors` against the JSON schema,
 * while preserving `DEFAULTS` and `deepMerge()` (private helper retained per
 * the reuse-over-rewrite clause of ADR-0001).
 *
 * Layer 2 extends the loader to compile `crawl.excludeUrlPatterns` into
 * `RegExp[]` once at load, so bad patterns fail fast instead of at crawl time
 * (see `sitemap.mjs` / `urls.mjs` FIXMEs).
 *
 * @see docs/adr/0001-project-conventions.md
 * @see docs/adr/0002-config-is-ajv-validated.md
 * @see docs/adr/0005-fail-fast-on-config.md
 */

// SECTION: Imports
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from './args.mjs';

// SECTION: Constants

// ANCHOR: DEFAULTS — every key the toolkit understands, with a shippable default.
// Layer 3a adds `scan.viewports`, `crawl.requestDelayMs`, and default axe tag
// profile. Layer 3b adds `auth`, `wcagEm`. Layer 4 adds `reporting.reporters`.
const DEFAULTS = {
  scope: {
    mode: 'same-hostname',
    allowedHosts: [],
  },
  crawl: {
    maxPages: 80,
    maxConcurrency: 5,
    requestTimeoutSecs: 90,
    sitemapSeeding: {
      enabled: true,
      urls: [],
      commonPaths: ['/sitemap.xml', '/sitemap_index.xml'],
      maxUrls: 500,
    },
    excludeUrlPatterns: [],
  },
  discovery: {
    captureH1: true,
    captureCanonical: true,
    captureForms: true,
    captureLandmarks: true,
    captureSearchInputs: true,
  },
  sample: {
    structuredManual: [],
    autoSuggest: {
      enabled: true,
      perCluster: 1,
      preferTypes: ['homepage', 'form-or-contact', 'policy', 'listing', 'detail', 'content'],
    },
    randomPercentOfStructured: 0.1,
    minRandomPages: 2,
    randomSeed: 1,
    smallSiteSupplementaryScanThreshold: 50,
  },
  scan: {
    viewport: { width: 1440, height: 900 },
    waitUntil: 'load',
    timeoutMs: 60000,
    retries: 1,
    fullPageScreenshots: true,
    axe: {
      include: [],
      exclude: [],
      withRules: [],
      withTags: [],
      runOnly: null,
    },
  },
  reporting: {
    groupBestPracticeSeparately: true,
    markdownReport: true,
  },
  processes: [],
};

// SECTION: Public API

/**
 * @typedef {object} LoadConfigResult
 * @property {Record<string, any>} config - DEFAULTS-merged, validated config.
 * @property {string} configPath - Absolute path to the source JSON file.
 * @property {Record<string, string | boolean>} args - Parsed CLI arguments.
 */

/**
 * Load, default-merge, and validate a config file.
 *
 * Resolution priority: explicit `overridePath` argument → `--config` CLI
 * flag → `configs/example-site.json` fallback. `overridePath` is the hook
 * programmatic API callers use to point at an arbitrary config file without
 * having to mutate `process.argv`.
 *
 * @param {string} [overridePath] - Absolute or relative path; wins over argv.
 * @returns {Promise<LoadConfigResult>}
 */
export async function loadConfig(overridePath) {
  const args = parseArgs();
  const configPath =
    overridePath ??
    (typeof args.config === 'string' ? args.config : 'configs/example-site.json');
  const resolved = path.resolve(configPath);
  const raw = await fs.readFile(resolved, 'utf8');
  const config = deepMerge(DEFAULTS, JSON.parse(raw));
  validateConfig(config, resolved);
  return { config, configPath: resolved, args };
}

// SECTION: Internal helpers

/**
 * Recursively merge `override` on top of `base`. Arrays replace wholesale so
 * user-supplied arrays don't accidentally concat with DEFAULTS.
 *
 * @param {any} base
 * @param {any} override
 * @returns {any}
 */
function deepMerge(base, override) {
  if (Array.isArray(base) || Array.isArray(override)) return override ?? base;
  if (typeof base !== 'object' || typeof override !== 'object' || !base || !override) {
    return override ?? base;
  }
  /** @type {Record<string, any>} */
  const out = { ...base };
  for (const [key, value] of Object.entries(override)) {
    out[key] = key in base ? deepMerge(base[key], value) : value;
  }
  return out;
}

/**
 * Imperative validator — superseded by Ajv in Layer 1. Keeps behaviour
 * identical during Layer 0 so the tree stays green during the transition.
 *
 * @param {Record<string, any>} config
 * @param {string} configPath
 * @returns {void}
 */
function validateConfig(config, configPath) {
  const requiredTopLevel = ['name', 'rootUrl', 'scope', 'crawl', 'sample', 'scan'];
  for (const key of requiredTopLevel) {
    if (!(key in config)) throw new Error(`Missing required config key "${key}" in ${configPath}`);
  }
  if (typeof config.name !== 'string' || config.name.trim() === '') {
    throw new Error(`name must be a non-empty string in ${configPath}`);
  }
  if (typeof config.rootUrl !== 'string' || !/^https?:\/\//.test(config.rootUrl)) {
    throw new Error(`rootUrl must be a full URL in ${configPath}`);
  }
  const supportedScopeModes = new Set(['same-hostname', 'same-origin', 'allowed-hosts']);
  if (!supportedScopeModes.has(config.scope.mode)) {
    throw new Error(`Unsupported scope.mode "${config.scope.mode}" in ${configPath}`);
  }
  if (!Array.isArray(config.sample.structuredManual)) {
    throw new Error(`sample.structuredManual must be an array in ${configPath}`);
  }
  if (typeof config.sample.randomSeed !== 'number') {
    throw new Error(`sample.randomSeed must be numeric in ${configPath}`);
  }
  if (!Array.isArray(config.processes)) {
    throw new Error(`processes must be an array in ${configPath}`);
  }
}
